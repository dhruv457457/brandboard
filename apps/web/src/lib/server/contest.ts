import "server-only";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "@patched/shared";
import { CHAIN_ID } from "@/lib/config";
import { CONTEST, CONTEST_EVENT_SLUG, DEADLINE, OPENS, type ContestData, type ContestSteps, type ContestWinner, type MyEntry, type PublicEntry, type TrackId } from "@/lib/contest";
import type { SessionUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

interface EntryRow {
  id: string;
  privy_did: string;
  profile_id: string | null;
  wallet: string | null;
  x_handle: string;
  email: string | null;
  telegram: string;
  tracks: string[];
  post_url: string | null;
  feedback_url: string | null;
  feedback_text: string | null;
  joined_telegram: boolean;
  valid: boolean | null;
  created_at: string;
  updated_at: string;
}

const lc = (s: string) => s.toLowerCase();

/** The contest's event on the chain this site runs on (found by slug, so it follows the deployment). */
export async function contestEvent() {
  const { data } = await supabaseAdmin().from("patched_events").select("event_id, name, slug").eq("chain_id", CHAIN_ID).eq("slug", CONTEST_EVENT_SLUG).maybeSingle();
  return data ? { id: Number(data.event_id), slug: String(data.slug), name: String(data.name) } : null;
}

/** Entries that count for the draw, oldest first: not marked invalid, and in the lucky-draw track. */
export async function drawEntries() {
  const { data } = await supabaseAdmin().from("contest_entries").select("id, x_handle, tracks, valid, created_at").eq("contest", CONTEST)
    .order("created_at").order("id").limit(5000);
  return (data ?? []).filter((e) => e.valid !== false && (e.tracks as string[]).includes("lucky")).map((e) => ({ id: String(e.id), handle: String(e.x_handle) }));
}

/** Live counters for the contest event, and whether this wallet has done a real action there since the contest opened. */
async function eventNumbers(eventId: number | null, wallet: string | null) {
  const db = supabaseAdmin();
  if (eventId === null) return { stats: { listings: 0, bids: 0, creators: 0, spots: 0 }, action: { done: false, what: null as string | null } };
  const since = new Date(OPENS).toISOString();
  const { data: listings } = await db.from("listings").select("listing_id, creator").eq("chain_id", CHAIN_ID).eq("event_id", eventId).limit(1000);
  const ids = (listings ?? []).map((l) => Number(l.listing_id));
  const [bids, spots, posts] = await Promise.all([
    ids.length ? db.from("bids").select("listing_id, bidder, block_time").eq("chain_id", CHAIN_ID).in("listing_id", ids).limit(5000) : { data: [] as { listing_id: number; bidder: string; block_time: string }[] },
    db.from("spots").select("spotter, block_time").eq("chain_id", CHAIN_ID).eq("event_id", eventId).limit(2000),
    db.from("posts").select("author, created_at, profiles:author(wallet)").eq("chain_id", CHAIN_ID).eq("event_id", eventId).eq("hidden", false).not("spotted_wallet", "is", null).limit(2000),
  ]);
  const creators = new Set((listings ?? []).map((l) => lc(String(l.creator))));
  const stats = { listings: ids.length, bids: (bids.data ?? []).length, creators: creators.size, spots: Math.max((spots.data ?? []).length, (posts.data ?? []).length) };
  let what: string | null = null;
  if (wallet) {
    const w = lc(wallet);
    if ((listings ?? []).some((l) => lc(String(l.creator)) === w)) what = "listed a fit";
    else if ((bids.data ?? []).some((b) => lc(b.bidder) === w && b.block_time >= since)) what = "placed a bid";
    else if ((spots.data ?? []).some((s) => lc(s.spotter) === w && s.block_time >= since)) what = "spotted a creator";
    else if ((posts.data ?? []).some((p) => { const pr = (p as { profiles?: { wallet?: string | null } | { wallet?: string | null }[] | null }).profiles; const x = Array.isArray(pr) ? pr[0] : pr; return !!x?.wallet && lc(x.wallet) === w && p.created_at >= since; })) what = "posted a Spotted photo";
  }
  return { stats, action: { done: what !== null, what } };
}

const toMine = (r: EntryRow): MyEntry => ({
  email: r.email, telegram: r.telegram, tracks: r.tracks as TrackId[], postUrl: r.post_url, feedbackUrl: r.feedback_url,
  feedbackText: r.feedback_text, joinedTelegram: r.joined_telegram, valid: r.valid, updatedAt: r.updated_at,
});

/** Everything the contest page shows. `user` is the signed-in person, if any. */
export async function fetchContest(user: SessionUser | null): Promise<ContestData> {
  const db = supabaseAdmin();
  const event = await contestEvent();
  const [{ data: rows }, { data: winnerRows }, numbers] = await Promise.all([
    db.from("contest_entries").select("id, privy_did, profile_id, wallet, x_handle, email, telegram, tracks, post_url, feedback_url, feedback_text, joined_telegram, valid, created_at, updated_at")
      .eq("contest", CONTEST).order("created_at").order("id").limit(5000),
    db.from("contest_winners").select("track, x_handle, note, tx_hash").eq("contest", CONTEST),
    eventNumbers(event?.id ?? null, user?.wallet ?? null),
  ]);
  const all = (rows ?? []) as EntryRow[];
  // Public view: handle, avatar and tracks of every entry that has not been ruled out.
  const shown = all.filter((e) => e.valid !== false);
  const profileIds = [...new Set(shown.map((e) => e.profile_id).filter(Boolean))] as string[];
  const { data: profiles } = profileIds.length ? await db.from("profiles").select("id, avatar_url").in("id", profileIds) : { data: [] as { id: string; avatar_url: string | null }[] };
  const avatar = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));
  const entries: PublicEntry[] = shown.map((e) => ({ handle: e.x_handle, avatar: (e.profile_id && avatar.get(e.profile_id)) || null, tracks: e.tracks as TrackId[] }));

  const mine = user ? all.find((e) => e.privy_did === user.did) : undefined;
  const steps: ContestSteps = { x: Boolean(user?.xHandle), action: numbers.action };
  const winners: ContestWinner[] = (winnerRows ?? []).map((w) => ({ track: w.track as TrackId, handle: String(w.x_handle), note: w.note as string | null, tx: w.tx_hash as string | null }));
  return {
    open: Date.now() < DEADLINE,
    deadline: DEADLINE,
    event,
    stats: { entries: shown.length, ...numbers.stats },
    entries,
    winners,
    me: user ? { xHandle: user.xHandle, email: user.emails[0] ?? null, steps, entry: mine ? toMine(mine) : null } : null,
  };
}

let cached: { number: number; hash: string; time: number } | null = null;

/**
 * The first Monad testnet block after the deadline: its number and hash. Null until such a block exists.
 * Found by binary search on block timestamps (Monad has roughly two blocks a second), then kept.
 */
export async function drawBlock() {
  if (cached) return cached;
  const client = createPublicClient({ chain: monadTestnet, transport: http(process.env.MONAD_TESTNET_RPC_URL) });
  const deadlineSec = BigInt(Math.floor(DEADLINE / 1000));
  const latest = await client.getBlock();
  if (latest.timestamp <= deadlineSec) return null;
  let lo = 0n;
  let hi = latest.number; // invariant: block `hi` is after the deadline, block `lo` is not
  const first = await client.getBlock({ blockNumber: 1n }).catch(() => null);
  if (first && first.timestamp > deadlineSec) return null;
  while (hi - lo > 1n) {
    const mid = (lo + hi) / 2n;
    const b = await client.getBlock({ blockNumber: mid });
    if (b.timestamp > deadlineSec) hi = mid;
    else lo = mid;
  }
  const block = await client.getBlock({ blockNumber: hi });
  cached = { number: Number(block.number), hash: block.hash!, time: Number(block.timestamp) * 1000 };
  return cached;
}
