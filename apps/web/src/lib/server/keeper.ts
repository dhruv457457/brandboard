import "server-only";
import { encodeFunctionData } from "viem";
import postgres from "postgres";
import { PrivyClient } from "@privy-io/node";
import { patchedMarketAbi } from "@patched/shared";
import { syncChain } from "@patched/indexer";
import { CHAIN_ID, MARKET, serverClient, serverRpcUrl } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

export interface KeeperAction {
  kind: "closeBidding" | "release" | "markFailed";
  listingId: number;
  milestone?: number;
  status: "sent" | "skipped" | "failed";
  hash?: string;
  reason?: string;
}

let sql: ReturnType<typeof postgres> | null = null;
let privy: PrivyClient | null = null;

/**
 * One keeper pass: catch the indexer up, find everything that is due, and send each call from the
 * Privy server wallet. The wallet's Privy policy only allows closeBidding / release / markFailed on
 * the market, so even a leaked keeper secret can't move funds anywhere else.
 */
export async function runKeeper(): Promise<KeeperAction[]> {
  sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });
  await syncChain({ sql, chainId: CHAIN_ID, rpcUrl: serverRpcUrl(), maxBlocks: 5_000n });

  const db = supabaseAdmin();
  const now = new Date().toISOString();
  const jobs: Omit<KeeperAction, "status">[] = [];

  const { data: ended } = await db.from("listings").select("listing_id")
    .eq("chain_id", CHAIN_ID).eq("status", 1).lte("bidding_ends_at", now).limit(20);
  for (const l of ended ?? []) jobs.push({ kind: "closeBidding", listingId: l.listing_id });

  const { data: delivering } = await db.from("listings").select("listing_id, next_milestone")
    .eq("chain_id", CHAIN_ID).eq("status", 2).limit(50);
  if (delivering?.length) {
    const { data: ms } = await db.from("milestones").select("listing_id, idx, status, review_ends_at, deadline")
      .eq("chain_id", CHAIN_ID).in("listing_id", delivering.map((l) => l.listing_id));
    for (const l of delivering) {
      const m = ms?.find((x) => x.listing_id === l.listing_id && x.idx === l.next_milestone);
      if (!m) continue;
      if (m.status === 1 && m.review_ends_at && m.review_ends_at <= now) {
        jobs.push({ kind: "release", listingId: l.listing_id, milestone: m.idx });
      } else if (m.status === 0 && m.deadline < now) {
        jobs.push({ kind: "markFailed", listingId: l.listing_id, milestone: m.idx });
      }
    }
  }

  const results: KeeperAction[] = [];
  for (const job of jobs) results.push(await execute(job));
  if (results.some((r) => r.status === "sent")) await syncChain({ sql, chainId: CHAIN_ID, rpcUrl: serverRpcUrl(), maxBlocks: 5_000n });
  return results;
}

async function execute(job: Omit<KeeperAction, "status">): Promise<KeeperAction> {
  const data =
    job.kind === "release"
      ? encodeFunctionData({ abi: patchedMarketAbi, functionName: "release", args: [BigInt(job.listingId), job.milestone!] })
      : encodeFunctionData({ abi: patchedMarketAbi, functionName: job.kind, args: [BigInt(job.listingId)] });

  const keeper = process.env.KEEPER_ADDRESS as `0x${string}`;
  const client = serverClient();
  try {
    // Only send what the contract would accept right now (the indexed view can be a few seconds old).
    await client.call({ account: keeper, to: MARKET, data });
  } catch (err) {
    return { ...job, status: "skipped", reason: err instanceof Error ? err.message.split("\n")[0] : "not due" };
  }

  try {
    privy ??= new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
    const res = await privy.wallets().ethereum().sendTransaction(process.env.PRIVY_SERVER_WALLET_ID!, {
      caip2: `eip155:${CHAIN_ID}`,
      params: { transaction: { to: MARKET, data, chain_id: CHAIN_ID } },
      sponsor: true,
      authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!] },
    });
    const hash = res.hash as `0x${string}`;
    await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return { ...job, status: "sent", hash };
  } catch (err) {
    return { ...job, status: "failed", reason: err instanceof Error ? err.message.split("\n")[0] : String(err) };
  }
}
