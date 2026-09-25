import { notFound } from "next/navigation";
import { fetchListingView } from "@/lib/market/server";
import { ShareKit } from "./ShareKit";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const listing = await fetchListingView(Number(listingId)).catch(() => null);
  if (!listing) notFound();
  const withBids = listing.patches.filter((p) => p.topBidder);
  return (
    <ShareKit
      listing={{
        id: listing.id,
        path: `/${listing.creatorHandle ?? listing.creator}/${listing.id}`,
        status: listing.status,
        title: listing.title,
        eventName: listing.eventName,
        patchCount: listing.patches.length,
        openCount: listing.patches.length - withBids.length,
        topBidsTotal: Number(listing.patches.reduce((s, p) => s + p.topBid, 0n)) / 1e6,
        biddingEndsAt: listing.biddingEndsAt,
        leaderBrands: [...new Set(withBids.map((p) => p.brandName).filter(Boolean))] as string[],
      }}
    />
  );
}
