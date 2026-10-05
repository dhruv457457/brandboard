import "server-only";
import { encodeFunctionData } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { isPolicyViolation, sendFromServerWallet } from "./privy";

export interface ApproveResult {
  listingId: number;
  status: "approved" | "skipped" | "failed";
  hash?: string | null;
  reason?: string;
}

/**
 * Listings go live by themselves. The market still has a Pending state, so a Privy server wallet whose policy allows
 * exactly one call (approveListing on our market) moves each new listing to Active within seconds of it being created.
 * Nobody reviews listings: reported posts are hidden afterwards instead (see /api/reports).
 * PRIVY_APPROVER_WALLET_ID is that wallet; until it is set the open-admin wallet is used, which has the same call
 * allowed. Either needs ADMIN_ROLE on the market.
 */
export const approverWalletId = () => process.env.PRIVY_APPROVER_WALLET_ID || process.env.PRIVY_OPEN_ADMIN_WALLET_ID || null;
const approverAddress = () => (process.env.APPROVER_ADDRESS || process.env.OPEN_ADMIN_ADDRESS || null) as `0x${string}` | null;

/** Approve these listings. Each is simulated first, so one that is already live (or whose bidding is over) is skipped. */
export async function approveListings(ids: number[]): Promise<ApproveResult[]> {
  const wallet = approverWalletId();
  const from = approverAddress();
  if (!wallet || !from) return ids.map((listingId) => ({ listingId, status: "skipped", reason: "no approver wallet is set" }));
  const client = serverClient();
  const out: ApproveResult[] = [];
  for (const listingId of ids) {
    const data = encodeFunctionData({ abi: patchedMarketAbi, functionName: "approveListing", args: [BigInt(listingId)] });
    try {
      await client.call({ account: from, to: MARKET, data });
    } catch (err) {
      out.push({ listingId, status: "skipped", reason: err instanceof Error ? err.message.split("\n")[0] : "the market refused it" });
      continue;
    }
    try {
      const { hash } = await sendFromServerWallet(wallet, { to: MARKET, data, chainId: CHAIN_ID }, {
        idempotencyKey: `patched:${CHAIN_ID}:approve:${listingId}`,
        sponsor: process.env.KEEPER_GAS_SPONSORED !== "false",
        signed: true,
      });
      if (hash) await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
      out.push({ listingId, status: "approved", hash });
    } catch (err) {
      console.error("auto-approve failed", listingId, err);
      out.push({ listingId, status: "failed", reason: isPolicyViolation(err) ? "outside the approver policy" : "the send failed" });
    }
  }
  return out;
}

/** Everything the index still shows as Pending and whose bidding hasn't ended. */
export async function approvePending(): Promise<ApproveResult[]> {
  if (!approverWalletId()) return [];
  const { data } = await supabaseAdmin().from("listings").select("listing_id")
    .eq("chain_id", CHAIN_ID).eq("status", 0).gt("bidding_ends_at", new Date().toISOString()).limit(20);
  return approveListings((data ?? []).map((l) => l.listing_id));
}
