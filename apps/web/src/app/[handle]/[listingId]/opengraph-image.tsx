import { ImageResponse } from "next/og";
import { FIXTURE_LISTINGS } from "@/lib/data/fixtures";

export const runtime = "edge";
export const alt = "Patched Listing";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string; listingId: string }>;
}) {
  const { handle, listingId } = await params;

  const listing =
    FIXTURE_LISTINGS.find(
      (l) => l.id === listingId || l.creatorHandle === listingId || l.creatorHandle === handle
    ) || FIXTURE_LISTINGS[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#FFE58F",
          color: "#0B0B0C",
          fontFamily: "system-ui, -apple-system, sans-serif",
          border: "12px solid #0B0B0C",
        }}
      >
        {/* Left Side: Mock Surface Silhouette */}
        <div
          style={{
            width: "36%",
            height: "100%",
            backgroundColor: "#F1EFE8",
            borderRight: "6px solid #0B0B0C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
          }}
        >
          <div
            style={{
              width: "200px",
              height: "400px",
              backgroundColor: "#FFFFFF",
              border: "5px solid #0B0B0C",
              borderRadius: "24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-around",
              padding: "20px 10px",
              boxShadow: "6px 6px 0 #0B0B0C",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "36px",
                backgroundColor: "#D9CCFF",
                border: "3px solid #0B0B0C",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Nodeflux
            </div>
            <div
              style={{
                width: "100px",
                height: "30px",
                backgroundColor: "#FFE58F",
                border: "3px solid #0B0B0C",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              Zeta Pay
            </div>
            <div
              style={{
                width: "110px",
                height: "32px",
                backgroundColor: "#BDEBD3",
                border: "3px solid #0B0B0C",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              SOLD
            </div>
          </div>
        </div>

        {/* Right Side: Copy & Stats */}
        <div
          style={{
            width: "64%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "50px 60px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: "-0.05em",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: "#FF5A1F",
                border: "3px solid #0B0B0C",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              P
            </div>
            <span>patched</span>
          </div>

          {/* Heading */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              {listing.creatorName} is getting patched at {listing.eventName || listing.event || listing.title}
            </div>

            {/* Stats */}
            <div
              style={{
                display: "flex",
                gap: 40,
                marginTop: 20,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 32, fontWeight: 900 }}>4/7</span>
                <span style={{ fontSize: 18, color: "#5F5B53" }}>patches with bids</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 32, fontWeight: 900 }}>$1,355</span>
                <span style={{ fontSize: 18, color: "#5F5B53" }}>top bids in escrow</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 32, fontWeight: 900 }}>2d 5h</span>
                <span style={{ fontSize: 18, color: "#5F5B53" }}>time remaining</span>
              </div>
            </div>
          </div>

          {/* Bottom badge */}
          <div
            style={{
              alignSelf: "flex-start",
              backgroundColor: "#0B0B0C",
              color: "#FAFAF7",
              padding: "10px 22px",
              borderRadius: "12px",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            patched.fun/{listing.creatorHandle}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
