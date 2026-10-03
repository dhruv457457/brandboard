import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { signerAutoBidRules, type SignerAutoBid } from "@/lib/market/autoBidPolicy";
import { authContext, keyOwner, privyServer } from "./privy";

/** Patched's key quorum: added as a signer on brand wallets for auto-bid. */
export const SIGNER_ID = process.env.PRIVY_SIGNER_QUORUM_ID ?? "";

export interface Delegation {
  wallet: string;
  privy_did: string;
  privy_wallet_id: string;
  policy_id: string;
  signer_added_at: string | null;
  revoked_at: string | null;
}

/** A raise (a new spot or a higher maximum) waiting for the brand's wallet to approve its policy. */
export interface PendingRaise {
  wallet: string;
  policy_id: string;
  chain_id: number;
  listing_id: number | string;
  patch_id: number;
  max_amount: number | string;
}

export type SignerState = "ok" | "missing" | "other-policy";

/** The Privy embedded wallet (id and address) behind this account's wallet, or null for outside wallets. */
export async function embeddedWallet(did: string, address: string): Promise<{ id: string; address: string } | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, {
    headers: { "privy-app-id": appId, authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { linked_accounts?: { type: string; id?: string | null; address?: string; wallet_client_type?: string; chain_type?: string }[] };
  const account = (user.linked_accounts ?? []).find(
    (a) => a.type === "wallet" && a.wallet_client_type === "privy" && (a.chain_type ?? "ethereum") === "ethereum" && a.address?.toLowerCase() === address.toLowerCase(),
  );
  if (!account?.address) return null;
  if (account.id) return { id: account.id, address: account.address.toLowerCase() };
  // Older embedded wallets have no id on the linked account: look it up by address.
  for await (const w of privyServer().wallets().list({ address: account.address as `0x${string}`, chain_type: "ethereum" })) {
    return { id: w.id, address: w.address.toLowerCase() };
  }
  return null;
}

/** The policies our signer carries on this wallet, as Privy has them; null when our signer isn't on it. */
export async function signerPolicies(walletId: string): Promise<string[] | null> {
  const wallet = await privyServer().wallets().get(walletId);
  const ours = (wallet.additional_signers ?? []).find((s) => s.signer_id === SIGNER_ID);
  return ours ? ((ours.override_policy_ids ?? []) as string[]) : null;
}

/** Is our signer on the wallet with exactly this policy, with another one, or not at all? */
export function stateOf(policies: string[] | null, policyId: string): SignerState {
  if (!policies) return "missing";
  return policies.length === 1 && policies[0] === policyId ? "ok" : "other-policy";
}

export async function signerState(walletId: string, policyId: string): Promise<SignerState> {
  return stateOf(await signerPolicies(walletId), policyId);
}

export async function getDelegation(wallet: string): Promise<Delegation | null> {
  const { data } = await supabaseAdmin().from("signer_delegations").select("*").eq("wallet", wallet.toLowerCase()).maybeSingle();
  return (data as Delegation | null) ?? null;
}

/** The wallet's delegation row, creating its (empty, deny-all) Privy policy the first time. */
export async function ensureDelegation(input: { wallet: string; did: string; privyWalletId: string }): Promise<Delegation> {
  const existing = await getDelegation(input.wallet);
  if (existing) {
    if (existing.privy_wallet_id !== input.privyWalletId || existing.privy_did !== input.did) {
      await supabaseAdmin().from("signer_delegations")
        .update({ privy_wallet_id: input.privyWalletId, privy_did: input.did }).eq("wallet", existing.wallet);
    }
    return { ...existing, privy_wallet_id: input.privyWalletId, privy_did: input.did };
  }
  const policy = await privyServer().policies().create({
    version: "1.0",
    name: `Auto-bid ${input.wallet.slice(0, 10)}`,
    chain_type: "ethereum",
    owner: keyOwner(),
    rules: [],
  });
  const row = { wallet: input.wallet.toLowerCase(), privy_did: input.did, privy_wallet_id: input.privyWalletId, policy_id: policy.id };
  const { data, error } = await supabaseAdmin().from("signer_delegations")
    .upsert(row, { onConflict: "wallet", ignoreDuplicates: true }).select("*").maybeSingle();
  if (error) throw error;
  // Lost a race with a parallel request: use the row that won, and drop our unused policy.
  if (!data) {
    await dropPolicy(policy.id);
    return (await getDelegation(input.wallet))!;
  }
  return data as Delegation;
}

/** The wallet's active auto-bids on every chain: what the keeper bids for, and what its policy allows. */
async function activeBids(wallet: string): Promise<SignerAutoBid[]> {
  const { data, error } = await supabaseAdmin().from("signer_auto_bids").select("chain_id, listing_id, patch_id, max_amount")
    .eq("wallet", wallet).eq("active", true);
  if (error) throw error;
  return (data ?? []).map((r) => ({ chainId: r.chain_id, listingId: Number(r.listing_id), patchId: r.patch_id, max: BigInt(r.max_amount) }));
}

/**
 * Rewrite the wallet's Privy policy from its active auto-bids (every chain). No auto-bids: the policy allows nothing.
 * This only ever narrows what the brand's wallet approved: an auto-bid only turns on, or goes up, in applyRaise, after
 * the wallet itself put our signer on a policy that includes it. Turning one off or lowering it comes through here.
 */
export async function syncPolicy(delegation: Pick<Delegation, "wallet" | "policy_id">) {
  const rules = signerAutoBidRules(await activeBids(delegation.wallet));
  await privyServer().policies().update(delegation.policy_id, { rules, authorization_context: authContext() });
}

export async function getPendingRaise(wallet: string): Promise<PendingRaise | null> {
  const { data } = await supabaseAdmin().from("signer_pending_raises").select("*").eq("wallet", wallet.toLowerCase()).maybeSingle();
  return (data as PendingRaise | null) ?? null;
}

export const sameSpot = (p: PendingRaise, chainId: number, listingId: number, patchId: number) =>
  p.chain_id === chainId && Number(p.listing_id) === listingId && p.patch_id === patchId;

/**
 * A raise (a new spot, or a higher maximum) is never written into the policy our signer carries on the wallet: anyone
 * holding the brand's session could otherwise raise it with no wallet action and no passkey. Instead a new policy gets
 * the active auto-bids plus the raise, and the raise waits until the brand's wallet swaps our signer onto that policy
 * (removeSigners, then addSigners, which Privy guards with the brand's passkey) and the browser confirms. Until then
 * the keeper keeps the old maximums. A raise still waiting from before is replaced, and its unused policy deleted.
 */
export async function stageRaise(delegation: Delegation, raise: SignerAutoBid, replaces: PendingRaise | null): Promise<string> {
  const others = (await activeBids(delegation.wallet))
    .filter((b) => !(b.chainId === raise.chainId && b.listingId === raise.listingId && b.patchId === raise.patchId));
  const policy = await privyServer().policies().create({
    version: "1.0",
    name: `Auto-bid ${delegation.wallet.slice(0, 10)}`,
    chain_type: "ethereum",
    owner: keyOwner(),
    rules: signerAutoBidRules([...others, raise]),
  });
  const { error } = await supabaseAdmin().from("signer_pending_raises").upsert({
    wallet: delegation.wallet, policy_id: policy.id, chain_id: raise.chainId, listing_id: raise.listingId, patch_id: raise.patchId,
    max_amount: raise.max.toString(), created_at: new Date().toISOString(),
  }, { onConflict: "wallet" });
  if (error) {
    await dropPolicy(policy.id);
    throw error;
  }
  if (replaces) await dropPolicy(replaces.policy_id);
  return policy.id;
}

/** Forget a raise that is still waiting (a newer choice replaced it, or auto-bid was revoked) and delete its policy. */
export async function dropPendingRaise(pending: PendingRaise) {
  await supabaseAdmin().from("signer_pending_raises").delete().eq("wallet", pending.wallet).eq("policy_id", pending.policy_id);
  await dropPolicy(pending.policy_id);
}

/**
 * The brand's wallet carries the raise's policy: point the delegation at that policy, turn the raise on, and delete
 * the old policy. The delegation moves first, so a crash halfway never leaves syncPolicy narrowing a policy that is no
 * longer on the wallet. Anything turned off or lowered while the wallet was approving comes out of the new policy too.
 */
export async function applyRaise(delegation: Delegation, raise: PendingRaise): Promise<Delegation> {
  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const moved = await db.from("signer_delegations").update({ policy_id: raise.policy_id, signer_added_at: now, revoked_at: null }).eq("wallet", delegation.wallet);
  if (moved.error) throw moved.error;
  const on = await db.from("signer_auto_bids").upsert(
    { chain_id: raise.chain_id, wallet: delegation.wallet, listing_id: raise.listing_id, patch_id: raise.patch_id, max_amount: String(raise.max_amount), active: true, updated_at: now },
    { onConflict: "chain_id,wallet,listing_id,patch_id" },
  );
  if (on.error) throw on.error;
  await db.from("signer_pending_raises").delete().eq("wallet", delegation.wallet).eq("policy_id", raise.policy_id);
  const next = { ...delegation, policy_id: raise.policy_id, signer_added_at: now, revoked_at: null };
  await syncPolicy(next);
  if (delegation.policy_id !== raise.policy_id) await dropPolicy(delegation.policy_id);
  return next;
}

/**
 * A raise whose policy the brand's wallet already put on, but whose confirm never arrived (the tab closed right after
 * the wallet step): the wallet approved it, so it counts now. Returns the delegation as it stands and the raise still
 * waiting, if any. `policies`: our signer's policies on the wallet, when the caller already looked them up.
 */
export async function settlePendingRaise(delegation: Delegation, policies?: string[] | null): Promise<{ delegation: Delegation; pending: PendingRaise | null }> {
  const pending = await getPendingRaise(delegation.wallet);
  if (!pending) return { delegation, pending: null };
  const onWallet = policies === undefined ? await signerPolicies(delegation.privy_wallet_id) : policies;
  if (stateOf(onWallet, pending.policy_id) !== "ok") return { delegation, pending };
  return { delegation: await applyRaise(delegation, pending), pending: null };
}

async function dropPolicy(id: string) {
  await privyServer().policies().delete(id, { authorization_context: authContext() })
    .catch((err) => console.warn("couldn't delete auto-bid policy", id, err instanceof Error ? err.message : err));
}
