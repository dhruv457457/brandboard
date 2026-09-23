import { notFound } from "next/navigation";
import { fetchDelivery, fetchListingView } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { CreatorDashboard } from "./CreatorDashboard";

export const dynamic = "force-dynamic";

export default async function CreatorListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const id = Number(listingId);
  if (!Number.isInteger(id) || id < 1) notFound();
  const listing = await fetchListingView(id);
  if (!listing) notFound();
  const delivery = await fetchDelivery(id, listing.metadata);
  return <CreatorDashboard listing={toWire(listing)} delivery={toWire(delivery)} />;
}
