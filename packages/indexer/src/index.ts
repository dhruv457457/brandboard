// Mirrors PatchedMarket events into Supabase.
//
// Strategy: store every log as history (bids, payouts, disputes, receipts, notifications), and for
// every listing a batch touched, re-read the authoritative state from the contract (listing, patches,
// milestones) and upsert it. The database can never drift from the chain, and replaying a range is
// always safe (all writes are idempotent).
import { createPublicClient, decodeEventLog, hexToString, http, type Log, type PublicClient } from "viem";
import type { Sql } from "postgres";
import { DEPLOYMENTS, monadMainnet, monadTestnet, patchedMarketAbi } from "@patched/shared";

const CHAINS = { 10143: monadTestnet, 143: monadMainnet } as const;
export type IndexedChainId = keyof typeof CHAINS;

const MAX_RANGE = 1000n; // Monad RPC limit for eth_getLogs
// Monad has single-slot finality (~0.8s), so the latest block is safe to index.
const CONFIRMATIONS = 0n;

type Decoded = { eventName: string; args: Record<string, unknown> };
type MarketLog = Log & { blockTimestamp?: `0x${string}` };

export interface SyncOptions {
  sql: Sql;
  chainId: IndexedChainId;
  rpcUrl: string;
  /** Stop after this many blocks so a serverless call stays within its time limit. */
  maxBlocks?: bigint;
}

export interface SyncResult {
  fromBlock: bigint;
  toBlock: bigint;
  logs: number;
  listingsRefreshed: number;
  caughtUp: boolean;
}

export async function syncChain({ sql, chainId, rpcUrl, maxBlocks = 20_000n }: SyncOptions): Promise<SyncResult> {
  const deployment = DEPLOYMENTS[chainId];
  if (!deployment) throw new Error(`no deployment for chain ${chainId}`);
  const client = createPublicClient({ chain: CHAINS[chainId], transport: http(rpcUrl) }) as PublicClient;

  const [cursor] = await sql<{ last_block: string }[]>`
    select last_block from public.indexer_cursors where chain_id = ${chainId}`;
  const start = cursor ? BigInt(cursor.last_block) + 1n : BigInt(deployment.deployBlock);
  const head = (await client.getBlockNumber()) - CONFIRMATIONS;
  const end = head < start + maxBlocks - 1n ? head : start + maxBlocks - 1n;
  if (end < start) return { fromBlock: start, toBlock: start - 1n, logs: 0, listingsRefreshed: 0, caughtUp: true };

  let logCount = 0;
  let refreshed = 0;
  for (let from = start; from <= end; from += MAX_RANGE) {
    const to = from + MAX_RANGE - 1n < end ? from + MAX_RANGE - 1n : end;
    const logs = (await client.getLogs({ address: deployment.market, fromBlock: from, toBlock: to })) as MarketLog[];
    const touched = new Set<bigint>();
    await Promise.all(logs.map((l) => blockTime(l, client))); // warm the cache in parallel

    await sql.begin(async (tx) => {
      for (const log of logs) {
        const decoded = decode(log);
        if (!decoded) continue;
        await handle(tx as unknown as Sql, chainId, log, decoded, touched, client);
      }
      for (const id of touched) await refreshListing(tx as unknown as Sql, client, chainId, deployment.market, id);
      await tx`
        insert into public.indexer_cursors (chain_id, last_block) values (${chainId}, ${to.toString()})
        on conflict (chain_id) do update set last_block = excluded.last_block, updated_at = now()`;
    });
    logCount += logs.length;
    refreshed += touched.size;
  }
  return { fromBlock: start, toBlock: end, logs: logCount, listingsRefreshed: refreshed, caughtUp: end === head };
}

function decode(log: MarketLog): Decoded | null {
  try {
    const d = decodeEventLog({ abi: patchedMarketAbi, data: log.data, topics: log.topics });
    return { eventName: d.eventName, args: (d.args ?? {}) as Record<string, unknown> };
  } catch {
    return null; // not one of our events (e.g. AccessControl internals we don't mirror)
  }
}

