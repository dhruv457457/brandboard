import { ImageResponse } from "next/og";
import { headers } from "next/headers";
import { fetchListingView } from "@/lib/market/server";
import { ACCENTS, Poster, posterAssets } from "@/lib/server/poster";

export const runtime = "nodejs";
export const alt = "Patched sponsor page";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview: the same X-card poster as the share kit's "Launch" moment, with live numbers. */
export default async function Image({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const listing = await fetchListingView(Number(listingId)).catch(() => null);
  if (!listing) {
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAF7", fontSize: 64, fontWeight: 800 }}>
          Get patched. Get paid.
        </div>
      ),
      size,
    );
  }
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "patched.app"}`;
  const { url, qr, image, fonts } = await posterAssets(listing, origin);
  return new ImageResponse(
    <Poster format="x" template="launch" accent={ACCENTS.orange} custom={null} listing={listing} qr={qr} url={url} image={image} />,
    { ...size, fonts },
  );
}
