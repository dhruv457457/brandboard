import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { SIGNER_ID, embeddedWallet, ensureDelegation, getDelegation, signerState, syncPolicy } from "@/lib/server/autoBidSigner";
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
 * - "set" { listingId, patchId, max } (max in 6-decimal USDC, as a string): save the auto-bid and rewrite the wallet's
 *   Privy policy. Returns { signerId, policyId, signer } where signer is "ok", "missing" or "other-policy"; for the
 *   last two the browser adds our signer with this policy (addSigners) and then calls "confirm".
 * - "confirm": check with Privy that our signer is on the wallet with the policy, and turn the auto-bids on.
 * - "off" { listingId, patchId }: stop one auto-bid and take its rule out of the policy.
 * - "revoke": after the browser removed our signer (removeSigners), stop every auto-bid and empty the policy.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  if (!SIGNER_ID) return bad("Auto-bid through your wallet isn't set up on this site.", 503);
  const wallet = user.wallet.toLowerCase();
  if (!allow(`autobid:${wallet}`, 200)) return bad("Too many auto-bid changes today. Try again tomorrow.", 429);
  const body = (await req.json().catch(() => ({}))) as { action?: string; listingId?: number; patchId?: number; max?: string };
  const db = supabaseAdmin();

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
      const delegation = await ensureDelegation({ wallet, did: user.did, privyWalletId: embedded.id });
      const { error } = await db.from("signer_auto_bids").upsert(
        { chain_id: CHAIN_ID, wallet, listing_id: listingId, patch_id: patchId, max_amount: max.toString(), active: true, updated_at: new Date().toISOString() },
        { onConflict: "chain_id,wallet,listing_id,patch_id" },
      );
      if (error) throw error;
      await syncPolicy(delegation);
      const signer = await signerState(embedded.id, delegation.policy_id);
      if (signer === "ok" && (!delegation.signer_added_at || delegation.revoked_at)) {
        await db.from("signer_delegations").update({ signer_added_at: new Date().toISOString(), revoked_at: null }).eq("wallet", wallet);
      }
      return Response.json({ signerId: SIGNER_ID, policyId: delegation.policy_id, signer });
    }

    const delegation = await getDelegation(wallet);
    if (!delegation) return bad("You haven't set up auto-bid yet.");

    if (body.action === "confirm") {
      const signer = await signerState(delegation.privy_wallet_id, delegation.policy_id);
      if (signer !== "ok") return bad("Privy doesn't show Patched on your wallet yet. Try again.", 409);
      await db.from("signer_delegations").update({ signer_added_at: new Date().toISOString(), revoked_at: null }).eq("wallet", wallet);
      return Response.json({ ok: true });
    }

    if (body.action === "off") {
      await db.from("signer_auto_bids").update({ active: false, updated_at: new Date().toISOString() })
        .eq("chain_id", CHAIN_ID).eq("wallet", wallet).eq("listing_id", Number(body.listingId)).eq("patch_id", Number(body.patchId));
      await syncPolicy(delegation);
      return Response.json({ ok: true });
    }

    if (body.action === "revoke") {
      await db.from("signer_auto_bids").update({ active: false, updated_at: new Date().toISOString() }).eq("wallet", wallet);
      await db.from("signer_delegations").update({ revoked_at: new Date().toISOString() }).eq("wallet", wallet);
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
