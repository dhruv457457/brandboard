import { notFound, redirect } from "next/navigation";
import { fetchDelivery, fetchListingView } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { ListingRoom } from "./ListingRoom";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ handle: string; listingId: string }> }) {
  const { handle, listingId } = await params;
  const id = Number(listingId);
  if (!Number.isInteger(id) || id < 1) notFound();
  const listing = await fetchListingView(id);
  if (!listing) notFound();
  // One canonical URL per listing: /<creator handle or wallet>/<id>. Links like /listing/<id> land here too.
  const canonical = listing.creatorHandle ?? listing.creator;
  if (decodeURIComponent(handle).toLowerCase() !== canonical.toLowerCase()) redirect(`/${canonical}/${id}`);
  const delivery = listing.status >= 2 ? await fetchDelivery(id, listing.metadata) : null;
  return <ListingRoom initial={toWire(listing)} delivery={delivery ? toWire(delivery) : null} />;
}
