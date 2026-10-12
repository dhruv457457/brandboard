import { TRACKS } from "@/lib/contest";
import { cardPng } from "@/lib/server/cardPng";
import { loadWinnerCards } from "@/lib/server/winnerCards";
import { winnerCard } from "@/lib/winnerCard";

export const runtime = "nodejs";
export const maxDuration = 30;

/** One Get Patched Week winner as a 1200x675 PNG, to post on X. Track: post, feedback or lucky. */
export async function GET(_req: Request, { params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  if (!TRACKS.some((t) => t.id === track)) return new Response("Not found", { status: 404 });
  const winner = (await loadWinnerCards()).find((w) => w.track === track);
  if (!winner) return new Response("No winner for this prize yet", { status: 404 });
  const png = await cardPng(winnerCard(winner), 1200);
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, s-maxage=300, stale-while-revalidate=3600" } });
}
