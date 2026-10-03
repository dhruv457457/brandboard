import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import {
  SIGNER_ID, applyRaise, dropPendingRaise, embeddedWallet, ensureDelegation, getDelegation, getPendingRaise, sameSpot, settlePendingRaise,
  signerPolicies, signerState, stageRaise, stateOf, syncPolicy,
} from "@/lib/server/autoBidSigner";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Auto-bid through Privy signers, for accounts on a Patched (Privy embedded) wallet.
 * GET: { available, delegated, policyId, bids: [{ listingId, patchId, max }] } for this chain.
 */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const wallet = user.wallet.toLowerCase();
  const [delegation, { data: bids }] = await Promise.all([
    getDelegation(wallet),
    supabaseAdmin().from("signer_auto_bids").select("listing_id, patch_id, max_amount")
      .eq("chain_id", CHAIN_ID).eq("wallet", wallet).eq("active", true),
  ]);
  const ids = [...new Set((bids ?? []).map((b) => b.listing_id))];
  const { data: cards } = ids.length
    ? await supabaseAdmin().from("listing_cards").select("listing_id, creator, creator_handle").eq("chain_id", CHAIN_ID).in("listing_id", ids)
    : { data: [] };
  return Response.json({
    available: !!SIGNER_ID && !!(await embeddedWallet(user.did, wallet)),
    delegated: !!delegation?.signer_added_at && !delegation.revoked_at,
    policyId: delegation?.policy_id ?? null,
    bids: (bids ?? []).map((b) => {
      const c = cards?.find((x) => x.listing_id === b.listing_id);
      return { listingId: Number(b.listing_id), patchId: b.patch_id, max: String(b.max_amount), href: `/${c?.creator_handle ?? c?.creator ?? ""}/${b.listing_id}` };
    }),
  });
}

