import { notFound } from "next/navigation";
import { CHAIN_ID } from "@/lib/config";
import { formatShortAddress } from "@/lib/format";
import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { supabase } from "@/lib/supabase";
import { EventView, type EventBid, type EventInfo, type Leaderboards } from "./EventView";

// Event pages are cached for 30s and rebuilt in the background; live bids still stream in over Realtime.
export const revalidate = 30;
/** No pages at build time: each one is rendered on its first visit, then cached. */
export async function generateStaticParams() {
  return [];
}

/** Event page. The URL is the event's slug, or its on-chain id (/e/1). */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabase();
  const q = db.from("patched_events").select("event_id, name, slug, starts_at, ends_at, active, city, venue, description, banner_url, links").eq("chain_id", CHAIN_ID);
  const { data: event } = /^\d+$/.test(slug) ? await q.eq("event_id", Number(slug)).maybeSingle() : await q.eq("slug", slug).maybeSingle();
  if (!event) notFound();

  const cards = await fetchListingCards({ eventId: event.event_id, statuses: [1, 2, 3] });
  const ids = cards.map((c) => c.id);
  const { data: bids } = ids.length
    ? await db.from("bids").select("tx_hash, log_index, listing_id, patch_id, bidder, amount, is_buy_now, block_time")
        .eq("chain_id", CHAIN_ID).in("listing_id", ids).order("block_number", { ascending: false }).limit(200)
    : { data: [] as { tx_hash: string; log_index: number; listing_id: number; patch_id: number; bidder: string; amount: number; is_buy_now: boolean; block_time: string }[] };
  const bidders = [...new Set((bids ?? []).map((b) => b.bidder))];
  const { data: brands } = bidders.length
    ? await db.from("profiles").select("wallet, brand_name, brand_logo_url").in("wallet", bidders)
    : { data: [] as { wallet: string; brand_name: string | null; brand_logo_url: string | null }[] };
  const brandOf = (w: string) => brands?.find((b) => b.wallet === w);
  const patchLabel = (lid: number, pid: number) => cards.find((c) => c.id === lid)?.patches.find((p) => p.id === pid)?.label ?? `Spot ${pid + 1}`;

  // Leaderboards: the most sponsored listing, the brand on the most spots, the longest bidding war.
  const top = [...cards].sort((a, b) => Number(b.topBidsTotal - a.topBidsTotal))[0];
  const perBrand = new Map<string, { name: string; logo: string | null; spots: number }>();
  for (const c of cards) {
    for (const p of c.patches) {
      if (!p.topBidder) continue;
      const cur = perBrand.get(p.topBidder) ?? { name: p.brandName ?? formatShortAddress(p.topBidder), logo: p.logoUrl, spots: 0 };
      cur.spots += 1;
      perBrand.set(p.topBidder, cur);
    }
  }
  const brandTop = [...perBrand.values()].sort((a, b) => b.spots - a.spots)[0];
  const wars = new Map<string, number>();
  for (const b of bids ?? []) wars.set(`${b.listing_id}:${b.patch_id}`, (wars.get(`${b.listing_id}:${b.patch_id}`) ?? 0) + 1);
  const [warKey, warBids] = [...wars.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const warCard = warKey ? cards.find((c) => c.id === Number(warKey.split(":")[0])) : undefined;

  const leaderboards: Leaderboards = {
    mostSponsored: top && top.topBidsTotal > 0n ? { title: top.title, who: top.creatorLabel, href: top.href, amount: Number(top.topBidsTotal) / 1e6 } : null,
    topBrand: brandTop ? { name: brandTop.name, logo: brandTop.logo, spots: brandTop.spots } : null,
    biggestWar: warKey && warCard && (warBids ?? 0) > 1
      ? { label: patchLabel(warCard.id, Number(warKey.split(":")[1])), title: warCard.title, href: warCard.href, bids: warBids! }
      : null,
  };

  const wall: EventBid[] = (bids ?? []).slice(0, 12).map((b) => {
    const card = cards.find((c) => c.id === b.listing_id);
    return {
      key: `${b.tx_hash}:${b.log_index}`,
      who: brandOf(b.bidder)?.brand_name ?? formatShortAddress(b.bidder),
      wallet: b.bidder,
      logo: brandOf(b.bidder)?.brand_logo_url ?? null,
      label: patchLabel(b.listing_id, b.patch_id),
      title: card?.title ?? "",
      href: card?.href ?? "#",
      amount: Number(b.amount) / 1e6,
      buyNow: b.is_buy_now,
      time: new Date(b.block_time).getTime(),
    };
  });

  const links = (event.links ?? {}) as { website?: string | null; x?: string | null };
  const info: EventInfo = {
    id: event.event_id,
    slug: event.slug ?? null,
    name: event.name,
    startsAt: new Date(event.starts_at).getTime(),
    endsAt: new Date(event.ends_at).getTime(),
    city: event.city,
    venue: event.venue,
    description: event.description,
    banner: event.banner_url,
    website: links.website ?? null,
    x: links.x ?? null,
    active: event.active,
  };
  return <EventView event={info} cards={toWire(cards)} leaderboards={leaderboards} wall={wall} />;
}
