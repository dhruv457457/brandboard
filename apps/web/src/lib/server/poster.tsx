import "server-only";
// Share posters drawn with next/og from live listing data: story, square, X card and a QR sticker sheet.
// Used by /share/[id]/poster and by the listing's link preview (opengraph-image), so they always match.
import QRCode from "qrcode";
import { formatCountdown, formatUsdc } from "@/lib/format";
import type { ListingView, LivePatch } from "@/lib/market/types";
import { pngImage, posterFonts } from "@/lib/server/pngFromUrl";

export const SIZES = { story: [1080, 1920], square: [1080, 1080], x: [1200, 630], stickers: [1240, 1754] } as const;
export type Format = keyof typeof SIZES;
export type PosterTemplate = "launch" | "war" | "lastcall" | "thanks";

export const ACCENTS = {
  orange: { bg: "#FF5A1F", fg: "#0B0B0C", soft: "#FFE3D6" },
  ink: { bg: "#0B0B0C", fg: "#FAFAF7", soft: "#EDEBE4" },
  lilac: { bg: "#D9CCFF", fg: "#0B0B0C", soft: "#F1ECFF" },
  mint: { bg: "#BDEBD3", fg: "#0B0B0C", soft: "#E9F8F0" },
} as const;
export type Accent = keyof typeof ACCENTS;

const INK = "#0B0B0C";
const PAPER = "#FAFAF7";
const PASTELS = ["#D9CCFF", "#FFE58F", "#BDEBD3", "#BFE3FF", "#FFC9DA"];
const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

function copy(listing: ListingView, template: PosterTemplate, custom: string | null) {
  const patches = listing.patches;
  const open = patches.filter((p) => !p.topBidder && !p.bought).length;
  const total = patches.reduce((s, p) => s + p.topBid, 0n);
  const surface = listing.surface === "car" ? "car" : listing.surface === "hoodie" ? "hoodie" : "outfit";
  const left = formatCountdown(listing.biddingEndsAt);
  const brands = [...new Set(patches.map((p) => p.brandName).filter(Boolean))] as string[];
  switch (template) {
    case "war":
      return { headline: custom ?? `Bidding war on my ${surface}`, sub: `${listing.bids.length} bids so far · ${usd(total)} locked in escrow`, brands };
    case "lastcall":
      return {
        headline: custom ?? (open ? `Last call: ${open} spot${open === 1 ? "" : "s"} left` : "Every spot is taken"),
        sub: left.hasEnded ? "Bidding has closed" : `Bidding closes in ${left.text}`,
        brands,
      };
    case "thanks":
      return { headline: custom ?? "Thank you, sponsors", sub: brands.length ? "These brands are on my " + surface : "Be the first brand on my " + surface, brands };
    default:
      return {
        headline: custom ?? listing.metadata?.headline ?? "Walking billboard for your brand",
        sub: `${patches.length} logo spots on my ${surface}. Brands bid in USDC, escrow pays when I show up.`,
        brands,
      };
  }
}