const lc = (a: unknown) => (typeof a === "string" ? a.toLowerCase() : null);
const num = (v: unknown) => (v === undefined || v === null ? null : String(v));
const toDate = (s: unknown) => new Date(Number(s) * 1000);
const b32 = (v: unknown) => {
  try {
    return hexToString(v as `0x${string}`, { size: 32 }).replace(/\0+$/, "");
  } catch {
    return "";
  }
};

// One getBlock per block, not per log (a batch often has many logs in few blocks).
const blockTimes = new Map<bigint, Promise<Date>>();
async function blockTime(log: MarketLog, client: PublicClient): Promise<Date> {
  if (log.blockTimestamp) return new Date(Number(BigInt(log.blockTimestamp)) * 1000);
  const n = log.blockNumber!;
  if (!blockTimes.has(n)) {
    if (blockTimes.size > 5000) blockTimes.clear();
    blockTimes.set(n, client.getBlock({ blockNumber: n }).then((b) => new Date(Number(b.timestamp) * 1000)));
  }
  return blockTimes.get(n)!;
}

async function handle(
  sql: Sql,
  chainId: number,
  log: MarketLog,
  { eventName, args: a }: Decoded,
  touched: Set<bigint>,
  client: PublicClient,
) {
  const tx = log.transactionHash!;
  const idx = log.logIndex!;
  const block = log.blockNumber!.toString();
  const time = await blockTime(log, client);
  const jsonArgs = JSON.parse(JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));

  await sql`
    insert into public.chain_events (chain_id, tx_hash, log_index, block_number, block_time, event_name, args)
    values (${chainId}, ${tx}, ${idx}, ${block}, ${time}, ${eventName}, ${sql.json(jsonArgs)})
    on conflict do nothing`;

  if ("listingId" in a) touched.add(a.listingId as bigint);

  switch (eventName) {
    case "EventCreated":
      await sql`
        insert into public.patched_events (chain_id, event_id, name, starts_at, ends_at, active)
        values (${chainId}, ${Number(a.eventId)}, ${b32(a.name)}, ${toDate(a.startsAt)}, ${toDate(a.endsAt)}, true)
        on conflict (chain_id, event_id) do update set name = excluded.name, starts_at = excluded.starts_at, ends_at = excluded.ends_at`;
      break;
    case "EventActiveSet":
      await sql`update public.patched_events set active = ${Boolean(a.active)} where chain_id = ${chainId} and event_id = ${Number(a.eventId)}`;
      break;
    case "BidPlaced":
      await sql`
        insert into public.bids (chain_id, tx_hash, log_index, listing_id, patch_id, bidder, amount, prev_bidder, prev_amount, block_number, block_time)
        values (${chainId}, ${tx}, ${idx}, ${num(a.listingId)}, ${Number(a.patchId)}, ${lc(a.bidder)}, ${num(a.amount)},
                ${a.prevBidder === "0x0000000000000000000000000000000000000000" ? null : lc(a.prevBidder)}, ${num(a.prevAmount)}, ${block}, ${time})
        on conflict do nothing`;
      break;
    case "PatchBought":
      await sql`update public.bids set is_buy_now = true where chain_id = ${chainId} and tx_hash = ${tx}`;
      break;
    case "Refunded":
      await notify(sql, lc(a.to)!, "outbid_refund", { amount: num(a.amount), pushed: a.pushed, tx });
      break;
    case "BidForwarded":
      await notify(sql, lc(a.bidder)!, "bid_forwarded", {
        listingId: num(a.listingId), patchId: Number(a.patchId), amount: num(a.amount), reason: a.reason, tx,
      });
      break;
    case "Disputed":
      await sql`
        insert into public.disputes (chain_id, listing_id, milestone, patch_id, holder, reason_uri, created_at)
        values (${chainId}, ${num(a.listingId)}, ${Number(a.milestone)}, ${Number(a.patchId)}, ${lc(a.holder)}, ${String(a.reasonURI ?? "")}, ${time})
        on conflict do nothing`;
      break;
    case "DisputeResolved":
      await sql`
        update public.disputes set resolved = true, to_creator = ${num(a.toCreator)}, to_holder = ${num(a.toHolder)}
        where chain_id = ${chainId} and listing_id = ${num(a.listingId)} and milestone = ${Number(a.milestone)} and patch_id = ${Number(a.patchId)}`;
      await payout(sql, chainId, tx, idx, a.listingId, "dispute", Number(a.milestone), a.toCreator, 0n, time);
      break;
    case "MilestoneReleased":
      await payout(sql, chainId, tx, idx, a.listingId, "milestone", Number(a.milestone), a.toCreator, a.fee, time);
      break;
    case "ListingFailed":
      await payout(sql, chainId, tx, idx, a.listingId, "refund", Number(a.atMilestone), a.refunded, 0n, time);
      break;
    case "ListingCompleted":
      await payout(sql, chainId, tx, idx, a.listingId, "bond", null, a.bondReturned, 0n, time);
      break;
    case "ResaleListed":
      await sql`update public.receipts set resale_price = ${num(a.price)} where chain_id = ${chainId} and token_id = ${num(a.tokenId)}`;
      break;
    case "ResaleCancelled":
      await sql`update public.receipts set resale_price = null where chain_id = ${chainId} and token_id = ${num(a.tokenId)}`;
      break;
    case "ResaleBought": {
      const tokenId = BigInt(a.tokenId as bigint);
      await sql`update public.receipts set owner = ${lc(a.buyer)}, resale_price = null where chain_id = ${chainId} and token_id = ${tokenId.toString()}`;
      await payout(sql, chainId, tx, idx, tokenId >> 8n, "royalty", null, a.royalty, 0n, time);
      touched.add(tokenId >> 8n);
      break;
    }
  }
}

