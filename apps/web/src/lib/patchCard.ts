// The Living Patch card: an embroidered patch sewn onto the creator's fabric, with a woven label that carries the
// facts and a passport stamp for every proven step. docs/nft-design/mockups-v2.html is the design;
// contracts/src/PatchRenderer.sol draws the same card on-chain (system fonts, no photo). Keep the two in step.
//
// Pure string building, so it runs in the browser, in a route handler and in a script.

export type PatchStage = "won" | "printed" | "seen" | "delivered" | "refunded" | "disputed";
export type CardSurface = "Outfit" | "Car" | "Team hoodie";
export type Tier = "Cotton" | "Silk" | "Gold";

export interface CardInput {
  /** Unique per card on a page: SVG ids are global inside one HTML document. */
  id: string;
  brand: string;
  label: string;
  /** The event name, or the surface name when the listing has no event. */
  event: string;
  creator: string;
  surface: CardSurface;
  /** Winning bid, 6-decimal USDC. */
  amount: bigint;
  listing: number | string;
  patchId: number;
  sponsorNo: number;
  stage: PatchStage;
  /** Proofs after the first one that are in (the "Seen n/m" step). */
  seen: number;
  seenOf: number;
  /** Unix seconds when the first proof and the newest later proof were posted. */
  printedAt?: number;
  seenAt?: number;
  /** The proof photo (data: or https: URL). Only the website uses it; the on-chain card has none. */
  photo?: string;
  /** System fonts only: what a marketplace shows without web fonts. */
  system?: boolean;
}

const PASTEL = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Fabric the patch is sewn onto, one per surface. */
export const FABRIC: Record<CardSurface, { name: string; base: string; hi: string; text: string }> = {
  Outfit: { name: "Denim", base: "#22385C", hi: "#2F4C78", text: "#F4EFE3" },
  Car: { name: "Racing paint", base: "#1D5A45", hi: "#2B7A5E", text: "#F4EFE3" },
  "Team hoodie": { name: "Fleece", base: "#24212E", hi: "#353046", text: "#F4EFE3" },
};

/** The five patch outlines, centred on (500, 430). `inner` is the width the brand name may use. */
const SHAPES: { name: string; inner: number; d: string }[] = [
  { name: "Rounded", inner: 470, d: "M280 260 H720 A70 70 0 0 1 790 330 V530 A70 70 0 0 1 720 600 H280 A70 70 0 0 1 210 530 V330 A70 70 0 0 1 280 260 Z" },
  { name: "Round", inner: 350, d: "M265 430 a235 235 0 1 0 470 0 a235 235 0 1 0 -470 0 Z" },
  { name: "Shield", inner: 360, d: "M275 225 Q500 180 725 225 V435 Q725 605 500 685 Q275 605 275 435 Z" },
  { name: "Hexagon", inner: 310, d: "M720.8 557.5 L500.0 685.0 L279.2 557.5 L279.2 302.5 L500.0 175.0 L720.8 302.5 Z" },
  {
    name: "Scalloped",
    inner: 330,
    d: "M715.0 430.0 A39.5 39.5 0 0 1 702.0 503.5 A39.5 39.5 0 0 1 664.7 568.2 A39.5 39.5 0 0 1 607.5 616.2 A39.5 39.5 0 0 1 537.3 641.7 A39.5 39.5 0 0 1 462.7 641.7 A39.5 39.5 0 0 1 392.5 616.2 A39.5 39.5 0 0 1 335.3 568.2 A39.5 39.5 0 0 1 298.0 503.5 A39.5 39.5 0 0 1 285.0 430.0 A39.5 39.5 0 0 1 298.0 356.5 A39.5 39.5 0 0 1 335.3 291.8 A39.5 39.5 0 0 1 392.5 243.8 A39.5 39.5 0 0 1 462.7 218.3 A39.5 39.5 0 0 1 537.3 218.3 A39.5 39.5 0 0 1 607.5 243.8 A39.5 39.5 0 0 1 664.7 291.8 A39.5 39.5 0 0 1 702.0 356.5 A39.5 39.5 0 0 1 715.0 430.0 Z",
  },
];

export const shapeName = (patchId: number) => SHAPES[patchId % 5]!.name;

