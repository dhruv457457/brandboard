import "server-only";
import { encodeFunctionData, erc20Abi } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, USDC, serverClient } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { ERC20_SPEND_ABI } from "@/lib/market/campaignPolicy";
import { privyServer, sendFromServerWallet } from "./privy";
import type { CampaignRow } from "./campaigns";
import type { XAccount } from "./xLookup";

const SPONSORED = process.env.KEEPER_GAS_SPONSORED !== "false";

interface PrivyUserLite {
  id: string;
  custom_metadata?: Record<string, unknown> | null;
  linked_accounts: { type: string; address?: string; chain_type?: string; first_verified_at?: number | null }[];
}

/** The account's Patched wallet: the one chosen at sign-in, else the Ethereum wallet linked first (same rule as auth). */
function accountWallet(user: PrivyUserLite): string | null {
  const evm = user.linked_accounts.filter((a) => a.type === "wallet" && (a.chain_type ?? "ethereum") === "ethereum" && a.address);
  const chosen = String(user.custom_metadata?.accountWallet ?? "").toLowerCase();
  if (chosen && evm.some((a) => a.address!.toLowerCase() === chosen)) return chosen;
  const first = [...evm].sort((a, b) => (a.first_verified_at ?? Infinity) - (b.first_verified_at ?? Infinity))[0];
  return first?.address?.toLowerCase() ?? null;
}

const notFound = (err: unknown) => (err as { status?: number }).status === 404;

/**
 * The Privy user behind an X account, and their wallet. If nobody has signed in with that X account yet, create the
 * user now with the X account linked and a wallet made ahead of time: when they first sign in with X, Privy logs them
 * into this user, so the wallet (and whatever is waiting for it) is already theirs.
 */
export async function privyUserForX(x: XAccount): Promise<{ did: string; wallet: string; pregenerated: boolean }> {
  const privy = privyServer();
  const find = async () => {
    try {
      return (await privy.users().getByTwitterSubject({ subject: x.id })) as unknown as PrivyUserLite;
    } catch (err) {
      if (notFound(err)) return null;
      throw err;
    }
  };
  const existing = await find();
  if (existing) {
    const wallet = accountWallet(existing);
    if (!wallet) throw new Error("That X account is on Patched but has no wallet yet. Ask them to sign in once.");
    return { did: existing.id, wallet, pregenerated: false };
  }
  try {
    const created = (await privy.users().create({
      linked_accounts: [{ type: "twitter_oauth", subject: x.id, username: x.username, name: x.name }],
      wallets: [{ chain_type: "ethereum" }],
    })) as unknown as PrivyUserLite;
    const wallet = accountWallet(created);
    if (!wallet) throw new Error("Privy didn't make a wallet for that X account.");
    return { did: created.id, wallet, pregenerated: true };
  } catch (err) {
    // Someone else's offer (or their own sign-in) created the user a moment ago.
    const again = await find();
    const wallet = again && accountWallet(again);
    if (again && wallet) return { did: again.id, wallet, pregenerated: false };
    throw err;
  }
}

/** The market's minimum listing stake right now: what an offer advances to a creator who has no USDC yet. */
export async function minListingBond(): Promise<bigint> {
  return BigInt(await serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minBond" }));
}

/**
 * The person an offer is for claims it after signing in with X: record it, and if their wallet can't cover the
 * listing stake yet, the offer wallet sends them the stake (its Privy policy allows exactly this transfer, to exactly
 * this wallet, up to that amount).
 */
export async function claimOffer(c: CampaignRow, user: { did: string; wallets: string[] }): Promise<{ advanced: bigint }> {
  const target = c.target_wallet!;
  if (c.target_privy_did !== user.did && !user.wallets.includes(target)) throw new ClaimError("This offer is for another X account.");
  const db = supabaseAdmin();
  if (!c.claimed_at) await db.from("brand_campaigns").update({ claimed_at: new Date().toISOString() }).eq("id", c.id);
  if (!c.advance || c.advanced_at || c.status !== "active") return { advanced: 0n };

  const client = serverClient();
  const advance = BigInt(c.advance);
  const [theirs, offer] = await Promise.all([
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [target as `0x${string}`] }),
    client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [c.wallet_address as `0x${string}`] }),
  ]);
  if (theirs >= advance || offer < advance) return { advanced: 0n };

  const data = encodeFunctionData({ abi: ERC20_SPEND_ABI, functionName: "transfer", args: [target as `0x${string}`, advance] });
  const { hash } = await sendFromServerWallet(c.wallet_id, { to: USDC, chainId: CHAIN_ID, data },
    { idempotencyKey: `patched:${CHAIN_ID}:offer:${c.id}:advance`, sponsor: SPONSORED, signed: true });
  if (hash) await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
  await db.from("brand_campaigns").update({ advanced_at: new Date().toISOString() }).eq("id", c.id);
  await db.from("brand_campaign_actions").insert({
    campaign_id: c.id, kind: "advance", text: `Sent @${c.target_x_handle} their ${Number(advance) / 1e6} USDC listing stake from the offer.`,
    amount: advance.toString(), tx_hash: hash,
  });
  return { advanced: advance };
}

export class ClaimError extends Error {}
