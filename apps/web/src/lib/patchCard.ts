// The patch NFT card, drawn as what it is: an embroidered patch. A big stitched patch sits on dark cloth under a studio
// light, its thread border changes with the price tier (cotton, silk, gold), passport ink stamps land as the creator
// proves each step, and a thread along the bottom is sewn one knot further each time. docs/nft-plan.md is the idea;
// contracts/src/PatchRenderer.sol draws the same card on-chain (system fonts). Keep the two in step.
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
  /** Not drawn into the card any more: proof photos live on IPFS and show on the token page. Kept for callers. */
  photo?: string;
  /** System fonts only: what a marketplace shows without web fonts. */
  system?: boolean;
  /** The brand's logo and the creator's photo (http(s) or data: image URLs). Web only: the on-chain card has none. */
  brandLogo?: string | null;
  creatorAvatar?: string | null;
}

/** Only real image URLs go into the card (no javascript:, no quotes breaking out of the attribute). */
const imageUrl = (u?: string | null) => (u && /^(https:\/\/|data:image\/)[^"<>\s]+$/.test(u) ? u : null);

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const INK = "#0B0B0C";
const CREAM = "#F4EFE3";
const MUTED = "#A39B8C";
const ORANGE = "#FF5A1F";

/** What the card calls each surface (the "Art" trait). `window` is kept for callers that tint with it. */
export const FABRIC: Record<CardSurface, { name: string; window: string }> = {
  Outfit: { name: "Tee", window: "#D9CCFF" },
  Car: { name: "Car", window: "#BFE3FF" },
  "Team hoodie": { name: "Hoodie", window: "#FFE58F" },
};

/**
 * The five patch outlines, centred on (0, 0). `maxW` is the width the brand name may use; `s` scales the outline so
 * all five read about the same size on the card.
 */
const SHAPES: { name: string; maxW: number; s: number; d: string }[] = [
  { name: "Rounded", maxW: 420, s: 1.06, d: "M-216.5 -175 H216.5 A73.5 73.5 0 0 1 290 -101.5 V101.5 A73.5 73.5 0 0 1 216.5 175 H-216.5 A73.5 73.5 0 0 1 -290 101.5 V-101.5 A73.5 73.5 0 0 1 -216.5 -175 Z" },
  { name: "Round", maxW: 262, s: 1.4, d: "M-175 0 a175 175 0 1 0 350 0 a175 175 0 1 0 -350 0 Z" },
  { name: "Shield", maxW: 330, s: 1.2, d: "M-226.2 -175 Q0 -206.5 226.2 -175 V8.8 Q226.2 122.5 0 183.8 Q-226.2 122.5 -226.2 8.8 Z" },
  { name: "Hexagon", maxW: 330, s: 1.06, d: "M-290 0 L-145 -175 L145 -175 L290 0 L145 175 L-145 175 Z" },
  {
    name: "Scalloped",
    maxW: 230,
    s: 1.5,
    d: "M160 0 A34.4 34.4 0 0 1 147.8 61.2 A34.4 34.4 0 0 1 113.1 113.1 A34.4 34.4 0 0 1 61.2 147.8 A34.4 34.4 0 0 1 0 160 A34.4 34.4 0 0 1 -61.2 147.8 A34.4 34.4 0 0 1 -113.1 113.1 A34.4 34.4 0 0 1 -147.8 61.2 A34.4 34.4 0 0 1 -160 0 A34.4 34.4 0 0 1 -147.8 -61.2 A34.4 34.4 0 0 1 -113.1 -113.1 A34.4 34.4 0 0 1 -61.2 -147.8 A34.4 34.4 0 0 1 0 -160 A34.4 34.4 0 0 1 61.2 -147.8 A34.4 34.4 0 0 1 113.1 -113.1 A34.4 34.4 0 0 1 147.8 -61.2 A34.4 34.4 0 0 1 160 0 Z",
  },
];

/** The cloth each patch is made of (`f`), and the thread its name is stitched in (`t`). */
const CLOTH: { f: string; t: string }[] = [
  { f: "#FF5A1F", t: "#FFF4E6" },
  { f: "#16161A", t: "#F4EFE3" },
  { f: "#F4EFE3", t: "#16161A" },
  { f: "#836EF9", t: "#FFFFFF" },
  { f: "#1F9D6B", t: "#F4FFF8" },
];

/** A sewing-pattern outline of each surface, drawn big and faint behind the patch (centred, local coordinates). */
const PATTERN: Record<CardSurface, string> = {
  Outfit: `<path transform="translate(500 90) scale(1.35)" d="M-110 0 Q0 60 110 0 L250 90 L300 290 L215 320 L180 210 L180 600 L-180 600 L-180 210 L-215 320 L-300 290 L-250 90 Z"/><path transform="translate(500 90) scale(1.35)" d="M-110 0 Q0 60 110 0"/>`,
  Car: `<path transform="translate(500 470) scale(1.5)" d="M-340 190 C-340 150 -320 135 -268 128 L-190 70 C-160 40 -120 28 -60 26 L92 26 C140 26 170 40 200 70 L272 128 C322 135 340 150 340 190 L340 240 L-340 240 Z"/><circle transform="translate(500 470) scale(1.5)" cx="-190" cy="242" r="52"/><circle transform="translate(500 470) scale(1.5)" cx="190" cy="242" r="52"/>`,
  "Team hoodie": `<path transform="translate(500 90) scale(1.4)" d="M-120 40 Q-60 -10 0 -10 Q60 -10 120 40 L240 120 L300 330 L220 360 L180 230 L180 600 L-180 600 L-180 230 L-220 360 L-300 330 L-240 120 Z"/><path transform="translate(500 90) scale(1.4)" d="M-95 30 Q0 140 95 30 M-110 470 Q0 500 110 470 L110 560 L-110 560 Z"/>`,
};

/** The backdrop lighting, the thread border and the glow for each price tier. */
const TIER: Record<Tier, { bg: [string, string]; glow: string; thread: string; rim: string }> = {
  Cotton: {
    bg: ["#3A322C", "#0E0D0C"],
    glow: "#FF7A45",
    thread: `<stop offset="0" stop-color="#FFFBF0"/><stop offset=".5" stop-color="#D6CCB4"/><stop offset="1" stop-color="#FBF5E4"/>`,
    rim: "#FF7A45",
  },
  Silk: {
    bg: ["#3B2F8F", "#0C0A26"],
    glow: "#FF8AD8",
    thread: `<stop offset="0" stop-color="#836EF9"/><stop offset=".35" stop-color="#FF8AD8"/><stop offset=".7" stop-color="#7FD3FF"/><stop offset="1" stop-color="#B49CFF"/>`,
    rim: "#B49CFF",
  },
  Gold: {
    bg: ["#5A410C", "#0F0A01"],
    glow: "#FFD76A",
    thread: `<stop offset="0" stop-color="#8A6100"/><stop offset=".25" stop-color="#F7D774"/><stop offset=".5" stop-color="#B8860B"/><stop offset=".75" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/>`,
    rim: "#FFD76A",
  },
};

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

/** A font size that fits `text` in `maxW` (about 0.66 em per character), capped at `max`. Same maths on-chain. */
const fit = (text: string, maxW: number, max: number) => Math.min(max, Math.floor((maxW * 100) / (Math.max(text.length, 3) * 66)));

/** How many of the four steps (won, printed, seen, delivered) are lit. */
const DONE: Record<PatchStage, number> = { won: 1, refunded: 1, printed: 2, disputed: 2, seen: 3, delivered: 4 };

/** A round passport stamp: double ring, a word, and the day underneath. */
function roundStamp(key: string, cx: number, cy: number, r: number, rot: number, color: string, word: string, wordSize: number, sub: string, F: Fonts, id: string) {
  return `<g id="${key}" transform="rotate(${rot} ${cx} ${cy})" filter="url(#ink-${id})"><circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="#000" fill-opacity=".34"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="7"/><circle cx="${cx}" cy="${cy}" r="${r - 13}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="5 5"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${wordSize}" fill="${color}">${word}</text><text x="${cx}" y="${cy + 34}" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="17" fill="${color}">${esc(sub)}</text></g>`;
}

/** A rectangular stamp (DELIVERED, REFUNDED): double border and a word. */
function rectStamp(key: string, x: number, y: number, w: number, size: number, rot: number, color: string, word: string, F: Fonts, id: string) {
  const h = Math.floor((size * 18) / 10);
  return `<g id="${key}" transform="rotate(${rot} ${x + Math.floor(w / 2)} ${y + 40})" filter="url(#ink-${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#000" fill-opacity=".38" stroke="${color}" stroke-width="8"/><rect x="${x + 11}" y="${y + 11}" width="${w - 22}" height="${h - 22}" rx="5" fill="none" stroke="${color}" stroke-width="2.5"/><text x="${x + Math.floor(w / 2)}" y="${y + Math.floor((size * 125) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" letter-spacing="3" fill="${color}">${esc(word)}</text></g>`;
}

export function patchCard(o: CardInput): string {
  const F = o.system ? SYSTEM_FONTS : WEB_FONTS;
  const id = o.id;
  const tier = tierOf(o.amount);
  const T = TIER[tier];
  const stage = o.stage;
  const done = DONE[stage];
  const sh = SHAPES[o.patchId % 5]!;
  const cloth = CLOTH[o.patchId % 5]!;
  const price = `$${fmtUsd(o.amount)}`;
  const logo = imageUrl(o.brandLogo);
  const avatar = imageUrl(o.creatorAvatar);
  const refunded = stage === "refunded";

  const defs = `<defs>
<radialGradient id="bg-${id}" cx=".5" cy=".42" r=".78"><stop offset="0" stop-color="${T.bg[0]}"/><stop offset="1" stop-color="${T.bg[1]}"/></radialGradient>
<radialGradient id="glow-${id}" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="${T.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${T.glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="vig-${id}" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<linearGradient id="thread-${id}" x1="0" y1="0" x2="1" y2="1">${T.thread}</linearGradient>
<linearGradient id="gloss-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
${tier === "Gold" ? `<linearGradient id="sheen-${id}" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(28 .5 .5)"><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ""}
<pattern id="weave-${id}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 2H8M0 6H8" stroke="#fff" stroke-opacity=".045" stroke-width="2"/><path d="M2 0V8M6 0V8" stroke="#000" stroke-opacity=".16" stroke-width="2"/></pattern>
<pattern id="twill-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="2.4" height="6" fill="#000" opacity=".15"/><rect x="3.2" width="1" height="6" fill="#fff" opacity=".12"/></pattern>
<pattern id="satin-${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(60)"><rect width="2.4" height="7" fill="#fff" opacity=".26"/></pattern>
<path id="shape-${id}" d="${sh.d}"/>
<clipPath id="labelclip-${id}"><use href="#shape-${id}" transform="scale(.8)"/></clipPath>
<clipPath id="faceclip-${id}"><circle cx="116" cy="767" r="28"/></clipPath>
<filter id="blur-${id}" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="puff-${id}" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feSpecularLighting in="b" surfaceScale="5" specularConstant=".95" specularExponent="22" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sc"/><feComposite in="SourceGraphic" in2="sc" operator="arithmetic" k1="0" k2="1" k3=".7" k4="0"/></filter>
<filter id="ink-${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 6.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
${refunded ? `<filter id="grey-${id}"><feColorMatrix type="saturate" values="0.1"/></filter>` : ""}
</defs>`;

  // Backdrop: the cloth the patch is sewn on, lit from the middle, with a faint sewing pattern of the surface.
  const backdrop = `<rect width="1000" height="1000" fill="url(#bg-${id})"/><rect width="1000" height="1000" fill="url(#weave-${id})"/><g fill="none" stroke="${CREAM}" stroke-opacity=".11" stroke-width="3.5" stroke-dasharray="11 9" stroke-linejoin="round" stroke-linecap="round">${PATTERN[o.surface]}</g><rect width="1000" height="1000" fill="url(#glow-${id})"/>`;

  // The embroidered patch: shadow, outline, cloth, twill, a merrowed thread border, running stitch, then the name.
  const size = fit(o.brand, sh.maxW, 108);
  const word = logo
    ? `<g clip-path="url(#labelclip-${id})"><use href="#shape-${id}" transform="scale(.8)" fill="${CREAM}"/><image href="${esc(logo)}" x="-225" y="-135" width="450" height="270" preserveAspectRatio="xMidYMid meet"/></g><use href="#shape-${id}" transform="scale(.8)" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="4"/>`
    : `<text x="3" y="${Math.floor((size * 35) / 100) + 5}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" fill="#000" opacity=".38" stroke="#000" stroke-width="3">${esc(o.brand)}</text><text x="0" y="${Math.floor((size * 35) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" fill="${cloth.t}" stroke="${cloth.t}" stroke-width="3" stroke-linejoin="round">${esc(o.brand)}</text><text x="0" y="${Math.floor((size * 35) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" fill="url(#satin-${id})">${esc(o.brand)}</text>`;
  const patch = refunded
    ? `<g transform="translate(500 440) rotate(-3) scale(${sh.s})"><use href="#shape-${id}" fill="none" stroke="${CREAM}" stroke-opacity=".55" stroke-width="10" stroke-dasharray="4 18" stroke-linecap="round"/></g>`
    : `<g transform="translate(500 440) rotate(-3) scale(${sh.s})"><use href="#shape-${id}" transform="translate(9 22)" fill="#000" opacity=".6" filter="url(#blur-${id})"/><g filter="url(#puff-${id})"><use href="#shape-${id}" fill="${INK}" stroke="${INK}" stroke-width="42" stroke-linejoin="round"/><use href="#shape-${id}" fill="${cloth.f}"/><use href="#shape-${id}" fill="url(#twill-${id})"/><use href="#shape-${id}" fill="none" stroke="url(#thread-${id})" stroke-width="30" stroke-linejoin="round"/><use href="#shape-${id}" fill="none" stroke="${INK}" stroke-opacity=".38" stroke-width="30" stroke-dasharray="2.4 4.2"/><use href="#shape-${id}" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="30" stroke-dasharray="1.2 5.4" stroke-dashoffset="2"/><use href="#shape-${id}" transform="scale(.8)" fill="none" stroke="${cloth.t}" stroke-opacity=".7" stroke-width="4.5" stroke-dasharray="15 10" stroke-linecap="round"/>${word}<use href="#shape-${id}" fill="url(#gloss-${id})"/>${tier === "Gold" ? `<use href="#shape-${id}" fill="url(#sheen-${id})"/>` : ""}</g></g>`;

  // Passport stamps, one per proven step, in ink; then the refund stamp or the dispute tape over the patch.
  const stamps = [
    done >= 2 ? roundStamp(`stamp-printed-${id}`, 150, 212, 62, -14, "#FF8A5C", "PRINTED", 23, o.printedAt ? fmtDay(o.printedAt) : "", F, id) : "",
    done >= 3 ? roundStamp(`stamp-seen-${id}`, 852, 218, 58, 12, "#B6A8FF", "SEEN", 30, o.seenAt ? fmtDay(o.seenAt) : "", F, id) : "",
    done >= 4 ? rectStamp(`stamp-delivered-${id}`, 520, 566, 360, 40, -7, "#3DDC97", "DELIVERED", F, id) : "",
  ].join("");
  const overlay = refunded
    ? rectStamp(`stamp-refunded-${id}`, 240, 380, 520, 46, -9, CREAM, `REFUNDED ${price}`, F, id)
    : stage === "disputed"
      ? `<g transform="rotate(-9 500 440)"><rect x="60" y="400" width="880" height="72" fill="#FFD400" stroke="${INK}" stroke-width="4"/><g fill="${INK}">${Array.from({ length: 21 }, (_, k) => `<path d="M${60 + k * 42} 400 l22 0 -26 72 -22 0z"/>`).join("")}</g><rect x="300" y="408" width="400" height="56" fill="#FFD400"/><text x="500" y="447" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="30" fill="${INK}">PROOF DISPUTED</text></g>`
      : "";

  // Top: which sponsor this is and its tier thread on the left, the price on the right.
  const num = o.sponsorNo > 0 ? `No.${String(o.sponsorNo).padStart(3, "0")}` : `#${o.listing}.${o.patchId + 1}`;
  const top = `<text x="64" y="86" font-family="${F.mono}" font-weight="700" font-size="30" fill="${CREAM}">${num}</text><text x="64" y="116" font-family="${F.mono}" font-weight="700" font-size="17" letter-spacing="3" fill="${T.rim}">${tier.toUpperCase()} THREAD</text><rect x="${936 - 168}" y="52" width="168" height="62" rx="31" fill="${ORANGE}" stroke="${INK}" stroke-width="4"/><text x="${936 - 84}" y="${price.length <= 6 ? 94 : 90}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${price.length <= 4 ? 36 : price.length <= 6 ? 31 : 24}" fill="#fff">${price}<tspan font-family="${F.mono}" font-size="14" font-weight="700" dx="5">USDC</tspan></text>`;

  // Under the patch: who it is on, and where.
  const hasEvent = o.event !== o.surface;
  const typeText = `${o.surface} · ${o.label}${hasEvent ? ` · ${o.event}` : ""}`.toUpperCase();
  const typeSize = typeText.length <= 44 ? 20 : Math.max(13, Math.floor((20 * 44) / typeText.length));
  const who = `@${o.creator}`;
  const whoSize = Math.max(26, Math.min(40, Math.floor((avatar ? 640 : 760) * 100 / (Math.max(who.length, 4) * 56))));
  const caption = `${avatar ? `<circle cx="116" cy="767" r="31" fill="${CREAM}" stroke="${INK}" stroke-width="3"/><image href="${esc(avatar)}" x="88" y="739" width="56" height="56" preserveAspectRatio="xMidYMid slice" clip-path="url(#faceclip-${id})"/>` : ""}<text x="${avatar ? 164 : 64}" y="776" font-family="${F.display}" font-weight="800" font-size="${whoSize}" fill="${CREAM}">${esc(who)}</text><text x="${avatar ? 164 : 64}" y="808" font-family="${F.mono}" font-weight="700" font-size="${typeSize}" fill="${MUTED}">${esc(typeText)}</text>`;

  // The thread: sewn one knot further for each step that is proven.
  const steps = ["WON", "PRINTED", stage === "seen" ? `SEEN ${o.seen}/${o.seenOf}` : "SEEN", "DELIVERED"];
  const xs = [96, 365, 635, 904];
  const sewn = xs[Math.max(0, done - 1)]!;
  const track =
    `<path d="M96 862 H904" stroke="${CREAM}" stroke-opacity=".28" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round"/>` +
    `<path d="M96 862 H${sewn}" stroke="${T.rim}" stroke-width="7" stroke-dasharray="14 7" stroke-linecap="round"/>` +
    steps
      .map((label, i) => {
        const x = xs[i]!;
        const on = i < done;
        return `<circle cx="${x}" cy="862" r="${on ? 17 : 13}" fill="${on ? ORANGE : INK}" stroke="${on ? CREAM : "#5A5348"}" stroke-width="${on ? 4 : 3}"/>${on ? `<path d="M${x - 7} 862 l5 6 10 -12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : ""}<text x="${x}" y="918" text-anchor="${i === 0 ? "start" : i === 3 ? "end" : "middle"}" ${i === 0 ? `dx="-12"` : i === 3 ? `dx="12"` : ""} font-family="${F.mono}" font-weight="700" font-size="19" fill="${on ? CREAM : "#6E675B"}">${label}</text>`;
      })
      .join("");
  const footer = `<text x="500" y="968" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="15" letter-spacing="5" fill="#6E675B">PATCHED · MONAD</text>`;

  return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.brand)} patch, ${stage}">${defs}<g${refunded ? ` filter="url(#grey-${id})" opacity=".85"` : ""}>${backdrop}${patch}${stamps}${overlay}${top}${caption}${track}${footer}<rect width="1000" height="1000" fill="url(#vig-${id})"/></g></svg>`;
}
