import { ImageResponse } from "next/og";
import { fetchEventGraph } from "@/lib/graph/server";
import { standing } from "@/lib/graph/standing";
import { CARD_SIZE, PatchworkCard, cardAssets } from "@/lib/server/patchworkCard";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * "I'm in the <event> patchwork" as a 1200x630 PNG: the wallet's corner of the event graph with real pictures.
 * A wallet that is not in the event yet gets the event's own invitation card. Query: download=1.
 */
export async function GET(req: Request, { params }: { params: Promise<{ eventId: string; wallet: string }> }) {
  const { eventId, wallet } = await params;
  if (!/^\d{1,9}$/.test(eventId) || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) return new Response("Not found", { status: 404 });
  const g = await fetchEventGraph(Number(eventId)).catch(() => null);
  if (!g) return new Response("Not found", { status: 404 });

  const s = standing(g, wallet);
  const assets = await cardAssets(g, s);
  const res = new ImageResponse(<PatchworkCard g={g} s={s} assets={assets} />, { ...CARD_SIZE, fonts: assets.fonts });
  if (new URL(req.url).searchParams.get("download")) {
    res.headers.set("content-disposition", `attachment; filename="patchwork-${eventId}-${wallet.slice(2, 8)}.png"`);
  }
  // The graph moves with every bid, so keep this short: a shared link still looks current for a minute.
  res.headers.set("cache-control", "public, s-maxage=60, stale-while-revalidate=300");
  return res;
}
