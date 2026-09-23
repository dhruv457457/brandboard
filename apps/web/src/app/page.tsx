import { CHAIN_ID } from "@/lib/config";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { fetchListingCards } from "@/lib/market/server";
import { supabase } from "@/lib/supabase";
import { LandingView, type LandingData, type TickerItem } from "./LandingView";

export const dynamic = "force-dynamic";

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;

export default async function LandingPage() {
  const db = supabase();
  const [live, { data: bids }, { count: bidCount }] = await Promise.all([
    fetchListingCards({ statuses: [1], limit: 12 }),
    db.from("bids").select("listing_id, patch_id, bidder, amount").eq("chain_id", CHAIN_ID).order("block_number", { ascending: false }).limit(16),
    db.from("bids").select("*", { count: "exact", head: true }).eq("chain_id", CHAIN_ID),
  ]);

  // Hero: prefer a live listing with a real photo canvas, else the newest live one.
  const hero = live.find((c) => c.canvasImage) ?? live[0] ?? null;

  // Labels and brand names for the ticker.
  const ids = [...new Set((bids ?? []).map((b) => b.listing_id))];
  const wallets = [...new Set((bids ?? []).map((b) => b.bidder))];
  const [{ data: patches }, { data: brands }] = await Promise.all([
    ids.length ? db.from("patches").select("listing_id, patch_id, label").eq("chain_id", CHAIN_ID).in("listing_id", ids) : Promise.resolve({ data: [] as { listing_id: number; patch_id: number; label: string }[] }),
    wallets.length ? db.from("profiles").select("wallet, brand_name").in("wallet", wallets) : Promise.resolve({ data: [] as { wallet: string; brand_name: string | null }[] }),
  ]);
  const ticker: TickerItem[] = (bids ?? []).map((b) => ({
    who: brands?.find((x) => x.wallet === b.bidder)?.brand_name ?? formatShortAddress(b.bidder),
    label: patches?.find((p) => p.listing_id === b.listing_id && p.patch_id === b.patch_id)?.label ?? `Patch ${b.patch_id + 1}`,
    amount: formatUsdc(b.amount / 1e6),
  }));

  const escrowed = live.reduce((sum, c) => sum + c.topBidsTotal, 0n);

  const data: LandingData = {
    featured: hero && {
      href: hero.href,
      title: hero.title,
      surface: hero.surface,
      canvasImage: hero.canvasImage,
      biddingEndsAt: hero.biddingEndsAt,
      patches: hero.patches
        .filter((p) => p.side === "front")
        .map((p) => ({
          id: p.id, name: p.label, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
          topBid: Number(p.topBid) / 1e6,
          brand: p.topBidder ? p.brandName ?? formatShortAddress(p.topBidder) : null,
          logo: p.logoUrl,
          c: PASTELS[p.id % PASTELS.length],
          bought: p.bought,
        })),
    },
    stats: {
      liveListings: live.length,
      escrowedUsd: Number(escrowed) / 1e6,
      bids: bidCount ?? 0,
    },
    ticker,
    surfaceLinks: Object.fromEntries(
      (["outfit", "car", "hoodie"] as const).flatMap((s) => {
        const c = live.find((x) => x.surface === s);
        return c ? [[s, c.href]] : [];
      }),
    ),
  };
  return <LandingView {...data} />;
}
