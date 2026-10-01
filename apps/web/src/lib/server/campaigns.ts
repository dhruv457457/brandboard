import "server-only";
import { encodeFunctionData, erc20Abi, maxUint256 } from "viem";
import { patchedMarketAbi, type ListingMetadata } from "@patched/shared";
import { CHAIN_ID, MARKET, USDC, serverClient } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";
import { formatUsdc } from "@/lib/format";
import { BID_FOR_ABI, ERC20_SPEND_ABI, campaignAggregation, campaignRules, offerAdvanceRule } from "@/lib/market/campaignPolicy";
import { budgetCheck, createAggregation, isPolicyViolation, keyOwner, privyServer, sendFromServerWallet } from "./privy";

export interface CampaignRow {
  id: string;
  chain_id: number;
  brand: string;
  event_id: number;
  budget: number;
  max_per_spot: number;
  goal: "most" | "prime";
  ends_at: string;
  wallet_id: string;
  wallet_address: string;
  policy_id: string;
  /** The Privy aggregation capping the campaign's total; null for campaigns from before it existed. */
  aggregation_id: string | null;
  status: "funding" | "active" | "paused" | "ending" | "ended";
  /** "x_offer": an offer to one X account (Patch anyone on X); it only bids on that person's listings. */
  kind: "event" | "x_offer";
  target_x_handle: string | null;
  target_wallet: string | null;
  target_privy_did: string | null;
  advance: number | string | null;
  advanced_at: string | null;
  claimed_at: string | null;
}

/** The person an offer is for, as stored on the campaign row. */
export interface OfferTarget {
  xId: string;
  handle: string;
  name: string;
  avatar: string | null;
  wallet: string;
  privyDid: string;
  pregenerated: boolean;
  message: string | null;
  /** The listing stake the offer may pay them (6-decimal USDC). */
  advance: bigint;
}

const SPONSORED = process.env.KEEPER_GAS_SPONSORED !== "false";
/** Bids a campaign places per keeper tick, so one tick never spends the whole budget on a single rush. */
const BIDS_PER_TICK = 3;

/**
 * A new campaign: a Privy aggregation that adds up its bids, one Privy policy written from the brand's settings (per-bid
 * cap, end time, and the aggregation kept within the budget), and one Privy server wallet that carries it. All owned by
 * our authorization key. The brand funds the wallet next, in one transfer. With `offer`, it's an offer to one X account:
 * the policy also lets it pay that person's listing stake, and the keeper only bids on their listings.
 */
export async function createCampaign(input: { brand: string; did: string; eventId: number; budget: bigint; maxPerSpot: bigint; goal: "most" | "prime"; endsAt: number; offer?: OfferTarget }) {
  const privy = privyServer();
  const owner = keyOwner();
  const o = input.offer;
  // Privy names are short: "Campaign 0xabcd12 e1 c10143", "Offer 0xabcd12 @dhruv c10143".
  const label = o ? `Offer ${input.brand.slice(0, 8)} @${o.handle} c${CHAIN_ID}` : `Campaign ${input.brand.slice(0, 8)} e${input.eventId} c${CHAIN_ID}`;
  const aggregationId = await createAggregation(campaignAggregation({
    chainId: CHAIN_ID, market: MARKET, name: `${label} spend`, windowSeconds: input.endsAt - Date.now() / 1000 + 3600,
  }));
  const rules = [
    ...campaignRules({
      chainId: CHAIN_ID, market: MARKET, usdc: USDC, brand: input.brand, maxPerSpot: input.maxPerSpot, endsAt: input.endsAt,
      aggregationId, budget: input.budget,
    }),
    ...(o ? [offerAdvanceRule({ chainId: CHAIN_ID, usdc: USDC, target: o.wallet, advance: o.advance })] : []),
  ];
  const policy = await privy.policies().create({ version: "1.0", name: label.slice(0, 49), chain_type: "ethereum", owner, rules });
  const wallet = await privy.wallets().create({
    chain_type: "ethereum",
    display_name: o ? `Offer to @${o.handle}`.slice(0, 49) : `Campaign ${input.brand.slice(0, 8)}`,
    owner,
    policy_ids: [policy.id],
  });
  const { data, error } = await supabaseAdmin().from("brand_campaigns").insert({
    chain_id: CHAIN_ID,
    brand: input.brand,
    privy_did: input.did,
    event_id: input.eventId,
    budget: input.budget.toString(),
    max_per_spot: input.maxPerSpot.toString(),
    goal: input.goal,
    ends_at: new Date(input.endsAt * 1000).toISOString(),
    wallet_id: wallet.id,
    wallet_address: wallet.address.toLowerCase(),
    policy_id: policy.id,
    aggregation_id: aggregationId,
    ...(o ? {
      kind: "x_offer",
      target_x_id: o.xId,
      target_x_handle: o.handle,
      target_x_name: o.name,
      target_x_avatar: o.avatar,
      target_wallet: o.wallet.toLowerCase(),
      target_privy_did: o.privyDid,
      pregenerated: o.pregenerated,
      message: o.message,
      advance: o.advance.toString(),
    } : {}),
  }).select("id, wallet_address, policy_id").single();
  if (error) throw error;
  return data;
}

