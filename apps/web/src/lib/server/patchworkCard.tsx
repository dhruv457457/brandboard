import "server-only";
// The "I'm in the <event> patchwork" share card (1200x630), drawn with next/og from the live graph: the wallet's own
// corner of it, with real profile photos, brand logos and the event banner. Used by the share route and the link preview.
import { formatUsdc } from "@/lib/format";
import type { EventGraph } from "@/lib/graph/types";
import type { Standing } from "@/lib/graph/standing";
import { pngDataUrl, posterFonts } from "@/lib/server/pngFromUrl";

export const CARD_SIZE = { width: 1200, height: 630 } as const;

const INK = "#0B0B0C";
const PAPER = "#FAFAF7";
const ORANGE = "#FF5A1F";
const ACCENT_TEXT = "#C2390A";
const MUTED = "#5F5B53";
const PASTELS = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];

const initials = (s: string) => s.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export interface CardAssets {
  banner: string | null;
  me: string | null;
  near: (string | null)[];
}

/** Fetch every picture the card needs as PNG data URLs (next/og can't read WebP), all at once. */
export async function cardAssets(g: EventGraph, s: Standing | null): Promise<CardAssets & { fonts: { name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }[] }> {
  const near = (s?.neighbors ?? []).slice(0, 8);
  const [fonts, banner, me, ...pics] = await Promise.all([
    posterFonts().catch(() => []),
    pngDataUrl(g.event.banner, 240),
    pngDataUrl(s?.me.image, 240),
    ...near.map((n) => pngDataUrl(n.node.image, 160)),
  ]);
  return { banner, me, near: pics, fonts: fonts.map((f) => ({ ...f, style: "normal" as const })) };
}

function Tile({ label, src, size, color, square, ring }: { label: string; src: string | null; size: number; color: string; square: boolean; ring?: boolean }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, overflow: "hidden",
        borderRadius: square ? size * 0.22 : size, border: `${size > 100 ? 5 : 3.5}px solid ${INK}`, background: src && square ? "#FFFFFF" : color,
        boxShadow: ring ? `0 0 0 8px ${ORANGE}, 7px 7px 0 8px ${INK}` : `${size > 100 ? 6 : 4}px ${size > 100 ? 6 : 4}px 0 ${INK}`,
        fontFamily: "Bricolage", fontWeight: 800, fontSize: size * 0.4, color: INK,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={size} height={size} style={{ width: size, height: size, objectFit: square ? "contain" : "cover" }} alt="" />
      ) : (
        initials(label)
      )}
    </div>
  );
}

