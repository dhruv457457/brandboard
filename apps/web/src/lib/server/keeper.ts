import "server-only";
import { encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import postgres from "postgres";
import { PrivyClient } from "@privy-io/node";
import { patchAutoBidderAbi, patchedMarketAbi } from "@patched/shared";
import { syncChain } from "@patched/indexer";
import { AUTO_BIDDER, CHAIN_ID, MARKET, USDC, serverClient, serverRpcUrl } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { approvePending } from "./autoApprove";
import { runCampaigns } from "./campaigns";
import { isPolicyViolation, sendFromServerWallet } from "./privy";

export interface KeeperAction {
  kind: "closeBidding" | "release" | "markFailed" | "autoBid";
  listingId: number;
  milestone?: number;
  /** autoBid only: the brand being kept on top, and the patch. */
  brand?: string;
  patchId?: number;
  /** autoBid only: the top bid (6-decimal USDC string) this call is responding to, for the idempotency key. */
  topBid?: string;
  /** autoBid only: "contract" = PatchAutoBidder.execute from the keeper; "signer" = a bid from the brand's own wallet. */
  via?: "contract" | "signer";
  /** Signer auto-bids: the brand's Privy wallet id and maximum (6-decimal USDC string). */
  walletId?: string;
  max?: string;
  status: "sent" | "skipped" | "failed";
  hash?: string;
  reason?: string;
  /** Milliseconds: until Privy accepted the request, until the tx hash was known, until it was mined. */
  timings?: { accepted: number; hash?: number; mined?: number };
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

  // New listings go live without a review: open anything still Pending before looking for what is due.
  await approvePending().catch((err) => console.error("auto-approve failed", err));

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
  // Brand campaigns: fund, bid within their Privy policy, return what's left at the end.
  await runCampaigns().catch((err) => console.error("campaigns failed", err));
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
  const contract = !!AUTO_BIDDER && !!process.env.PRIVY_SERVER_WALLET_ID;
  const signer = !!process.env.PRIVY_SIGNER_QUORUM_ID;
  if (!contract && !signer) return Promise.resolve([]);
  responding ??= (async () => {
    sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 2, onnotice: () => {} });
    const all: KeeperAction[] = [];
    for (let round = 0; round < 6; round++) {
      const jobs = [...(contract ? await dueAutoBids() : []), ...(signer ? await dueSignerBids() : [])];
      if (!jobs.length) break;
      const results: KeeperAction[] = [];
      for (const job of jobs) results.push(job.via === "signer" ? await executeSignerBid(job) : await execute(job));
      await notifyPaused(results);
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

/**
 * An auto-bid that fails because the brand's wallet ran out of USDC or of allowance is paused: tell the
 * brand once an hour per patch (the notification key includes the hour, so repeats are dropped).
 */
async function notifyPaused(results: KeeperAction[]) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const client = serverClient();
  const skipped = results.filter((r) => r.kind === "autoBid" && r.status === "skipped");
  // Check the cause on-chain rather than parsing revert text (token error formats differ).
  const causes = await Promise.all(
    skipped.map(async (r) => {
      const brand = r.brand as `0x${string}`;
      // Signer auto-bids approve the market themselves, so only the balance can stop them.
      const spender = r.via === "signer" ? null : AUTO_BIDDER;
      const [need, balance, allowance] = await Promise.all([
        client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minNextBid", args: [BigInt(r.listingId), r.patchId!] }),
        client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [brand] }),
        spender ? client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [brand, spender] }) : Promise.resolve(maxUint256),
      ]).catch(() => [0n, 1n, 1n] as const);
      return balance < need ? "balance" : allowance < need ? "allowance" : null;
    }),
  );
  const rows = skipped
    .map((r, i) => ({ r, cause: causes[i] }))
    .filter((x) => x.cause)
    .map(({ r, cause }) => ({
      chain_id: CHAIN_ID,
      tx_hash: `autobid-paused:${r.listingId}:${r.patchId}:${hour}`,
      log_index: 0,
      wallet: r.brand!,
      kind: "auto_bid_paused",
      payload: { listingId: String(r.listingId), patchId: r.patchId, reason: cause },
    }));
  if (rows.length) {
    await supabaseAdmin().from("notifications").upsert(rows, { onConflict: "chain_id,tx_hash,log_index,wallet,kind", ignoreDuplicates: true });
  }
}

type Rule = { wallet: string; listing_id: number; patch_id: number; max_amount: number | string };

