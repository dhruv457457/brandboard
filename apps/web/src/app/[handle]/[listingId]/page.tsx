import { notFound } from "next/navigation";
import { fetchListingView } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { ListingRoom } from "./ListingRoom";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ handle: string; listingId: string }> }) {
  const { listingId } = await params;
  const id = Number(listingId);
  if (!Number.isInteger(id) || id < 1) notFound();
  const listing = await fetchListingView(id);
  if (!listing) notFound();
  return <ListingRoom initial={toWire(listing)} />;
}
