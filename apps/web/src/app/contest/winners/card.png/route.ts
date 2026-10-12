import { cardPng } from "@/lib/server/cardPng";
import { loadWinnerCards } from "@/lib/server/winnerCards";
import { winnersCard } from "@/lib/winnerCard";

export const runtime = "nodejs";
export const maxDuration = 30;

/** All three Get Patched Week winners on one 1200x675 PNG, for a single announcement post. */
export async function GET() {
  const winners = await loadWinnerCards();
  if (winners.length === 0) return new Response("No winners yet", { status: 404 });
  const png = await cardPng(winnersCard(winners), 1200);
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
