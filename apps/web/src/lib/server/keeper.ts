import "server-only";
import { encodeFunctionData } from "viem";
import postgres from "postgres";
import { PrivyClient } from "@privy-io/node";
import { patchAutoBidderAbi, patchedMarketAbi } from "@patched/shared";
import { syncChain } from "@patched/indexer";
import { AUTO_BIDDER, CHAIN_ID, MARKET, serverClient, serverRpcUrl } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

export interface KeeperAction {
  kind: "closeBidding" | "release" | "markFailed" | "autoBid";
  listingId: number;
  milestone?: number;
  /** autoBid only: the brand being kept on top, and the patch. */
  brand?: string;
  patchId?: number;
  status: "sent" | "skipped" | "failed";
  hash?: string;
  reason?: string;
}

let sql: ReturnType<typeof postgres> | null = null;
let privy: PrivyClient | null = null;

/**
 * One keeper pass: catch the indexer up, find everything that is due, and send each call from the
 * Privy server wallet. The wallet's Privy policy only allows closeBidding / release / markFailed on
 * the market and execute on the auto-bidder, so even a leaked keeper secret can't move funds anywhere else.
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
  results.push(...(await respondAutoBids()));
  return results;
}

let responding: Promise<KeeperAction[]> | null = null;

/**
 * Auto-bid responder: for every active auto-bid whose brand is no longer leading a live patch, call
 * PatchAutoBidder.execute from the keeper wallet. The contract bids the minimum step and never goes
 * above the brand's maximum, so this only decides *when*, never *how much*. Runs a few rounds so two
 * auto-bidders on one patch settle in one call. Concurrent callers share one run.
 */
export function respondAutoBids(): Promise<KeeperAction[]> {
  if (!AUTO_BIDDER || !process.env.PRIVY_SERVER_WALLET_ID) return Promise.resolve([]);
  responding ??= (async () => {
    sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });
    const all: KeeperAction[] = [];
    for (let round = 0; round < 6; round++) {
      const jobs = await dueAutoBids();
      if (!jobs.length) break;
      const results: KeeperAction[] = [];
      for (const job of jobs) results.push(await execute(job));
      all.push(...results);
      if (!results.some((r) => r.status === "sent")) break;
      await syncChain({ sql, chainId: CHAIN_ID, rpcUrl: serverRpcUrl(), maxBlocks: 5_000n });
    }
    return all;
  })().finally(() => {
    responding = null;
  });
  return responding;
}

async function dueAutoBids(): Promise<Omit<KeeperAction, "status">[]> {
  const db = supabaseAdmin();
  const { data: rules } = await db.from("auto_bid_rules").select("wallet, listing_id, patch_id, max_amount")
    .eq("chain_id", CHAIN_ID).eq("active", true).limit(200);
  if (!rules?.length) return [];
  const ids = [...new Set(rules.map((r) => r.listing_id))];
  const [{ data: live }, { data: patches }] = await Promise.all([
    db.from("listings").select("listing_id").eq("chain_id", CHAIN_ID).eq("status", 1)
      .gt("bidding_ends_at", new Date().toISOString()).in("listing_id", ids),
    db.from("patches").select("listing_id, patch_id, top_bidder, bought").eq("chain_id", CHAIN_ID).in("listing_id", ids),
  ]);
  const liveIds = new Set((live ?? []).map((l) => l.listing_id));
  return rules
    .filter((r) => liveIds.has(r.listing_id))
    .filter((r) => {
      const p = patches?.find((x) => x.listing_id === r.listing_id && x.patch_id === r.patch_id);
      return p && !p.bought && p.top_bidder?.toLowerCase() !== r.wallet;
    })
    .map((r) => ({ kind: "autoBid" as const, listingId: r.listing_id, patchId: r.patch_id, brand: r.wallet }));
}

async function execute(job: Omit<KeeperAction, "status">): Promise<KeeperAction> {
  const to = job.kind === "autoBid" ? AUTO_BIDDER! : MARKET;
  const data =
    job.kind === "autoBid"
      ? encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "execute", args: [job.brand as `0x${string}`, BigInt(job.listingId), job.patchId!] })
      : job.kind === "release"
        ? encodeFunctionData({ abi: patchedMarketAbi, functionName: "release", args: [BigInt(job.listingId), job.milestone!] })
        : encodeFunctionData({ abi: patchedMarketAbi, functionName: job.kind, args: [BigInt(job.listingId)] });

  const keeper = process.env.KEEPER_ADDRESS as `0x${string}`;
  const client = serverClient();
  try {
    // Only send what the contract would accept right now (the indexed view can be a few seconds old).
    await client.call({ account: keeper, to, data });
  } catch (err) {
    return { ...job, status: "skipped", reason: err instanceof Error ? err.message.split("\n")[0] : "not due" };
  }

  try {
    privy ??= new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
    const res = await privy.wallets().ethereum().sendTransaction(process.env.PRIVY_SERVER_WALLET_ID!, {
      caip2: `eip155:${CHAIN_ID}`,
      params: { transaction: { to, data, chain_id: CHAIN_ID } },
      // Sponsored by Privy unless turned off; then the keeper wallet pays its own MON.
      sponsor: process.env.KEEPER_GAS_SPONSORED !== "false",
      // Wallets owned by an authorization key need a signed request; app-controlled wallets don't.
      ...(process.env.KEEPER_USES_AUTH_KEY === "false"
        ? {}
        : { authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!] } }),
    });
    // Sponsored sends are relayed asynchronously: the hash can be empty at first, so look it up by id.
    let hash = res.hash as `0x${string}` | "";
    for (let i = 0; !hash && res.transaction_id && i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const t = await privy.transactions().get(res.transaction_id);
      if (t.status === "failed" || t.status === "execution_reverted" || t.status === "provider_error") throw new Error(`transaction ${t.status}`);
      hash = (t.transaction_hash ?? "") as `0x${string}` | "";
    }
    if (!hash) return { ...job, status: "sent", reason: `submitted as ${res.transaction_id}` };
    await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
    return { ...job, status: "sent", hash };
  } catch (err) {
    return { ...job, status: "failed", reason: err instanceof Error ? err.message.split("\n")[0] : String(err) };
  }
}
