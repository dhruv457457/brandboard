import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress } from "@/lib/format";
import { ExploreFeed, type FeedActivity, type FeedStats } from "./ExploreFeed";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const cards = await fetchListingCards({ statuses: [1, 2, 3], limit: 60 });
  const ids = cards.map((c) => c.id);
  const db = supabase();

  const { data: bids } = ids.length
    ? await db.from("bids").select("listing_id, patch_id, bidder, amount, block_time")
        .eq("chain_id", CHAIN_ID).in("listing_id", ids).order("block_number", { ascending: false }).limit(400)
    : { data: [] as { listing_id: number; patch_id: number; bidder: string; amount: number; block_time: string }[] };
  const bidders = [...new Set((bids ?? []).map((b) => b.bidder))];
  const { data: brands } = bidders.length
    ? await db.from("profiles").select("wallet, brand_name, brand_verified_domain").in("wallet", bidders)
    : { data: [] as { wallet: string; brand_name: string | null; brand_verified_domain: string | null }[] };

  const who = (w: string) => brands?.find((b) => b.wallet === w)?.brand_name ?? formatShortAddress(w);
  const label = (listingId: number, patchId: number) =>
    cards.find((c) => c.id === listingId)?.patches.find((p) => p.id === patchId)?.label ?? `spot ${patchId + 1}`;

  const dayAgo = Date.now() - 86_400_000;
  const stats: Record<number, FeedStats> = {};
  for (const c of cards) stats[c.id] = { bids: 0, bids24h: 0, last: null };
  for (const b of bids ?? []) {
    const s = stats[b.listing_id];
    if (!s) continue;
    s.bids += 1;
    if (new Date(b.block_time).getTime() > dayAgo) s.bids24h += 1;
    s.last ??= { who: who(b.bidder), label: label(b.listing_id, b.patch_id), amount: Number(b.amount) / 1e6, time: new Date(b.block_time).getTime() };
  }
  const activity: FeedActivity[] = (bids ?? []).slice(0, 14).map((b) => {
    const card = cards.find((c) => c.id === b.listing_id)!;
    return {
      who: who(b.bidder),
      verified: Boolean(brands?.find((x) => x.wallet === b.bidder)?.brand_verified_domain),
      label: label(b.listing_id, b.patch_id),
      amount: Number(b.amount) / 1e6,
      time: new Date(b.block_time).getTime(),
      title: card?.title ?? "",
      href: card?.href ?? "/explore",
    };
  });

  return <ExploreFeed cards={toWire(cards)} stats={stats} activity={activity} />;
}
