import "server-only";
import { drawBlock, fetchContest } from "@/lib/server/contest";
import { imageDataUrl } from "@/lib/server/cardPng";
import type { WinnerCardData } from "@/lib/winnerCard";

/** The Get Patched Week winners with their pictures embedded, ready for lib/winnerCard.ts. */
export async function loadWinnerCards(): Promise<WinnerCardData[]> {
  const data = await fetchContest(null);
  const block = await drawBlock().catch(() => null);
  return Promise.all(
    data.winners.map(async (w) => ({
      track: w.track, handle: w.handle, name: w.name, note: w.note,
      avatar: await imageDataUrl(w.avatar, 320),
      block: w.track === "lucky" ? block?.number ?? null : null,
    })),
  );
}
