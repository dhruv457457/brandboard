import "server-only";
import { CHAIN_ID, EXPLORER } from "@/lib/config";
import { formatShortAddress } from "@/lib/format";
import { fetchListingCards } from "@/lib/market/server";
import { supabase } from "@/lib/supabase";
import type { EventGraph, GBid, GNode, GThread, GraphEvent, GraphEventRow, NodeRole } from "./types";

const ROAD: GraphEvent = { id: 0, slug: null, name: "On the road", banner: null, city: null, startsAt: null, endsAt: null };
const usd = (v: number | string | bigint) => Number(v) / 1e6;
const lc = (s: string) => s.toLowerCase();

interface Person {
  id: string;
  wallet: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_verified_domain: string | null;
}
const PERSON_COLS = "id, wallet, handle, display_name, avatar_url, brand_name, brand_logo_url, brand_verified_domain";

interface BidRow { tx_hash: string; log_index: number; listing_id: number; patch_id: number; bidder: string; amount: number; is_buy_now: boolean; block_time: string }
interface PostRow { id: string; listing_id: number; spotted_wallet: string; author: string; media: unknown; created_at: string; spot_tx: string | null }
interface SpotRow { tx_hash: string; listing_id: number; spotter: string; creator: string; block_time: string }
interface PayeeRow { listing_id: number; payee: string }

/** Events that have something to show, busiest first. Cars (event 0) come as "On the road". */
export async function fetchGraphEvents(): Promise<GraphEventRow[]> {
  const db = supabase();
  const [{ data: events }, { data: rows }] = await Promise.all([
    db.from("patched_events").select("event_id, name, slug, banner_url").eq("chain_id", CHAIN_ID),
    db.from("listing_cards").select("event_id, top_bids_total").eq("chain_id", CHAIN_ID).in("status", [1, 2, 3]).limit(1000),
  ]);
  const agg = new Map<number, { listings: number; escrow: number }>();
  for (const r of rows ?? []) {
    const a = agg.get(Number(r.event_id)) ?? { listings: 0, escrow: 0 };
    a.listings += 1;
    a.escrow += usd(r.top_bids_total ?? 0);
    agg.set(Number(r.event_id), a);
  }
  const out: GraphEventRow[] = [];
  for (const e of events ?? []) {
    const a = agg.get(e.event_id);
    if (a) out.push({ id: e.event_id, slug: e.slug, name: e.name, banner: e.banner_url, listings: a.listings, escrowUsd: a.escrow });
  }
  const road = agg.get(0);
  if (road) out.push({ id: 0, slug: null, name: ROAD.name, banner: null, listings: road.listings, escrowUsd: road.escrow });
  return out.sort((a, b) => b.escrowUsd - a.escrowUsd || b.listings - a.listings);
}