async function dueAutoBids(): Promise<Omit<KeeperAction, "status">[]> {
  const { data: rules } = await supabaseAdmin().from("auto_bid_rules").select("wallet, listing_id, patch_id, max_amount")
    .eq("chain_id", CHAIN_ID).eq("active", true).limit(200);
  return (await dueRules(rules ?? [])).map(({ rule, topBid }) => ({
    kind: "autoBid" as const, via: "contract" as const, listingId: rule.listing_id, patchId: rule.patch_id, brand: rule.wallet, topBid,
  }));
}

/** Signer auto-bids whose brand is outbid, for wallets where our signer is on (and not revoked). */
async function dueSignerBids(): Promise<Omit<KeeperAction, "status">[]> {
  const db = supabaseAdmin();
  const { data: rules } = await db.from("signer_auto_bids").select("wallet, listing_id, patch_id, max_amount")
    .eq("chain_id", CHAIN_ID).eq("active", true).limit(200);
  if (!rules?.length) return [];
  const { data: delegations } = await db.from("signer_delegations").select("wallet, privy_wallet_id")
    .in("wallet", [...new Set(rules.map((r) => r.wallet))]).not("signer_added_at", "is", null).is("revoked_at", null);
  const walletIds = new Map((delegations ?? []).map((d) => [d.wallet, d.privy_wallet_id as string]));
  return (await dueRules(rules.filter((r) => walletIds.has(r.wallet)))).map(({ rule, topBid }) => ({
    kind: "autoBid" as const, via: "signer" as const, listingId: rule.listing_id, patchId: rule.patch_id, brand: rule.wallet, topBid,
    walletId: walletIds.get(rule.wallet), max: String(rule.max_amount),
  }));
}

/** The rules whose brand is outbid on a live patch and whose maximum can still beat the top bid. */
async function dueRules(rules: Rule[]): Promise<{ rule: Rule; topBid: string }[]> {
  if (!rules.length) return [];
  const db = supabaseAdmin();
  const ids = [...new Set(rules.map((r) => r.listing_id))];
  const [{ data: live }, { data: patches }] = await Promise.all([
    db.from("listings").select("listing_id, creator").eq("chain_id", CHAIN_ID).eq("status", 1)
      .gt("bidding_ends_at", new Date().toISOString()).in("listing_id", ids),
    db.from("patches").select("listing_id, patch_id, top_bidder, top_bid, floor, bought").eq("chain_id", CHAIN_ID).in("listing_id", ids),
  ]);
  const creators = new Map((live ?? []).map((l) => [l.listing_id, String(l.creator).toLowerCase()]));
  return rules
    // Live listings only, and never the creator's own listing (the market rejects those bids).
    .filter((r) => creators.has(r.listing_id) && creators.get(r.listing_id) !== r.wallet)
    .filter((r) => {
      const p = patches?.find((x) => x.listing_id === r.listing_id && x.patch_id === r.patch_id);
      if (!p || p.bought || p.top_bidder?.toLowerCase() === r.wallet) return false;
      // Skip rules that can't beat the current top bid (or reach the floor): they'd only revert OverMax.
      const max = BigInt(r.max_amount);
      return BigInt(p.top_bid) > 0n ? max > BigInt(p.top_bid) : max >= BigInt(p.floor);
    })
    .map((r) => {
      const p = patches!.find((x) => x.listing_id === r.listing_id && x.patch_id === r.patch_id)!;
      return { rule: r, topBid: String(p.top_bid) };
    });
}

/**
 * A signer auto-bid: from the brand's own Privy wallet, signed by our key quorum, within the wallet's Privy policy
 * (a bid on this spot up to the brand's max; an approval of the market up to their largest max). Approves exactly the
 * next bid when the allowance is short, then bids it.
 */
