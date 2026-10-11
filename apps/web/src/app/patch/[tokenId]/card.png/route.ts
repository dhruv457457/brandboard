import { cardSvg } from "@/lib/nft/token";
import { getNftPage } from "@/lib/server/nft";
import { cardPng, imageDataUrl } from "@/lib/server/cardPng";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * The patch NFT as a 1000x1000 PNG: the share picture, the Open Graph image, and the `image` of the token's metadata
 * (so explorers and marketplaces show it). Same card as the page, with the brand's logo and the creator's photo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  if (!/^\d{1,30}$/.test(tokenId)) return new Response("Not found", { status: 404 });
  const page = await getNftPage(BigInt(tokenId));
  if (!page) return new Response("Not found", { status: 404 });
  const t = page.token;
  // The names and pictures come from the profiles. resvg can't fetch links, so the pictures are embedded as small PNGs.
  const [brandLogo, creatorAvatar] = await Promise.all([imageDataUrl(t.brandLogo), imageDataUrl(t.creatorAvatar, 128)]);
  const png = await cardPng(cardSvg(t, { id: "og", brandLogo, creatorAvatar }));
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // The link carries ?v=<stage>, so a new stage is a new URL; an hour of cache keeps explorers and crawlers fast.
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