/** The whole graph of one event, built from the indexed tables in a single parallel round. */
export async function fetchEventGraph(eventId: number): Promise<EventGraph | null> {
  const db = supabase();
  let event = ROAD;
  if (eventId !== 0) {
    const { data } = await db.from("patched_events").select("event_id, name, slug, banner_url, city, starts_at, ends_at")
      .eq("chain_id", CHAIN_ID).eq("event_id", eventId).maybeSingle();
    if (!data) return null;
    event = {
      id: data.event_id, slug: data.slug, name: data.name, banner: data.banner_url, city: data.city,
      startsAt: data.starts_at ? new Date(data.starts_at).getTime() : null, endsAt: data.ends_at ? new Date(data.ends_at).getTime() : null,
    };
  }

  const cards = await fetchListingCards({ eventId, statuses: [1, 2, 3], limit: 80 });
  const ids = cards.map((c) => c.id);
  const closedIds = cards.filter((c) => c.status >= 2).map((c) => c.id);

  const [bidsRes, postsRes, receiptsRes, spotsRes, payeesRes] = await Promise.all([
    ids.length
      ? db.from("bids").select("tx_hash, log_index, listing_id, patch_id, bidder, amount, is_buy_now, block_time")
          .eq("chain_id", CHAIN_ID).in("listing_id", ids).order("block_number", { ascending: false }).order("log_index", { ascending: false }).limit(1500)
      : { data: [] as BidRow[] },
    ids.length
      ? db.from("posts").select("id, listing_id, spotted_wallet, author, media, created_at, spot_tx")
          .eq("chain_id", CHAIN_ID).in("listing_id", ids).eq("hidden", false).not("spotted_wallet", "is", null)
          .order("created_at", { ascending: false }).limit(300)
      : { data: [] as PostRow[] },
    closedIds.length
      ? db.from("receipts").select("listing_id, patch_id, owner").eq("chain_id", CHAIN_ID).in("listing_id", closedIds)
      : { data: [] as { listing_id: number; patch_id: number; owner: string }[] },
    // Spots recorded on-chain by PatchSpotter, and who is paid with the creator on a team hoodie.
    ids.length
      ? db.from("spots").select("tx_hash, listing_id, spotter, creator, block_time").eq("chain_id", CHAIN_ID).in("listing_id", ids).order("block_time").limit(500)
      : { data: [] as SpotRow[] },
    ids.length
      ? db.from("listing_payees").select("listing_id, payee").eq("chain_id", CHAIN_ID).in("listing_id", ids)
      : { data: [] as PayeeRow[] },
  ]);
  // Newest first from the database (so a cut-off drops the oldest), oldest first from here on.
  const bidRows = ((bidsRes.data ?? []) as BidRow[]).reverse();
  const postRows = ((postsRes.data ?? []) as PostRow[]).reverse();
  const receipts = receiptsRes.data ?? [];
  const spotRows = (spotsRes.data ?? []) as SpotRow[];
  const payeeRows = (payeesRes.data ?? []) as PayeeRow[];

  // Everyone who appears, looked up once: by wallet, and spotters by profile id.
  const wallets = new Set<string>();
  for (const c of cards) {
    wallets.add(lc(c.creator));
    for (const p of c.patches) if (p.topBidder) wallets.add(lc(p.topBidder));
  }
  for (const b of bidRows) wallets.add(lc(b.bidder));
  for (const r of receipts) wallets.add(lc(r.owner));
  for (const s of spotRows) wallets.add(lc(s.spotter));
  for (const p of payeeRows) wallets.add(lc(p.payee));
  const authorIds = [...new Set(postRows.map((p) => p.author))];
  const [byWalletRes, byIdRes] = await Promise.all([
    wallets.size ? db.from("profiles").select(PERSON_COLS).in("wallet", [...wallets]) : { data: [] as Person[] },
    authorIds.length ? db.from("profiles").select(PERSON_COLS).in("id", authorIds) : { data: [] as Person[] },
  ]);
  const people = new Map<string, Person>();
  for (const p of (byWalletRes.data ?? []) as Person[]) if (p.wallet) people.set(lc(p.wallet), p);
  const authors = new Map(((byIdRes.data ?? []) as Person[]).map((p) => [p.id, p]));

  // Timeline: first listing created -> latest activity.
  const times: number[] = [];
  for (const c of cards) times.push(c.createdAt);
  for (const b of bidRows) times.push(new Date(b.block_time).getTime());
  for (const p of postRows) times.push(new Date(p.created_at).getTime());
  for (const s of spotRows) times.push(new Date(s.block_time).getTime());
  const t0 = times.length ? Math.min(...times) : Date.now() - 86_400_000;
  const t1 = Math.max(times.length ? Math.max(...times) : Date.now(), t0 + 60_000);
  const T = (ms: number) => Math.min(1, Math.max(0, (ms - t0) / (t1 - t0)));

  const nodes = new Map<string, GNode>();
  const profileOf = new Map<string, Person | undefined>();
  const threads: GThread[] = [];
  const hubId = "event";
  nodes.set(hubId, {
    id: hubId, kind: "event", roles: [], label: event.name, name: event.name, image: event.banner, logo: null,
    wallet: null, href: eventId ? `/e/${event.slug ?? event.id}` : "/explore", t: 0, color: 2,
  });

  const KIND_ORDER: NodeRole[] = ["creator", "teammate", "brand", "holder", "spotter"];
  /** One node per wallet; roles add up and the first role in KIND_ORDER is its kind. */
  const wallet = (addr: string | null, authorId: string | null, role: NodeRole, ts: number): GNode => {
    const w = addr ? lc(addr) : null;
    const id = w ? `w:${w}` : `u:${authorId}`;
    let n = nodes.get(id);
    if (!n) {
      const p = (w ? people.get(w) : undefined) ?? (authorId ? authors.get(authorId) : undefined);
      const short = w ? formatShortAddress(w) : "Someone";
      const handle = p?.handle ? `@${p.handle}` : null;
      n = {
        id, kind: role, roles: [], label: short, name: p?.display_name ?? handle ?? short,
        image: p?.avatar_url ?? null, logo: p?.brand_logo_url ?? null, wallet: w, href: w || p?.handle ? `/${p?.handle ?? w}` : null,
        t: ts, color: w ? parseInt(w.slice(2, 4), 16) % 5 : 0, verified: Boolean(p?.brand_verified_domain),
      };
      profileOf.set(id, p);
      nodes.set(id, n);
    }
    if (!n.roles.includes(role)) n.roles.push(role);
    n.t = Math.min(n.t, ts);
    const self = n;
    n.kind = KIND_ORDER.find((r) => self.roles.includes(r)) ?? role;
    return n;
  };

  const spotIdOf = (l: number, p: number) => `p:${l}:${p}`;
  const seenCreator = new Set<string>();
  for (const c of cards) {
    const ct = T(c.createdAt);
    const cn = wallet(c.creator, null, "creator", ct);
    cn.surface = c.surface;
    if (!seenCreator.has(cn.id)) {
      seenCreator.add(cn.id);
      threads.push({ id: `lists:${cn.id}`, kind: "lists", source: cn.id, target: hubId, t: ct });
    }
    const closed = c.status >= 2;
    for (const p of c.patches) {
      const sid = spotIdOf(c.id, p.id);
      const sold = closed && Boolean(p.topBidder);
      const st = Math.min(1, ct + 0.002);
      nodes.set(sid, {
        id: sid, kind: "spot", roles: [], label: p.label, name: `${p.label} on ${c.creatorLabel}`, image: null, logo: p.logoUrl ?? null,
        wallet: null, href: c.href, t: st, color: (c.id + p.id) % 5, creatorId: cn.id, listingId: c.id, patchId: p.id,
        floor: usd(p.floor), buyNow: usd(p.buyNow), won: sold, tokenId: sold ? ((BigInt(c.id) << 8n) | BigInt(p.id)).toString() : undefined,
      });
      threads.push({ id: `has:${sid}`, kind: "has", source: cn.id, target: sid, t: st });
    }
  }

  // Bids in block order; every bidder is a brand node.
  const bids: GBid[] = [];
  const lastBy = new Map<string, GBid>();
  for (const b of bidRows) {
    const sid = spotIdOf(b.listing_id, b.patch_id);
    if (!nodes.has(sid)) continue;
    const t = T(new Date(b.block_time).getTime());
    const who = wallet(b.bidder, null, "brand", t);
    const bid: GBid = { id: `${b.tx_hash}:${b.log_index}`, spot: sid, who: who.id, amount: usd(b.amount), t, buyNow: b.is_buy_now, tx: b.tx_hash };
    bids.push(bid);
    lastBy.set(sid, bid);
  }
  // The indexed patch row is the truth for who leads: if the bid list was cut short, finish it with that state.
  for (const c of cards) {
    for (const p of c.patches) {
      if (!p.topBidder || p.topBid === 0n) continue;
      const sid = spotIdOf(c.id, p.id);
      const last = lastBy.get(sid);
      const who = wallet(p.topBidder, null, "brand", last?.t ?? T(c.createdAt));
      if (!last || last.who !== who.id || last.amount !== usd(p.topBid)) {
        bids.push({ id: `final:${sid}`, spot: sid, who: who.id, amount: usd(p.topBid), t: 1, buyNow: p.bought, tx: "" });
      }
    }
  }

  // Resale: the receipt's owner is not the bidder who won it.
  for (const r of receipts) {
    const sid = spotIdOf(r.listing_id, r.patch_id);
    const card = cards.find((c) => c.id === r.listing_id);
    const leader = card?.patches.find((p) => p.id === r.patch_id)?.topBidder;
    if (!card || !leader || lc(r.owner) === lc(leader)) continue;
    const holder = wallet(r.owner, null, "holder", 1);
    threads.push({ id: `holds:${sid}`, kind: "holds", source: holder.id, target: sid, t: 1 });
  }

  // Spotted photos: spotter -> the creator they spotted.
  for (const p of postRows) {
    const author = authors.get(p.author);
    const target = nodes.get(`w:${lc(p.spotted_wallet)}`);
    const photo = (p.media as { url?: string }[] | null)?.[0]?.url ?? null;
    if (!target || !author) continue;
    const t = T(new Date(p.created_at).getTime());
    const sp = wallet(author.wallet, author.id, "spotter", t);
    if (sp.id === target.id) continue;
    threads.push({ id: `s:${p.id}`, kind: "spotted", source: sp.id, target: target.id, t, photo, tx: p.spot_tx, onchain: Boolean(p.spot_tx) });
  }
  // Spots recorded on-chain with no photo post behind them (someone called the contract directly).
  const postedTx = new Set(postRows.map((p) => p.spot_tx).filter(Boolean));
  for (const s of spotRows) {
    if (postedTx.has(s.tx_hash)) continue;
    const target = nodes.get(`w:${lc(s.creator)}`);
    if (!target) continue;
    const t = T(new Date(s.block_time).getTime());
    const sp = wallet(s.spotter, null, "spotter", t);
    if (sp.id === target.id) continue;
    threads.push({ id: `s:${s.tx_hash}`, kind: "spotted", source: sp.id, target: target.id, t, tx: s.tx_hash, onchain: true });
  }

  // Team hoodies: everyone paid with the creator is a teammate, tied to them by a double thread.
  for (const p of payeeRows) {
    const card = cards.find((c) => c.id === p.listing_id);
    const owner = card ? nodes.get(`w:${lc(card.creator)}`) : undefined;
    if (!card || !owner || lc(p.payee) === lc(card.creator)) continue;
    const mate = wallet(p.payee, null, "teammate", T(card.createdAt));
    const id = `team:${owner.id}:${mate.id}`;
    if (!threads.some((t) => t.id === id)) threads.push({ id, kind: "team", source: owner.id, target: mate.id, t: mate.t });
  }

  // Names and pictures now that every wallet knows all its roles: people by face, brands by logo.
  for (const n of nodes.values()) {
    const p = profileOf.get(n.id);
    if (!p) continue;
    const person = n.roles.includes("creator") || n.roles.includes("teammate") || n.roles.every((r) => r === "spotter");
    if (person) {
      n.name = p.display_name ?? (p.handle ? `@${p.handle}` : n.name);
      n.label = p.handle ? `@${p.handle}` : (p.display_name ?? n.label);
      n.image = p.avatar_url ?? null;
    } else {
      n.name = p.brand_name ?? p.display_name ?? n.name;
      n.label = p.brand_name ?? p.display_name ?? n.label;
      n.image = p.brand_logo_url ?? p.avatar_url ?? null;
    }
  }

  const all = [...nodes.values()];
  return {
    chainId: CHAIN_ID,
    explorer: `${EXPLORER}/tx/`,
    event,
    nodes: all,
    threads,
    bids,
    t0,
    t1,
    stats: {
      creators: all.filter((n) => n.roles.includes("creator")).length,
      spots: all.filter((n) => n.kind === "spot").length,
      brands: all.filter((n) => n.roles.includes("brand") || n.roles.includes("holder")).length,
      spotters: all.filter((n) => n.roles.includes("spotter")).length,
      bids: bids.filter((b) => !b.id.startsWith("final:")).length,
      escrowUsd: cards.reduce((s, c) => s + usd(c.topBidsTotal), 0),
    },
  };
}