export function tierOf(amount: bigint): Tier {
  return amount >= 1_000_000_000n ? "Gold" : amount >= 100_000_000n ? "Silk" : "Cotton";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** 1234500000n -> "1,234.50", 420000000n -> "420". Cents show only when there are some. */
export function fmtUsd(amount: bigint): string {
  const whole = (amount / 1_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = Number((amount % 1_000_000n) / 10_000n);
  return cents === 0 ? whole : `${whole}.${String(cents).padStart(2, "0")}`;
}

/** "SEP 28" in UTC, the same on-chain and here. */
export function fmtDay(unix: number): string {
  const d = new Date(unix * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** What the card calls an address with no name: 0x8fbf..99d1 (lowercase, two dots, like the on-chain card). */
export function shortAddress(a: string): string {
  return `${a.slice(0, 6)}..${a.slice(-4)}`.toLowerCase();
}

function stamp(id: string, cx: number, cy: number, r: number, rot: number, color: string, rim: string, word: string, sub: string, F: Fonts) {
  const rr = r - 24;
  return `<g transform="rotate(${rot} ${cx} ${cy})" opacity=".92"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#000" fill-opacity=".22" stroke="${color}" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${r - 44}" fill="none" stroke="${color}" stroke-width="2.5"/><path id="rim-${id}" d="M${cx - rr} ${cy} a${rr} ${rr} 0 1 1 ${2 * rr} 0 a${rr} ${rr} 0 1 1 -${2 * rr} 0" fill="none"/><text font-family="${F.mono}" font-weight="600" font-size="15" letter-spacing="2" fill="${color}"><textPath href="#rim-${id}" startOffset="2%">${esc(rim)}</textPath></text><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${word.length > 6 ? 24 : 32}" fill="${color}">${esc(word)}</text><text x="${cx}" y="${cy + 30}" text-anchor="middle" font-family="${F.mono}" font-weight="600" font-size="16" fill="${color}">${esc(sub)}</text></g>`;
}

interface Fonts {
  display: string;
  body: string;
  mono: string;
}

const WEB_FONTS: Fonts = {
  display: "Bricolage Grotesque, Arial Black, sans-serif",
  body: "Geist, Arial, sans-serif",
  mono: "Geist Mono, monospace",
};
const SYSTEM_FONTS: Fonts = {
  display: "Arial Black, Arial, Helvetica, sans-serif",
  body: "Arial, Helvetica, sans-serif",
  mono: "Courier New, monospace",
};

export function patchCard(o: CardInput): string {
  const F = o.system ? SYSTEM_FONTS : WEB_FONTS;
  const id = o.id;
  const fab = FABRIC[o.surface];
  const tier = tierOf(o.amount);
  const fill = PASTEL[o.patchId % 5]!;
  const stage = o.stage;
  const progressed = stage === "printed" || stage === "seen" || stage === "delivered";
  const photo = progressed && !!o.photo;
  const unpicked = stage === "refunded";
  const price = fmtUsd(o.amount);

  // With a photo the patch shrinks to a sticker in the lower left. Without one it moves left to make room for the
  // stamps. Won, refunded and disputed show it at full size.
  const S = photo
    ? { scale: 0.56, tx: -255, ty: 215 }
    : progressed
      ? { scale: 0.74, tx: -90, ty: 36 }
      : { scale: 1, tx: 0, ty: 0 };
  const sh = SHAPES[o.patchId % 5]!;
  const n = Math.max(o.brand.length, 4);
  const size = Math.min(112, Math.floor((sh.inner * 10) / (n * 6)));
  const tierStroke = { Cotton: "#0B0B0C", Silk: `url(#silk-${id})`, Gold: `url(#gold-${id})` }[tier];

  const defs = `<defs><pattern id="twill-${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="14" height="14" fill="${fab.base}"/><rect width="6" height="14" fill="${fab.hi}" opacity=".55"/></pattern><pattern id="satin-${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="4" height="9" fill="#fff" opacity=".22"/></pattern><pattern id="thread-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)"><rect width="6" height="6" fill="#0B0B0C"/><rect width="2" height="6" fill="#fff" opacity=".18"/></pattern><linearGradient id="gold-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5300"/><stop offset=".3" stop-color="#F7D774"/><stop offset=".55" stop-color="#B8860B"/><stop offset=".8" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/></linearGradient><linearGradient id="silk-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#836EF9"/><stop offset=".5" stop-color="#FF8AD8"/><stop offset="1" stop-color="#7FD3FF"/></linearGradient><linearGradient id="fade-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient><linearGradient id="sheen-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="lift-${id}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter><filter id="grey-${id}"><feColorMatrix type="saturate" values="0"/></filter><clipPath id="clip-${id}"><path d="${sh.d}"/></clipPath></defs>`;

  const bg = photo
    ? `<image href="${esc(o.photo!)}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid slice"/><rect width="1000" height="1000" fill="url(#fade-${id})"/>`
    : `<rect width="1000" height="1000" fill="url(#twill-${id})"${unpicked ? ` filter="url(#grey-${id})"` : ""}/><rect x="0" y="0" width="1000" height="1000" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="40"/>${o.surface === "Car" ? `<rect x="330" y="0" width="70" height="1000" fill="#F4EFE3" opacity=".9"/><rect x="600" y="0" width="70" height="1000" fill="#F4EFE3" opacity=".9"/>` : ""}`;

  const patch = unpicked
    ? `<path d="${sh.d}" fill="#000" fill-opacity=".18"/><path d="${sh.d}" fill="none" stroke="#F4EFE3" stroke-opacity=".75" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round"/><path d="${sh.d}" transform="translate(500 430) scale(.9) translate(-500 -430)" fill="none" stroke="#F4EFE3" stroke-opacity=".45" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round"/>`
    : `<g filter="url(#lift-${id})"><path d="${sh.d}" fill="${fill}"/><path d="${sh.d}" fill="url(#satin-${id})"/><g clip-path="url(#clip-${id})"><rect x="0" y="0" width="1000" height="390" fill="#fff" opacity=".18"/></g><path d="${sh.d}" fill="none" stroke="${tierStroke}" stroke-width="26"/><path d="${sh.d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="26" stroke-dasharray="2.5 4.5"/>${tier === "Gold" ? `<path d="${sh.d}" fill="none" stroke="url(#sheen-${id})" stroke-width="26"/>` : ""}<path d="${sh.d}" transform="translate(500 430) scale(.86) translate(-500 -430)" fill="none" stroke="#0B0B0C" stroke-opacity=".55" stroke-width="5" stroke-dasharray="13 9"/><text x="500" y="${430 + Math.floor((size * 35) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" letter-spacing="-0.02em" fill="url(#thread-${id})" stroke="#0B0B0C" stroke-width="2">${esc(o.brand)}</text></g>`;

  const rimEvent = o.event.toUpperCase();
  const stamps: string[] = [];
  if (progressed) stamps.push(stamp(`${id}a`, 795, 245, 105, -14, "#FF7A45", "PATCHED · PRINTED · PATCHED · ", "PRINTED", o.printedAt ? fmtDay(o.printedAt) : "", F));
  if ((stage === "seen" || stage === "delivered") && o.seen > 0) {
    stamps.push(stamp(`${id}b`, 820, 500, 95, 11, "#C9BCFF", `${rimEvent} · SEEN · `, "SEEN", o.seenAt ? fmtDay(o.seenAt) : "", F));
  }
  const delivered =
    stage === "delivered"
      ? `<g transform="rotate(-10 640 680)"><rect x="470" y="618" width="380" height="118" rx="14" fill="none" stroke="#FF5A1F" stroke-width="9"/><rect x="484" y="632" width="352" height="90" rx="8" fill="none" stroke="#FF5A1F" stroke-width="3"/><text x="660" y="696" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="56" letter-spacing="0.05em" fill="#FF5A1F">DELIVERED</text></g>`
      : "";
  const refunded = unpicked
    ? `<g transform="rotate(-9 500 430)"><rect x="235" y="372" width="530" height="118" rx="14" fill="none" stroke="#F4EFE3" stroke-width="8"/><text x="500" y="452" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="54" fill="#F4EFE3">REFUNDED $${price}</text></g>`
    : "";
  const disputed =
    stage === "disputed"
      ? `<g transform="rotate(-8 500 420)"><rect x="-60" y="380" width="1120" height="74" fill="#FFD400"/><g fill="#0B0B0C">${Array.from({ length: 28 }, (_, k) => `<path d="M${-60 + k * 44} 380 l24 0 -30 74 -24 0z"/>`).join("")}</g><rect x="250" y="388" width="500" height="58" fill="#FFD400"/><text x="500" y="428" text-anchor="middle" font-family="${F.body}" font-weight="600" font-size="30" letter-spacing="0.14em" fill="#0B0B0C">PROOF DISPUTED</text></g>`
      : "";

  const first = o.sponsorNo === 1;
  const header = `<text x="64" y="118" font-family="${F.display}" font-weight="800" font-size="76" letter-spacing="-0.04em" fill="${fab.text}">No.${String(o.sponsorNo).padStart(3, "0")}</text><text x="68" y="158" font-family="${F.mono}" font-weight="600" font-size="22" letter-spacing="2" fill="${first ? "#FFB08F" : fab.text}" opacity="${first ? 1 : 0.8}">${first ? "FIRST SPONSOR OF" : "SPONSOR OF"} @${esc(o.creator.toUpperCase())}</text><g transform="translate(872 64) rotate(-8 25 25) scale(1.5)"><rect x="6" y="6" width="31" height="31" rx="9" fill="#0B0B0C"/><rect x="3.5" y="3.5" width="31" height="31" rx="9" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="2.4"/><rect x="7.8" y="7.8" width="22.4" height="22.4" rx="5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M15.5 28V12.5h5.2a4.4 4.4 0 0 1 0 8.8h-5.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;

  const done = { won: 1, printed: 2, seen: 3, delivered: 4, refunded: 0, disputed: 2 }[stage];
  const stageWord = { won: "WON", printed: "PRINTED", seen: `SEEN ${o.seen}/${o.seenOf}`, delivered: "DELIVERED", refunded: "REFUNDED", disputed: "IN REVIEW" }[stage];
  const stageColor = stage === "refunded" ? "#5F5B53" : stage === "disputed" ? "#B42318" : "#E0430B";
  const label = `<rect x="52" y="800" width="896" height="150" rx="8" fill="#000" opacity=".3" transform="translate(0 8)"/><rect x="52" y="800" width="896" height="150" rx="8" fill="#F4EFE3"/><rect x="52" y="800" width="896" height="150" rx="8" fill="url(#satin-${id})" opacity=".35"/><line x1="76" y1="812" x2="76" y2="938" stroke="#0B0B0C" stroke-opacity=".35" stroke-width="3" stroke-dasharray="7 6"/><line x1="924" y1="812" x2="924" y2="938" stroke="#0B0B0C" stroke-opacity=".35" stroke-width="3" stroke-dasharray="7 6"/><text x="100" y="862" font-family="${F.display}" font-weight="800" font-size="42" letter-spacing="-0.03em" fill="#0B0B0C">${esc(o.label)}</text><text x="100" y="903" font-family="${F.mono}" font-weight="500" font-size="23" fill="#5F5B53">${esc(o.event)} · $${price} USDC · ${tier.toUpperCase()}</text><text x="100" y="932" font-family="${F.mono}" font-weight="500" font-size="19" fill="#5F5B53" opacity=".85">PATCHED ON MONAD · #${o.listing}-${o.patchId}</text><text x="900" y="862" text-anchor="end" font-family="${F.display}" font-weight="800" font-size="34" fill="${stageColor}">${stageWord}</text>${[0, 1, 2, 3].map((k) => `<rect x="${740 + k * 42}" y="890" width="32" height="14" rx="7" fill="${k < done ? "#FF5A1F" : "#0B0B0C"}" fill-opacity="${k < done ? 1 : 0.15}"/>`).join("")}`;

  return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.brand)} patch, ${stage}">${defs}${bg}<g transform="translate(${S.tx} ${S.ty}) translate(500 430) scale(${S.scale}) translate(-500 -430)">${patch}</g>${stamps.join("")}${delivered}${refunded}${disputed}${header}${label}</svg>`;
}
