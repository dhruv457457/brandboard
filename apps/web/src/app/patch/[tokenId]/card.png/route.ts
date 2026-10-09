import { cardSvg } from "@/lib/nft/token";
import { ipfsUrl } from "@/lib/ipfs";
import { getNftPage } from "@/lib/server/nft";
import { cardPng, photoDataUrl } from "@/lib/server/cardPng";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The patch NFT as a 1000x1000 PNG: the share picture and the Open Graph image. Same card as the page, photo included. */
export async function GET(_req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  if (!/^\d{1,30}$/.test(tokenId)) return new Response("Not found", { status: 404 });
  const page = await getNftPage(BigInt(tokenId));
  if (!page) return new Response("Not found", { status: 404 });
  const t = page.token;
  const showsPhoto = t.stage === "printed" || t.stage === "seen" || t.stage === "delivered";
  const photo = showsPhoto ? await photoDataUrl(ipfsUrl(t.coverURI)) : null;
  // The names come from the profiles; the logo and face stay off, as the renderer can't fetch outside pictures.
  const png = await cardPng(cardSvg({ ...t, brandLogo: null, creatorAvatar: null }, { id: "og", photo }));
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // The link carries ?v=<stage>, so a new stage is a new URL; a short cache keeps a busy page cheap.
      "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
