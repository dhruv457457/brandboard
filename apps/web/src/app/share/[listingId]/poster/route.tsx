import { ImageResponse } from "next/og";
import { fetchListingView } from "@/lib/market/server";
import { ACCENTS, Poster, SIZES, Stickers, posterAssets, type Accent, type Format, type PosterTemplate } from "@/lib/server/poster";

export const runtime = "nodejs";

/**
 * Share poster for a listing, rendered from live data. Query: format=story|square|x|stickers,
 * template=launch|war|lastcall|thanks, accent=orange|ink|lilac|mint, headline=<optional text>, download=1.
 */
export async function GET(req: Request, { params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const q = new URL(req.url).searchParams;
  const format = (q.get("format") ?? "story") in SIZES ? (q.get("format") as Format) : "story";
  const template = (["launch", "war", "lastcall", "thanks"].includes(q.get("template") ?? "") ? q.get("template") : "launch") as PosterTemplate;
  const accent = ACCENTS[(q.get("accent") ?? "orange") as Accent] ?? ACCENTS.orange;
  const custom = q.get("headline")?.trim().slice(0, 60) || null;

  const listing = await fetchListingView(Number(listingId)).catch(() => null);
  if (!listing) return new Response("Not found", { status: 404 });

  const { url, qr, image, fonts } = await posterAssets(listing, new URL(req.url).origin);
  const [width, height] = SIZES[format];
  const body =
    format === "stickers" ? (
      <Stickers qr={qr} accent={accent} title={listing.title} />
    ) : (
      <Poster format={format} template={template} accent={accent} custom={custom} listing={listing} qr={qr} url={url} image={image} />
    );

  const res = new ImageResponse(body, { width, height, fonts });
  if (q.get("download")) {
    res.headers.set("content-disposition", `attachment; filename="patched-${listing.id}-${format}-${template}.png"`);
  }
  res.headers.set("cache-control", "no-store");
  return res;
}
