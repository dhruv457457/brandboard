import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { ExploreGrid } from "./ExploreGrid";

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const cards = await fetchListingCards();
  return <ExploreGrid cards={toWire(cards)} />;
}