async function log(campaignId: string, row: { kind: string; text: string; amount?: bigint; listing_id?: number; patch_id?: number; tx_hash?: string | null }) {
  await supabaseAdmin().from("brand_campaign_actions").insert({
    campaign_id: campaignId,
    kind: row.kind,
    text: row.text,
    amount: row.amount?.toString() ?? null,
    listing_id: row.listing_id ?? null,
    patch_id: row.patch_id ?? null,
    tx_hash: row.tx_hash ?? null,
  });
}

let running: Promise<void> | null = null;

/**
 * One pass over every running campaign: wait for funding, approve the market once, bid on the best open spots at
 * the event within the rules, and when time is up send what's left back to the brand. Concurrent callers share a run.
 */
export function runCampaigns(): Promise<void> {
  if (!process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY) return Promise.resolve();
  running ??= (async () => {
    const { data } = await supabaseAdmin().from("brand_campaigns").select("*")
      .eq("chain_id", CHAIN_ID).in("status", ["funding", "active", "ending"]).limit(50);
    for (const c of (data ?? []) as CampaignRow[]) {
      try {
        await tick(c);
      } catch (err) {
        console.error("campaign tick failed", c.id, err);
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

async function tick(c: CampaignRow) {
  const client = serverClient();
  const wallet = c.wallet_address as `0x${string}`;
  const brand = c.brand as `0x${string}`;
  const balance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
  const db = supabaseAdmin();

  if (c.status === "funding") {
    if (balance === 0n) return;
    await db.from("brand_campaigns").update({ status: "active" }).eq("id", c.id);
    await log(c.id, { kind: "funded", text: `Funded with ${formatUsdc(Number(balance) / 1e6)}. Bidding starts now.`, amount: balance });
    c.status = "active";
  }

  // Time's up (or the brand ended it): send the rest back.
  if (c.status === "ending" || Date.now() > new Date(c.ends_at).getTime()) {
    if (balance > 0n) {
      const data = encodeFunctionData({ abi: ERC20_SPEND_ABI, functionName: "transfer", args: [brand, balance] });
      const { hash } = await sendFromServerWallet(c.wallet_id, { to: USDC, chainId: CHAIN_ID, data },
        { idempotencyKey: `patched:${CHAIN_ID}:campaign:${c.id}:return:${balance}`, sponsor: SPONSORED, signed: true });
      await log(c.id, { kind: "returned", text: `Sent the unspent ${formatUsdc(Number(balance) / 1e6)} back to your wallet.`, amount: balance, tx_hash: hash });
    }
    await db.from("brand_campaigns").update({ status: "ended" }).eq("id", c.id);
    await log(c.id, { kind: "ended", text: "The campaign ended." });
    return;
  }
  if (c.status !== "active" || balance === 0n) return;

  // The market pulls USDC from the campaign wallet: approve it once, for everything.
  const allowance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [wallet, MARKET] });
  if (allowance < balance) {
    const data = encodeFunctionData({ abi: ERC20_SPEND_ABI, functionName: "approve", args: [MARKET, maxUint256] });
    const { hash } = await sendFromServerWallet(c.wallet_id, { to: USDC, chainId: CHAIN_ID, data },
      { idempotencyKey: `patched:${CHAIN_ID}:campaign:${c.id}:approve`, sponsor: SPONSORED, signed: true });
    if (hash) await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
  }

  const picks = await pickSpots(c, balance);
  let left = balance;
  let checked = false;
  // An offer is for one spot on one person: one bid at a time.
  for (const p of picks.slice(0, c.kind === "x_offer" ? 1 : BIDS_PER_TICK)) {
    if (p.amount > left) continue;
    const data = encodeFunctionData({ abi: BID_FOR_ABI, functionName: "bidFor", args: [brand, BigInt(p.listingId), p.patchId, p.amount] });
    try {
      // Simulate first: a bid that would revert (outbid a moment ago, bidding closed) is skipped before Privy counts it
      // toward the budget.
      try {
        await client.call({ account: wallet, to: MARKET, data });
      } catch (err) {
        console.warn(`campaign ${c.id}: skipped a bid on ${p.listingId}/${p.patchId}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        continue;
      }
      if (c.aggregation_id) {
        // Privy's running total catches up a few seconds after each check: space this campaign's checks out so a bid
        // is never checked against a stale total.
        if (checked) await new Promise((r) => setTimeout(r, AGGREGATION_GAP_MS));
        checked = true;
        await budgetCheck(c.wallet_id, { to: MARKET, data, chainId: CHAIN_ID });
      }
      const { hash } = await sendFromServerWallet(c.wallet_id, { to: MARKET, chainId: CHAIN_ID, data },
        { idempotencyKey: `patched:${CHAIN_ID}:campaign:${c.id}:${p.listingId}:${p.patchId}:${p.topBid}`, sponsor: SPONSORED, signed: true });
      left -= p.amount;
      await log(c.id, {
        kind: "bid",
        text: p.buyNow
          ? `Bought ${p.label} (${p.title}) outright for ${formatUsdc(Number(p.amount) / 1e6)}.`
          : `Bid ${formatUsdc(Number(p.amount) / 1e6)} on ${p.label} (${p.title}).`,
        amount: p.amount, listing_id: p.listingId, patch_id: p.patchId, tx_hash: hash,
      });
      // An offer that bought its spot is done: what's left goes back to the brand on the next tick.
      if (c.kind === "x_offer" && p.buyNow) {
        await db.from("brand_campaigns").update({ status: "ending" }).eq("id", c.id);
        await log(c.id, { kind: "skip", text: `@${c.target_x_handle} is patched. Anything left goes back to you.` });
        break;
      }
    } catch (err) {
      if (isPolicyViolation(err)) {
        const overBudget = c.aggregation_id && (await spentSoFar(c.id)) + p.amount > BigInt(c.budget);
        await log(c.id, {
          kind: "blocked",
          text: overBudget
            ? `Privy stopped a ${formatUsdc(Number(p.amount) / 1e6)} bid on ${p.label}: it would take the campaign past its ${formatUsdc(Number(c.budget) / 1e6)} budget.`
            : `Privy blocked a ${formatUsdc(Number(p.amount) / 1e6)} bid on ${p.label}: outside your rules.`,
          amount: p.amount, listing_id: p.listingId, patch_id: p.patchId,
        });
        if (overBudget) break;
      } else {
        console.error("campaign bid failed", c.id, err);
      }
    }
  }
}

/** Time Privy needs to add a checked bid to an aggregation's running total (measured: 3 s was enough, 0 s was not). */
const AGGREGATION_GAP_MS = 5_000;

/** What the campaign has bid so far, from its own log. */
async function spentSoFar(campaignId: string): Promise<bigint> {
  const { data } = await supabaseAdmin().from("brand_campaign_actions").select("amount").eq("campaign_id", campaignId).eq("kind", "bid");
  return (data ?? []).reduce((sum, a) => sum + BigInt(a.amount ?? 0), 0n);
}

interface Pick { listingId: number; patchId: number; amount: bigint; topBid: string; label: string; title: string; score: number; buyNow: boolean }

/**
 * Open spots at the campaign's event that the brand doesn't lead yet, priced within the rules. "Most spots" takes the
 * cheapest first; "prime spots" only takes mega and prime spots, the most visible first. An offer only looks at its
 * person's listings and prefers buying a spot outright (its buy-now fits the offer), the biggest first.
 */
async function pickSpots(c: CampaignRow, balance: bigint): Promise<Pick[]> {
  const db = supabaseAdmin();
  const offer = c.kind === "x_offer" && !!c.target_wallet;
  let q = db.from("listing_cards").select("listing_id, creator, metadata")
    .eq("chain_id", CHAIN_ID).eq("event_id", c.event_id).eq("status", 1).gt("bidding_ends_at", new Date().toISOString());
  if (offer) q = q.eq("creator", c.target_wallet!);
  const { data: listings } = await q.limit(40);
  const live = (listings ?? []).filter((l) => l.creator !== c.brand);
  if (!live.length) return [];
  const { data: patches } = await db.from("patches").select("listing_id, patch_id, label, top_bid, top_bidder, bought, buy_now")
    .eq("chain_id", CHAIN_ID).in("listing_id", live.map((l) => l.listing_id));
  const open = (patches ?? []).filter((p) => !p.bought && p.top_bidder !== c.brand);
  const client = serverClient();
  const cap = BigInt(c.max_per_spot);

  const picks = await Promise.all(open.map(async (p): Promise<Pick | null> => {
    const meta = live.find((l) => l.listing_id === p.listing_id)?.metadata as ListingMetadata | null;
    const spot = meta?.patches.find((m) => m.id === p.patch_id);
    const tier = spot?.tier ?? "prime";
    if (!offer && c.goal === "prime" && tier === "mini") return null;
    const base = { listingId: p.listing_id, patchId: p.patch_id, topBid: String(p.top_bid), label: spot?.name ?? p.label, title: meta?.title ?? `listing #${p.listing_id}` };
    const buyNow = BigInt(p.buy_now);
    if (offer && buyNow <= cap && buyNow <= balance) return { ...base, amount: buyNow, buyNow: true, score: -Number(buyNow) - 1e15 };
    const need = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minNextBid", args: [BigInt(p.listing_id), p.patch_id] }).catch(() => null);
    if (need === null || need > cap || need > balance) return null;
    return {
      ...base,
      amount: need,
      buyNow: need >= buyNow,
      // Offers: the biggest bid first. Otherwise cheapest first for reach; for prime, bigger spots first.
      score: offer ? -Number(need) : c.goal === "prime" ? -(spot ? spot.w * spot.h : 0) : Number(need),
    };
  }));
  return picks.filter((p): p is Pick => p !== null).sort((a, b) => a.score - b.score);
}