async function executeSignerBid(job: Omit<KeeperAction, "status">): Promise<KeeperAction> {
  const client = serverClient();
  const brand = job.brand as `0x${string}`;
  const chain = `patched:${CHAIN_ID}`;
  const spot = `${job.listingId}:${job.patchId}:${brand}:${job.topBid ?? "0"}`;
  const sponsor = process.env.KEEPER_GAS_SPONSORED !== "false";
  const t0 = Date.now();
  try {
    const amount = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minNextBid", args: [BigInt(job.listingId), job.patchId!] });
    if (amount > BigInt(job.max!)) return { ...job, status: "skipped", reason: "over the brand's maximum" };
    const [balance, allowance] = await Promise.all([
      client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [brand] }),
      client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [brand, MARKET] }),
    ]);
    if (balance < amount) return { ...job, status: "skipped", reason: "not enough USDC" };

    if (allowance < amount) {
      const approve = await sendFromServerWallet(
        job.walletId!,
        { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MARKET, amount] }), chainId: CHAIN_ID },
        { idempotencyKey: `${chain}:sapprove:${spot}`, sponsor, signed: true },
      );
      if (approve.hash) await client.waitForTransactionReceipt({ hash: approve.hash, timeout: 30_000 });
    }

    const data = encodeFunctionData({ abi: patchedMarketAbi, functionName: "bid", args: [BigInt(job.listingId), job.patchId!, amount] });
    try {
      await client.call({ account: brand, to: MARKET, data });
    } catch (err) {
      return { ...job, status: "skipped", reason: err instanceof Error ? err.message.split("\n")[0] : "not due" };
    }
    const sent = await sendFromServerWallet(job.walletId!, { to: MARKET, data, chainId: CHAIN_ID }, { idempotencyKey: `${chain}:sbid:${spot}`, sponsor, signed: true });
    const timings: NonNullable<KeeperAction["timings"]> = { accepted: Date.now() - t0 };
    if (!sent.hash) return { ...job, status: "sent", reason: `submitted as ${sent.transactionId}`, timings };
    timings.hash = Date.now() - t0;
    await client.waitForTransactionReceipt({ hash: sent.hash, timeout: 30_000 });
    timings.mined = Date.now() - t0;
    return { ...job, status: "sent", hash: sent.hash, timings };
  } catch (err) {
    const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ...job, status: isPolicyViolation(err) ? "skipped" : "failed", reason: isPolicyViolation(err) ? `refused by the brand's Privy policy: ${reason}` : reason };
  }
}

/**
 * A key that identifies one due action, not one call attempt: the same key for every retry of the
 * exact same situation, a different key once the situation moves on. Kept under 100 chars (Privy's
 * idempotency key limit) and namespaced to this chain so testnet and mainnet never collide.
 */
function idempotencyKey(job: Omit<KeeperAction, "status">): string {
  const chain = `patched:${CHAIN_ID}`;
  switch (job.kind) {
    case "autoBid":
      return `${chain}:autobid:${job.listingId}:${job.patchId}:${job.brand}:${job.topBid ?? "0"}`;
    case "release":
    case "markFailed":
      return `${chain}:${job.kind}:${job.listingId}:${job.milestone}`;
    case "closeBidding":
      return `${chain}:close:${job.listingId}`;
  }
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

  const t0 = Date.now();
  try {
    privy ??= new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
    const res = await privy.wallets().ethereum().sendTransaction(process.env.PRIVY_SERVER_WALLET_ID!, {
      caip2: `eip155:${CHAIN_ID}`,
      params: { transaction: { to, data, chain_id: CHAIN_ID } },
      // Sponsored by Privy unless turned off; then the keeper wallet pays its own MON.
      sponsor: process.env.KEEPER_GAS_SPONSORED !== "false",
      // A retried keeper tick (a cron overlap, a timeout after Privy accepted the send) must not send the
      // same action twice. The key is stable for one due action and changes once the situation does, so a
      // later legitimate call (e.g. the next outbid round) still goes through.
      idempotency_key: idempotencyKey(job),
      // Wallets owned by an authorization key need a signed request; app-controlled wallets don't.
      ...(process.env.KEEPER_USES_AUTH_KEY === "false"
        ? {}
        : { authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!] } }),
    });
    const timings: NonNullable<KeeperAction["timings"]> = { accepted: Date.now() - t0 };
    // Sponsored sends are relayed asynchronously: the hash can be empty at first, so look it up by id.
    let hash = res.hash as `0x${string}` | "";
    for (let i = 0; !hash && res.transaction_id && i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const t = await privy.transactions().get(res.transaction_id);
      if (t.status === "failed" || t.status === "execution_reverted" || t.status === "provider_error") throw new Error(`transaction ${t.status}`);
      hash = (t.transaction_hash ?? "") as `0x${string}` | "";
    }
    if (!hash) return { ...job, status: "sent", reason: `submitted as ${res.transaction_id}`, timings };
    timings.hash = Date.now() - t0;
    await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
    timings.mined = Date.now() - t0;
    return { ...job, status: "sent", hash, timings };
  } catch (err) {
    return { ...job, status: "failed", reason: err instanceof Error ? err.message.split("\n")[0] : String(err) };
  }
}