export function Poster(props: {
  format: Exclude<Format, "stickers">;
  template: PosterTemplate;
  accent: (typeof ACCENTS)[Accent];
  custom: string | null;
  listing: ListingView;
  qr: string;
  url: string;
  image: { src: string; width: number; height: number } | null;
}) {
  const { format, template, accent, custom, listing, qr, url, image } = props;
  const c = copy(listing, template, custom);
  const taken = listing.patches.filter((p) => p.topBidder).length;
  const total = listing.patches.reduce((s, p) => s + p.topBid, 0n);
  const creator = listing.creatorHandle ? `@${listing.creatorHandle}` : listing.creatorName ?? `${listing.creator.slice(0, 6)}…${listing.creator.slice(-4)}`;
  const firstView = listing.views[0]?.id ?? "front";
  const patches = listing.patches.filter((p) => p.side === firstView);

  const story = format === "story";
  const x = format === "x";
  const figureBox = story ? { w: 900, h: 900 } : x ? { w: 420, h: 540 } : { w: 470, h: 700 };
  const headlineSize = story ? 104 : x ? 60 : 76;
  // Printed link: the QR carries the full URL, so shorten long wallet paths for reading.
  const bare = url.replace(/^https?:\/\//, "");
  const shortUrl = bare.length > 34 ? `${bare.split("/")[0]}/…/${listing.id}` : bare;

  const header = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: story ? 64 : 48, height: story ? 64 : 48, borderRadius: 14, background: "#FF5A1F", border: `4px solid ${INK}`, transform: "rotate(-8deg)" }} />
      <div style={{ fontFamily: "Bricolage", fontSize: story ? 48 : 36, color: INK }}>patched</div>
      {listing.eventName && (
        <div style={{ display: "flex", marginLeft: 12, padding: "8px 18px", borderRadius: 999, border: `3px solid ${INK}`, background: accent.soft, fontSize: story ? 28 : 22, color: INK }}>
          {listing.eventName}
        </div>
      )}
    </div>
  );

  const words = (
    <div style={{ display: "flex", flexDirection: "column", gap: story ? 24 : 14 }}>
      <div style={{ fontFamily: "Bricolage", fontSize: headlineSize, lineHeight: 1.0, letterSpacing: -2, color: INK }}>{c.headline}</div>
      <div style={{ fontSize: story ? 38 : x ? 24 : 30, lineHeight: 1.3, color: "#5F5B53" }}>{c.sub}</div>
      <div style={{ fontSize: story ? 32 : 22, color: INK }}>{`by ${creator}`}</div>
      {template === "thanks" && c.brands.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {c.brands.slice(0, 6).map((b) => (
            <div key={b} style={{ display: "flex", padding: "10px 20px", borderRadius: 16, border: `3px solid ${INK}`, background: "#FFFFFF", fontFamily: "Bricolage", fontSize: story ? 34 : 24, color: INK }}>
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const stats = (
    <div style={{ display: "flex", gap: story ? 48 : 28 }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Bricolage", fontSize: story ? 72 : 48, color: INK }}>{usd(total)}</div>
        <div style={{ fontSize: story ? 26 : 18, color: "#5F5B53" }}>in bids</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Bricolage", fontSize: story ? 72 : 48, color: INK }}>{`${taken}/${listing.patches.length}`}</div>
        <div style={{ fontSize: story ? 26 : 18, color: "#5F5B53" }}>spots taken</div>
      </div>
    </div>
  );

  const qrBlock = (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ display: "flex", padding: 10, background: "#FFFFFF", borderRadius: 20, border: `4px solid ${INK}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={story ? 220 : x ? 120 : 170} height={story ? 220 : x ? 120 : 170} alt="" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontFamily: "Bricolage", fontSize: story ? 44 : x ? 26 : 34, color: INK }}>Scan to bid</div>
        <div style={{ fontSize: story ? 24 : 16, color: "#5F5B53", maxWidth: story ? 560 : 300 }}>{shortUrl}</div>
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, fontFamily: "Geist", color: INK }}>
      {/* accent band */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: story ? 14 : 10, background: accent.bg }} />
      {story ? (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "80px 72px 72px" }}>
          {header}
          {words}
          <Figure image={image} box={figureBox} patches={patches} accent={accent} />
          {stats}
          {qrBlock}
        </div>
      ) : x ? (
        <div style={{ display: "flex", width: "100%", padding: "46px 56px", gap: 44 }}>
          <Figure image={image} box={figureBox} patches={patches} accent={accent} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
            {header}
            {words}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              {stats}
              {qrBlock}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: "64px 64px 56px", gap: 30 }}>
          {header}
          <div style={{ display: "flex", gap: 40, flex: 1 }}>
            <Figure image={image} box={figureBox} patches={patches} accent={accent} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
              {words}
              {stats}
              {qrBlock}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The creator's cutout with its patches drawn at their real positions. */
function Figure({ image, box, patches, accent }: {
  image: { src: string; width: number; height: number } | null;
  box: { w: number; h: number };
  patches: LivePatch[];
  accent: (typeof ACCENTS)[Accent];
}) {
  const ratio = image ? image.width / image.height : 3 / 4;
  const w = Math.min(box.w, box.h * ratio);
  const h = w / ratio;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: box.w, height: box.h, background: accent.soft, borderRadius: 36, border: `4px solid ${INK}` }}>
      <div style={{ display: "flex", position: "relative", width: w * 0.92, height: h * 0.92 }}>
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image.src} width={w * 0.92} height={h * 0.92} alt="" style={{ position: "absolute", left: 0, top: 0 }} />
        ) : null}
        {patches.map((p) => {
          const takenPatch = Boolean(p.topBidder);
          // Scale the label to the patch; tiny patches just show their colour.
          const pw = (p.w / 100) * w * 0.92;
          const ph = (p.h / 100) * h * 0.92;
          const label = takenPatch ? (p.brandName ?? "") : String(p.id + 1).padStart(2, "0");
          const fontSize = Math.min(20, ph * 0.45, (pw / Math.max(label.length, 2)) * 1.6);
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`,
                transform: `rotate(${p.r}deg)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10,
                border: takenPatch ? `3px solid ${INK}` : "3px dashed #C2390A",
                background: takenPatch ? PASTELS[p.id % PASTELS.length] : "rgba(255,90,31,0.14)",
                fontFamily: "Bricolage", fontSize, color: takenPatch ? INK : "#C2390A",
                overflow: "hidden",
              }}
            >
              {fontSize >= 9 ? label : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Printable sheet: six round "scan to sponsor" stickers for the patches. */
export function Stickers({ qr, accent, title }: { qr: string; accent: (typeof ACCENTS)[Accent]; title: string }) {
  const sticker = (i: number) => (
    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 500, height: 500, borderRadius: 999, background: accent.bg, border: `8px solid ${INK}`, gap: 10 }}>
      <div style={{ fontFamily: "Bricolage", fontSize: 30, color: accent.fg }}>SCAN TO SPONSOR</div>
      <div style={{ display: "flex", padding: 10, background: "#FFFFFF", borderRadius: 24, border: `5px solid ${INK}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={220} height={220} alt="" />
      </div>
      <div style={{ fontFamily: "Bricolage", fontSize: 34, color: accent.fg }}>patched</div>
    </div>
  );
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#FFFFFF", padding: "70px 60px", gap: 40, fontFamily: "Geist" }}>
      <div style={{ fontSize: 26, color: "#5F5B53" }}>{`Print, cut out and stick on your patches · ${title}`}</div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 60 }}>{[0, 1, 2, 3, 4, 5].map(sticker)}</div>
    </div>
  );
}

/** Everything a poster needs besides the listing: fonts, the QR code and the cutout as PNG. */
export async function posterAssets(listing: ListingView, origin: string) {
  const url = `${origin}/${listing.creatorHandle ?? listing.creator}/${listing.id}`;
  const [fonts, qr, image] = await Promise.all([
    posterFonts().catch(() => []),
    QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: INK, light: "#FFFFFF" } }),
    pngImage(listing.views[0]?.image ?? listing.canvasImage, 1100),
  ]);
  return { url, qr, image, fonts: fonts.map((f) => ({ ...f, style: "normal" as const })) };
}