async function payout(
  sql: Sql, chainId: number, tx: string, idx: number, listingId: unknown,
  kind: string, milestone: number | null, amount: unknown, fee: unknown, time: Date,
) {
  await sql`
    insert into public.payouts (chain_id, tx_hash, log_index, listing_id, kind, milestone, amount, fee, block_time)
    values (${chainId}, ${tx}, ${idx}, ${num(listingId)}, ${kind}, ${milestone}, ${num(amount)}, ${num(fee)}, ${time})
    on conflict do nothing`;
}

async function notify(sql: Sql, wallet: string, kind: string, payload: Record<string, unknown>) {
  await sql`insert into public.notifications (wallet, kind, payload) values (${wallet}, ${kind}, ${sql.json(JSON.parse(JSON.stringify(payload)))})`;
}

/** Re-read a listing from the contract and upsert listing, patches, milestones and receipts. */
async function refreshListing(sql: Sql, client: PublicClient, chainId: number, market: `0x${string}`, id: bigint) {
  const [L, patches] = await Promise.all([
    client.readContract({ address: market, abi: patchedMarketAbi, functionName: "getListing", args: [id] }),
    client.readContract({ address: market, abi: patchedMarketAbi, functionName: "getPatches", args: [id] }),
  ]);
  if (L.creator === "0x0000000000000000000000000000000000000000") return;
  const [created] = await sql<{ block_number: string }[]>`
    select min(block_number)::text as block_number from public.chain_events
    where chain_id = ${chainId} and event_name = 'ListingCreated' and (args->>'listingId')::numeric = ${id.toString()}`;
  const [meta] = await sql<{ metadata_uri: string }[]>`
    select args->>'metadataURI' as metadata_uri from public.chain_events
    where chain_id = ${chainId} and event_name = 'ListingCreated' and (args->>'listingId')::numeric = ${id.toString()} limit 1`;

  await sql`
    insert into public.listings (chain_id, listing_id, creator, event_id, surface, status, bidding_ends_at, hard_ends_at,
      patch_count, bond, total_escrow, sold_mask, next_milestone, metadata_uri, metadata_hash, created_block, updated_at)
    values (${chainId}, ${id.toString()}, ${L.creator.toLowerCase()}, ${L.eventId}, ${L.surface}, ${L.status},
      ${toDate(L.biddingEndsAt)}, ${toDate(L.hardEndsAt)}, ${L.patchCount}, ${L.bond.toString()}, ${L.totalEscrow.toString()},
      ${L.soldMask}, ${L.nextMilestone}, ${meta?.metadata_uri ?? ""}, ${L.metadataHash}, ${created?.block_number ?? "0"}, now())
    on conflict (chain_id, listing_id) do update set
      status = excluded.status, bidding_ends_at = excluded.bidding_ends_at, total_escrow = excluded.total_escrow,
      sold_mask = excluded.sold_mask, next_milestone = excluded.next_milestone, updated_at = now()`;

  for (let i = 0; i < patches.length; i++) {
    const p = patches[i];
    const bidder = p.topBidder === "0x0000000000000000000000000000000000000000" ? null : p.topBidder.toLowerCase();
    await sql`
      insert into public.patches (chain_id, listing_id, patch_id, label, floor, buy_now, top_bid, top_bidder, bought, bid_count, updated_at)
      values (${chainId}, ${id.toString()}, ${i}, ${b32(p.label)}, ${p.floor.toString()}, ${p.buyNow.toString()},
        ${p.topBid.toString()}, ${bidder}, ${p.bought},
        (select count(*) from public.bids b where b.chain_id = ${chainId} and b.listing_id = ${id.toString()} and b.patch_id = ${i}), now())
      on conflict (chain_id, listing_id, patch_id) do update set
        top_bid = excluded.top_bid, top_bidder = excluded.top_bidder, bought = excluded.bought,
        bid_count = excluded.bid_count, updated_at = now()`;
    // receipts exist once bidding closed and the patch was won
    if ((L.soldMask & (1 << i)) !== 0 && bidder) {
      await sql`
        insert into public.receipts (chain_id, token_id, listing_id, patch_id, owner)
        values (${chainId}, ${((id << 8n) | BigInt(i)).toString()}, ${id.toString()}, ${i}, ${bidder})
        on conflict do nothing`;
    }
  }

  for (let m = 0; m < L.milestoneCount; m++) {
    const ms = await client.readContract({ address: market, abi: patchedMarketAbi, functionName: "getMilestone", args: [id, m] });
    await sql`
      insert into public.milestones (chain_id, listing_id, idx, bps, deadline, status, review_ends_at, disputed_mask, resolved_mask, proof_hash, proof_uri)
      values (${chainId}, ${id.toString()}, ${m}, ${L.milestoneBps[m]}, ${toDate(L.deadlines[m])}, ${ms.status},
        ${ms.reviewEndsAt ? toDate(ms.reviewEndsAt) : null}, ${ms.disputedMask}, ${ms.resolvedMask},
        ${ms.proofHash === "0x0000000000000000000000000000000000000000000000000000000000000000" ? null : ms.proofHash},
        (select args->>'proofURI' from public.chain_events where chain_id = ${chainId} and event_name = 'ProofSubmitted'
           and (args->>'listingId')::numeric = ${id.toString()} and (args->>'milestone')::int = ${m} order by block_number desc limit 1))
      on conflict (chain_id, listing_id, idx) do update set
        status = excluded.status, review_ends_at = excluded.review_ends_at, disputed_mask = excluded.disputed_mask,
        resolved_mask = excluded.resolved_mask, proof_hash = excluded.proof_hash, proof_uri = excluded.proof_uri`;
  }
}