export function PatchworkCard({ g, s, assets }: { g: EventGraph; s: Standing | null; assets: CardAssets }) {
  const W = 560; // the picture's square on the right
  const cx = W / 2;
  const cy = W / 2 + 10;
  const near = (s?.neighbors ?? []).slice(0, 8);
  const R = near.length > 5 ? 215 : 190;
  const pts = near.map((_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, near.length)) * Math.PI * 2 + (near.length > 5 ? 0.2 : 0);
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  const name = g.event.name;

  return (
    <div
      style={{
        display: "flex", width: CARD_SIZE.width, height: CARD_SIZE.height, background: PAPER, fontFamily: "Geist", color: INK,
        backgroundImage: "radial-gradient(circle, rgba(11,11,12,0.13) 1.6px, transparent 1.8px)", backgroundSize: "26px 26px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600, padding: "52px 0 48px 64px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 16, overflow: "hidden", background: ORANGE,
              border: `4px solid ${INK}`, boxShadow: `5px 5px 0 ${INK}`, transform: "rotate(-6deg)", marginRight: 22,
            }}
          >
            {assets.banner ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assets.banner} width={64} height={64} style={{ width: 64, height: 64, objectFit: "cover" }} alt="" />
            ) : (
              <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 40, color: "#FFFFFF" }}>p</span>
            )}
          </div>
          <span style={{ fontSize: 28, fontWeight: 500, color: MUTED }}>{name}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: s ? 76 : 70, lineHeight: 1.0, letterSpacing: -3 }}>
            {s ? "I'm in the" : "Join the"}
          </div>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: name.length <= 10 ? 84 : name.length <= 16 ? 64 : 50, lineHeight: 1.1, letterSpacing: -2.5, marginTop: 4 }}>{name}</div>
          <div style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: s ? 76 : 70, lineHeight: 1.05, letterSpacing: -3, color: ACCENT_TEXT }}>patchwork.</div>

          {s ? (
            <div style={{ display: "flex", marginTop: 26, fontSize: 30, fontWeight: 500, color: MUTED }}>
              <span style={{ display: "flex", color: ACCENT_TEXT, fontWeight: 800, marginRight: 12 }}>{`#${s.rank}`}</span>
              <span style={{ display: "flex" }}>{`most connected · ${s.degree} threads`}</span>
            </div>
          ) : (
            <div style={{ display: "flex", marginTop: 26, fontSize: 30, fontWeight: 500, color: MUTED }}>{`${g.stats.creators} creators · ${g.stats.spots} spots · ${formatUsdc(g.stats.escrowUsd)} in escrow`}</div>
          )}
          {s && (
            <div style={{ display: "flex", marginTop: 8, fontSize: 26, fontWeight: 500, color: MUTED }}>
              {`${formatUsdc(s.locked)} locked in escrow · spotted ${s.spotted}`}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ display: "flex", fontFamily: "Bricolage", fontWeight: 800, fontSize: 36, letterSpacing: -1.5 }}>patched</span>
          <span style={{ display: "flex", fontSize: 24, fontWeight: 500, color: MUTED, marginLeft: 18 }}>Get patched. Get paid. On Monad.</span>
        </div>
      </div>

      <div style={{ display: "flex", position: "relative", width: W, height: CARD_SIZE.height }}>
        {s && (
          <svg width={W} height={CARD_SIZE.height} viewBox={`0 0 ${W} ${CARD_SIZE.height}`} style={{ position: "absolute", left: 0, top: 0 }}>
            {pts.map((p, i) => (
              <line
                key={i} x1={cx} y1={cy} x2={p.x} y2={p.y}
                stroke={near[i]!.tie === "spot" ? ACCENT_TEXT : INK} strokeWidth={near[i]!.tie === "spot" ? 3 : 3.5} strokeDasharray={near[i]!.tie === "spot" ? "10 8" : undefined}
                strokeOpacity={0.85}
              />
            ))}
          </svg>
        )}
        {s &&
          pts.map((p, i) => {
            const n = near[i]!.node;
            const sz = 84;
            return (
              <div key={n.id} style={{ display: "flex", position: "absolute", left: p.x - sz / 2, top: p.y - sz / 2 }}>
                <Tile label={n.label} src={assets.near[i] ?? null} size={sz} color={PASTELS[n.color % 5]!} square={n.kind === "brand" || n.kind === "holder"} />
              </div>
            );
          })}
        <div style={{ display: "flex", position: "absolute", left: cx - 70, top: cy - 70 }}>
          {s ? (
            <Tile label={s.me.label} src={assets.me} size={140} color={PASTELS[s.me.color % 5]!} square={s.me.kind === "brand"} ring />
          ) : (
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", width: 200, height: 200, borderRadius: 44, overflow: "hidden", background: ORANGE,
                border: `6px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, transform: "rotate(-6deg)", marginLeft: -30, marginTop: -30,
              }}
            >
              {assets.banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assets.banner} width={200} height={200} style={{ width: 200, height: 200, objectFit: "cover" }} alt="" />
              ) : (
                <span style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 130, color: "#FFFFFF" }}>p</span>
              )}
            </div>
          )}
        </div>
        {s && (
          <div style={{ display: "flex", position: "absolute", left: 0, top: cy + 88, width: W, justifyContent: "center" }}>
            <div style={{ display: "flex", background: PAPER, padding: "2px 14px", borderRadius: 14, border: `3px solid ${INK}`, fontFamily: "Bricolage", fontWeight: 800, fontSize: 28 }}>{s.me.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}