/**
 * POST { action }:
 * - "set" { listingId, patchId, max } (max in 6-decimal USDC, as a string). Returns { signerId, policyId, signer }
 *   where signer is "ok", "missing" or "other-policy"; for the last two the browser puts our signer on the wallet with
 *   this policy (removeSigners if needed, then addSigners) and calls "confirm" with the policy id.
 *   A lower (or the same) maximum on a spot that's already on narrows the policy on the wallet right away. A raise (a
 *   new spot, or a higher maximum) never touches that policy: it gets a new one (see stageRaise), and only counts once
 *   the brand's wallet has approved it, so a stolen session can't raise anything.
 * - "confirm" { policyId }: check with Privy that our signer is on the wallet with exactly that policy, then turn the
 *   waiting raise on (or, for the policy already in use, just mark the signer on).
 * - "off" { listingId, patchId }: stop one auto-bid and take its rule out of the policy.
 * - "revoke": after the browser removed our signer (removeSigners), stop every auto-bid and empty the policy.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  if (!SIGNER_ID) return bad("Auto-bid through your wallet isn't set up on this site.", 503);
  const wallet = user.wallet.toLowerCase();
  if (!allow(`autobid:${wallet}`, 200)) return bad("Too many auto-bid changes today. Try again tomorrow.", 429);
  const body = (await req.json().catch(() => ({}))) as { action?: string; listingId?: number; patchId?: number; max?: string; policyId?: string };
  const db = supabaseAdmin();
  const now = () => new Date().toISOString();

  try {
    if (body.action === "set") {
      const listingId = Number(body.listingId);
      const patchId = Number(body.patchId);
      let max: bigint;
      try {
        max = BigInt(String(body.max));
      } catch {
        return bad("Enter a maximum in dollars.");
      }
      if (!(max >= 1_000_000n && max <= 100_000_000_000n)) return bad("Pick a maximum between $1 and $100,000.");

      const [{ data: listing }, { data: patch }] = await Promise.all([
        db.from("listings").select("creator, status, bidding_ends_at").eq("chain_id", CHAIN_ID).eq("listing_id", listingId).maybeSingle(),
        db.from("patches").select("bought").eq("chain_id", CHAIN_ID).eq("listing_id", listingId).eq("patch_id", patchId).maybeSingle(),
      ]);
      if (!listing || listing.status !== 1 || new Date(listing.bidding_ends_at) <= new Date()) return bad("Bidding on this listing is closed.");
      if (!patch || patch.bought) return bad("This spot isn't open for bids.");
      if (String(listing.creator).toLowerCase() === wallet) return bad("You can't auto-bid on your own listing.");

      const embedded = await embeddedWallet(user.did, wallet);
      if (!embedded) return bad("Auto-bid from your wallet needs a Patched wallet. Outside wallets use the contract auto-bid.");
      const policies = await signerPolicies(embedded.id);
      const { delegation, pending } = await settlePendingRaise(await ensureDelegation({ wallet, did: user.did, privyWalletId: embedded.id }), policies);
      const { data: row } = await db.from("signer_auto_bids").select("max_amount, active")
        .eq("chain_id", CHAIN_ID).eq("wallet", wallet).eq("listing_id", listingId).eq("patch_id", patchId).maybeSingle();
      const current = row?.active ? BigInt(row.max_amount) : 0n;

      if (max > current) {
        // A raise: a new policy the brand's wallet has to approve. The old maximum stands until "confirm".
        const policyId = await stageRaise(delegation, { chainId: CHAIN_ID, listingId, patchId, max }, pending);
        return Response.json({ signerId: SIGNER_ID, policyId, signer: policies ? "other-policy" : "missing" });
      }

      // The same or a lower maximum: narrow the policy on the wallet in place. It replaces a raise still waiting here.
      if (pending && sameSpot(pending, CHAIN_ID, listingId, patchId)) await dropPendingRaise(pending);
      if (max < current) {
        const { error } = await db.from("signer_auto_bids").update({ max_amount: max.toString(), updated_at: now() })
          .eq("chain_id", CHAIN_ID).eq("wallet", wallet).eq("listing_id", listingId).eq("patch_id", patchId);
        if (error) throw error;
        await syncPolicy(delegation);
      }
      const signer = stateOf(policies, delegation.policy_id);
      if (signer === "ok" && (!delegation.signer_added_at || delegation.revoked_at)) {
        await db.from("signer_delegations").update({ signer_added_at: now(), revoked_at: null }).eq("wallet", wallet);
      }
      return Response.json({ signerId: SIGNER_ID, policyId: delegation.policy_id, signer });
    }

    const delegation = await getDelegation(wallet);
    if (!delegation) return bad("You haven't set up auto-bid yet.");

    if (body.action === "confirm") {
      const pending = await getPendingRaise(wallet);
      // A page from before policy ids were sent means the policy it was just given.
      const policyId = body.policyId ?? pending?.policy_id ?? delegation.policy_id;
      if (stateOf(await signerPolicies(delegation.privy_wallet_id), policyId) !== "ok") {
        return bad("Privy doesn't show Patched on your wallet yet. Try again.", 409);
      }
      if (pending?.policy_id === policyId) {
        await applyRaise(delegation, pending);
      } else if (policyId === delegation.policy_id) {
        await db.from("signer_delegations").update({ signer_added_at: now(), revoked_at: null }).eq("wallet", wallet);
      } else {
        return bad("Auto-bid changed in another tab. Set your maximum again.", 409);
      }
      return Response.json({ ok: true });
    }

    if (body.action === "off") {
      const listingId = Number(body.listingId);
      const patchId = Number(body.patchId);
      // A raise the wallet already approved counts first, so the rule comes out of the policy that's really on it.
      const { delegation: settled, pending } = await settlePendingRaise(delegation);
      await db.from("signer_auto_bids").update({ active: false, updated_at: now() })
        .eq("chain_id", CHAIN_ID).eq("wallet", wallet).eq("listing_id", listingId).eq("patch_id", patchId);
      if (pending && sameSpot(pending, CHAIN_ID, listingId, patchId)) await dropPendingRaise(pending);
      await syncPolicy(settled);
      return Response.json({ ok: true });
    }

    if (body.action === "revoke") {
      const pending = await getPendingRaise(wallet);
      if (pending) await dropPendingRaise(pending);
      await db.from("signer_auto_bids").update({ active: false, updated_at: now() }).eq("wallet", wallet);
      await db.from("signer_delegations").update({ revoked_at: now() }).eq("wallet", wallet);
      await syncPolicy(delegation);
      const signer = await signerState(delegation.privy_wallet_id, delegation.policy_id);
      return Response.json({ ok: true, signerRemoved: signer === "missing" });
    }

    return bad("Unknown action.");
  } catch (err) {
    console.error("autobid signer failed", err);
    return bad("Privy couldn't update your auto-bid. Try again.", 502);
  }
}

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}
