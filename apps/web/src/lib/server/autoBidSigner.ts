import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import { signerAutoBidRules } from "@/lib/market/autoBidPolicy";
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

/** Is our signer on this wallet, and with which policy? */
export async function signerState(walletId: string, policyId: string): Promise<"ok" | "missing" | "other-policy"> {
  const wallet = await privyServer().wallets().get(walletId);
  const ours = (wallet.additional_signers ?? []).find((s) => s.signer_id === SIGNER_ID);
  if (!ours) return "missing";
  const ids = (ours.override_policy_ids ?? []) as string[];
  return ids.length === 1 && ids[0] === policyId ? "ok" : "other-policy";
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
    await privyServer().policies().delete(policy.id, { authorization_context: authContext() }).catch(() => {});
    return (await getDelegation(input.wallet))!;
  }
  return data as Delegation;
}

/** Rewrite the wallet's Privy policy from its active auto-bids (every chain). No auto-bids: the policy allows nothing. */
export async function syncPolicy(delegation: Delegation) {
  const { data } = await supabaseAdmin().from("signer_auto_bids").select("chain_id, listing_id, patch_id, max_amount")
    .eq("wallet", delegation.wallet).eq("active", true);
  const rules = signerAutoBidRules((data ?? []).map((r) => ({
    chainId: r.chain_id, listingId: Number(r.listing_id), patchId: r.patch_id, max: BigInt(r.max_amount),
  })));
  await privyServer().policies().update(delegation.policy_id, { rules, authorization_context: authContext() });
}
