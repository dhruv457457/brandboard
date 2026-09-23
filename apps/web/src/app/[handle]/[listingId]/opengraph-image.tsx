import { ImageResponse } from "next/og";
import { fetchListingView } from "@/lib/market/server";

export const runtime = "nodejs";
export const alt = "Patched listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const usd = (v: bigint) => `$${(Number(v) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Link preview for a listing: the creator's canvas (if any), title and live auction numbers. */
export default async function Image({ params }: { params: Promise<{ listingId: string }> }) {
  const { listingId } = await params;
  const listing = await fetchListingView(Number(listingId)).catch(() => null);
  const title = listing?.title ?? "Get patched. Get paid.";
  const withBids = listing?.patches.filter((p) => p.topBidder).length ?? 0;
  const total = listing?.patches.reduce((s, p) => s + p.topBid, 0n) ?? 0n;
  const creator = listing
    ? listing.creatorName ?? (listing.creatorHandle ? `@${listing.creatorHandle}` : `${listing.creator.slice(0, 6)}…${listing.creator.slice(-4)}`)
    : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFE58F", color: "#0B0B0C", fontFamily: "sans-serif" }}>
        <div style={{ width: 400, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#F1EFE8", borderRight: "4px solid #0B0B0C" }}>
          {listing?.canvasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.canvasImage} alt="" width={330} height={500} style={{ objectFit: "cover", borderRadius: 24 }} />
          ) : (
            <div style={{ width: 220, height: 330, borderRadius: 28, border: "6px dashed #FF5A1F", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 800 }}>
              patch
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: 56, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 800 }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "#FF5A1F", border: "4px solid #0B0B0C", transform: "rotate(-8deg)" }} />
            patched
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
            {creator && <div style={{ display: "flex", fontSize: 30, opacity: 0.75 }}>{`by ${creator}${listing?.eventName ? ` · ${listing.eventName}` : ""}`}</div>}
          </div>
          {listing && (
            <div style={{ display: "flex", gap: 48, fontSize: 26 }}>
              <div style={{ display: "flex", flexDirection: "column" }}><b style={{ fontSize: 48 }}>{`${withBids}/${listing.patches.length}`}</b>patches with bids</div>
              <div style={{ display: "flex", flexDirection: "column" }}><b style={{ fontSize: 48 }}>{usd(total)}</b>in top bids</div>
            </div>
          )}
        </div>
      </div>
    ),
    size,
  );
}
