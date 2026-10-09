// The patch NFT card: a collectible trading card. A thread-coloured frame shows the price tier, the art window shows the
// garment with the embroidered patch sewn on, passport stamps pile up as the creator proves each step, and a four-step
// track runs along the bottom. docs/nft-plan.md section 8 is the design; contracts/src/PatchRenderer.sol draws the same
// card on-chain (system fonts). Keep the two in step.
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

const PASTEL = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const INK = "#0B0B0C";
const ORANGE = "#FF5A1F";

/** What the card draws for each surface (the "Art" trait) and the colour of its art window. */
export const FABRIC: Record<CardSurface, { name: string; window: string }> = {
  Outfit: { name: "Tee", window: "#D9CCFF" },
  Car: { name: "Car", window: "#BFE3FF" },
  "Team hoodie": { name: "Hoodie", window: "#FFE58F" },
};

/** The five patch outlines, centred on (0, 0). `maxW` is the width the brand name may use. */
const SHAPES: { name: string; maxW: number; d: string }[] = [
  { name: "Rounded", maxW: 420, d: "M-216.5 -175 H216.5 A73.5 73.5 0 0 1 290 -101.5 V101.5 A73.5 73.5 0 0 1 216.5 175 H-216.5 A73.5 73.5 0 0 1 -290 101.5 V-101.5 A73.5 73.5 0 0 1 -216.5 -175 Z" },
  { name: "Round", maxW: 262, d: "M-175 0 a175 175 0 1 0 350 0 a175 175 0 1 0 -350 0 Z" },
  { name: "Shield", maxW: 330, d: "M-226.2 -175 Q0 -206.5 226.2 -175 V8.8 Q226.2 122.5 0 183.8 Q-226.2 122.5 -226.2 8.8 Z" },
  { name: "Hexagon", maxW: 330, d: "M-290 0 L-145 -175 L145 -175 L290 0 L145 175 L-145 175 Z" },
  {
    name: "Scalloped",
    maxW: 230,
    d: "M160 0 A34.4 34.4 0 0 1 147.8 61.2 A34.4 34.4 0 0 1 113.1 113.1 A34.4 34.4 0 0 1 61.2 147.8 A34.4 34.4 0 0 1 0 160 A34.4 34.4 0 0 1 -61.2 147.8 A34.4 34.4 0 0 1 -113.1 113.1 A34.4 34.4 0 0 1 -147.8 61.2 A34.4 34.4 0 0 1 -160 0 A34.4 34.4 0 0 1 -147.8 -61.2 A34.4 34.4 0 0 1 -113.1 -113.1 A34.4 34.4 0 0 1 -61.2 -147.8 A34.4 34.4 0 0 1 0 -160 A34.4 34.4 0 0 1 61.2 -147.8 A34.4 34.4 0 0 1 113.1 -113.1 A34.4 34.4 0 0 1 147.8 -61.2 A34.4 34.4 0 0 1 160 0 Z",
  },
];

/** The garment for each surface, in the art window's coordinates. */
const GARMENT: Record<CardSurface, string> = {
  Outfit: `<g transform="translate(500 215) scale(.62)"><path d="M-110 0 Q0 60 110 0 L250 90 L300 290 L215 320 L180 210 L180 600 L-180 600 L-180 210 L-215 320 L-300 290 L-250 90 Z" fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-110 0 Q0 60 110 0" fill="none" stroke="${INK}" stroke-width="8"/></g>`,
  Car: `<g transform="translate(500 300) scale(.95)"><path d="M-330 200 Q-330 130 -260 115 L-170 30 Q-145 5 -100 5 L110 5 Q150 5 175 30 L255 115 Q330 130 330 200 L330 260 L-330 260 Z" fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-150 110 L-95 40 L-10 40 L-10 110 Z M20 110 L20 40 L100 40 L160 110 Z" fill="#E8F2FF" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><circle cx="-190" cy="262" r="58" fill="${INK}"/><circle cx="-190" cy="262" r="24" fill="#fff"/><circle cx="190" cy="262" r="58" fill="${INK}"/><circle cx="190" cy="262" r="24" fill="#fff"/></g>`,
  "Team hoodie": `<g transform="translate(500 205) scale(.66)"><path d="M-120 40 Q-60 -10 0 -10 Q60 -10 120 40 L240 120 L300 330 L220 360 L180 230 L180 600 L-180 600 L-180 230 L-220 360 L-300 330 L-240 120 Z" fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-95 30 Q0 140 95 30" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-30 95 L-38 190 M30 95 L38 190" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M-110 470 Q0 500 110 470 L110 560 L-110 560 Z" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></g>`,
};

const TIER_FRAME: Record<Tier, string> = {
  Cotton: `<stop offset="0" stop-color="#2A2A2A"/><stop offset="1" stop-color="${INK}"/>`,
  Silk: `<stop offset="0" stop-color="#836EF9"/><stop offset=".5" stop-color="#FF8AD8"/><stop offset="1" stop-color="#7FD3FF"/>`,
  Gold: `<stop offset="0" stop-color="#8A6100"/><stop offset=".3" stop-color="#F7D774"/><stop offset=".55" stop-color="#B8860B"/><stop offset=".8" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/>`,
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

function roundStamp(key: string, cx: number, cy: number, r: number, rot: number, color: string, word: string, wordSize: number, sub: string, F: Fonts) {
  return `<g id="${key}" transform="rotate(${rot} ${cx} ${cy})" opacity=".88"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5 5"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${wordSize}" fill="${color}">${word}</text><text x="${cx}" y="${cy + 32}" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="16" fill="${color}">${esc(sub)}</text></g>`;
}

function rectStamp(key: string, x: number, y: number, w: number, size: number, rot: number, color: string, word: string, F: Fonts) {
  const h = Math.floor((size * 18) / 10);
  return `<g id="${key}" transform="rotate(${rot} ${x + Math.floor(w / 2)} ${y + 40})" opacity=".9"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${color}" stroke-width="7"/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="5" fill="none" stroke="${color}" stroke-width="2.5"/><text x="${x + Math.floor(w / 2)}" y="${y + Math.floor((size * 125) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" letter-spacing="3" fill="${color}">${esc(word)}</text></g>`;
}

export function patchCard(o: CardInput): string {
  const F = o.system ? SYSTEM_FONTS : WEB_FONTS;
  const id = o.id;
  const tier = tierOf(o.amount);
  const stage = o.stage;
  const done = DONE[stage];
  const sh = SHAPES[o.patchId % 5]!;
  const price = `$${fmtUsd(o.amount)}`;
  const at = o.surface === "Car" ? "translate(500 430) scale(.36) rotate(-3)" : "translate(500 380) scale(.36) rotate(-3)";

  const logo = imageUrl(o.brandLogo);
  const avatar = imageUrl(o.creatorAvatar);
  const defs = `<defs><clipPath id="logoclip-${id}"><circle cx="166" cy="122" r="36"/></clipPath><clipPath id="patchclip-${id}"><path d="${sh.d}" transform="scale(.8)"/></clipPath><clipPath id="faceclip-${id}"><circle cx="156" cy="733" r="26"/></clipPath><linearGradient id="tier-${id}" x1="0" y1="0" x2="1" y2="1">${TIER_FRAME[tier]}</linearGradient>${tier === "Gold" ? `<linearGradient id="sheen-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>` : ""}<pattern id="satin-${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="3.5" height="9" fill="#fff" opacity=".28"/></pattern><pattern id="dots-${id}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="#E2DDD0"/></pattern><pattern id="half-${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="9" cy="9" r="3" fill="#fff" opacity=".45"/></pattern>${stage === "refunded" ? `<filter id="grey-${id}"><feColorMatrix type="saturate" values="0.1"/></filter>` : ""}</defs>`;

  // The card: hard shadow, thread-coloured frame, cream panel, brand name and the price coin.
  const frame = `<rect x="70" y="40" width="860" height="930" rx="44" fill="${INK}" transform="translate(14 14)"/><rect x="70" y="40" width="860" height="930" rx="44" fill="url(#tier-${id})" stroke="${INK}" stroke-width="8"/>${tier === "Gold" ? `<rect x="70" y="40" width="860" height="930" rx="44" fill="url(#sheen-${id})"/>` : ""}<rect x="100" y="70" width="800" height="870" rx="28" fill="#F4EFE3" stroke="${INK}" stroke-width="5"/>${logo ? `<circle cx="166" cy="122" r="40" fill="#fff" stroke="${INK}" stroke-width="5"/><image href="${esc(logo)}" x="130" y="86" width="72" height="72" preserveAspectRatio="xMidYMid slice" clip-path="url(#logoclip-${id})"/>` : ""}<text x="${logo ? 222 : 130}" y="140" font-family="${F.display}" font-weight="800" font-size="${fit(o.brand, logo ? 400 : 480, 60)}" fill="${INK}">${esc(o.brand)}</text><circle cx="815" cy="118" r="56" fill="${ORANGE}" stroke="${INK}" stroke-width="5"/><text x="815" y="114" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${price.length <= 4 ? 32 : price.length <= 6 ? 26 : 20}" fill="#fff">${price}</text><text x="815" y="140" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="15" fill="#fff">USDC</text>`;

  // The art window: the garment, and the patch sewn on (or unpicked after a refund).
  const size = fit(o.brand, sh.maxW, 108);
  const patch =
    stage === "refunded"
      ? `<path d="${sh.d}" transform="${at}" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="10" stroke-dasharray="4 16" stroke-linecap="round"/>`
      : `<g transform="${at}"><path d="${sh.d}" transform="translate(14 16)" fill="${INK}"/><path d="${sh.d}" fill="${PASTEL[o.patchId % 5]}"/><path d="${sh.d}" fill="url(#satin-${id})"/><path d="${sh.d}" fill="none" stroke="url(#tier-${id})" stroke-width="22"/><path d="${sh.d}" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="22" stroke-dasharray="2.5 4.5"/><path d="${sh.d}" transform="scale(.84)" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="4" stroke-dasharray="12 8"/>${logo ? `<rect x="-260" y="-150" width="520" height="300" fill="#fff" opacity=".55" clip-path="url(#patchclip-${id})"/><image href="${esc(logo)}" x="-230" y="-140" width="460" height="280" preserveAspectRatio="xMidYMid meet" clip-path="url(#patchclip-${id})"/>` : `<text x="0" y="${Math.floor((size * 35) / 100)}" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="${size}" fill="${INK}">${esc(o.brand)}</text>`}</g>`;
  const window = `<rect x="130" y="180" width="740" height="430" rx="18" fill="${FABRIC[o.surface].window}" stroke="${INK}" stroke-width="5"/><rect x="130" y="180" width="740" height="430" rx="18" fill="url(#half-${id})"/>${GARMENT[o.surface]}${patch}`;

  // Passport stamps, one per proven step; then the refund stamp or the dispute tape over the window.
  const stamps = [
    done >= 2 ? roundStamp(`stamp-printed-${id}`, 235, 290, 62, -14, ORANGE, "PRINTED", 22, o.printedAt ? fmtDay(o.printedAt) : "", F) : "",
    done >= 3 ? roundStamp(`stamp-seen-${id}`, 770, 300, 58, 12, "#836EF9", "SEEN", 28, o.seenAt ? fmtDay(o.seenAt) : "", F) : "",
    done >= 4 ? rectStamp(`stamp-delivered-${id}`, 530, 500, 310, 38, -8, ORANGE, "DELIVERED", F) : "",
  ].join("");
  const overlay =
    stage === "refunded"
      ? rectStamp(`stamp-refunded-${id}`, 240, 330, 520, 46, -9, INK, `REFUNDED ${price}`, F)
      : stage === "disputed"
        ? `<g transform="rotate(-9 500 400)"><rect x="90" y="360" width="820" height="70" fill="#FFD400" stroke="${INK}" stroke-width="4"/><g fill="${INK}">${Array.from({ length: 20 }, (_, k) => `<path d="M${90 + k * 42} 360 l22 0 -26 70 -22 0z"/>`).join("")}</g><rect x="300" y="368" width="400" height="54" fill="#FFD400"/><text x="500" y="406" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="30" fill="${INK}">PROOF DISPUTED</text></g>`
        : "";

  // "OUTFIT · CHEST POCKET · ETHGLOBAL MUMBAI": no event means the event is the surface name, so it is left out.
  const hasEvent = o.event !== o.surface;
  const typeText = `${o.surface} · ${o.label}${hasEvent ? ` · ${o.event}` : ""}`.toUpperCase();
  const typeSize = typeText.length <= 52 ? 22 : Math.floor((22 * 52) / typeText.length);
  const typeLine = `<rect x="130" y="630" width="740" height="56" rx="12" fill="#fff" stroke="${INK}" stroke-width="4"/><text x="150" y="668" font-family="${F.mono}" font-weight="700" font-size="${typeSize}" fill="${INK}">${esc(typeText)}</text>`;

  const who = `@${o.creator}`;
  const flavourText = o.sponsorNo === 1 ? `The first brand to back ${who}.` : o.sponsorNo > 1 ? `Sponsor #${o.sponsorNo} of ${who}.` : `A spot on ${who}.`;
  const flavour = `${avatar ? `<circle cx="156" cy="733" r="29" fill="#fff" stroke="${INK}" stroke-width="4"/><image href="${esc(avatar)}" x="130" y="707" width="52" height="52" preserveAspectRatio="xMidYMid slice" clip-path="url(#faceclip-${id})"/>` : ""}<text x="${avatar ? 196 : 130}" y="742" font-family="${F.body}" font-style="italic" font-size="26" fill="#5F5B53">${esc(flavourText)}</text>`;

  const steps = ["WON", "PRINTED", stage === "seen" ? `SEEN ${o.seen}/${o.seenOf}` : "SEEN", "DELIVERED"];
  const track = steps
    .map((label, i) => {
      const x = 175 + i * 220;
      const on = i < done;
      return `<circle cx="${x}" cy="820" r="32" fill="${on ? ORANGE : "#fff"}" stroke="${INK}" stroke-width="4"/><text x="${x}" y="831" text-anchor="middle" font-family="${F.display}" font-weight="800" font-size="28" fill="${on ? "#fff" : "#B5AFA3"}">${i + 1}</text><text x="${x}" y="876" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="19" fill="${on ? INK : "#8A857B"}">${label}</text>`;
    })
    .join("");

  // Receipts minted before sponsor numbers existed have none: show which spot it is instead.
  const num = o.sponsorNo > 0 ? `No.${String(o.sponsorNo).padStart(3, "0")}` : `#${o.listing}.${o.patchId + 1}`;
  const footer = `<text x="130" y="922" font-family="${F.mono}" font-weight="700" font-size="20" fill="${INK}">${num}</text><text x="500" y="922" text-anchor="middle" font-family="${F.mono}" font-weight="700" font-size="20" fill="#8A857B">${tier.toUpperCase()} THREAD</text><text x="870" y="922" text-anchor="end" font-family="${F.mono}" font-weight="700" font-size="20" fill="${INK}">PATCHED · MONAD</text>`;

  return `<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(o.brand)} patch, ${stage}">${defs}<rect width="1000" height="1000" fill="#FAFAF7"/><rect width="1000" height="1000" fill="url(#dots-${id})"/><g${stage === "refunded" ? ` filter="url(#grey-${id})" opacity=".8"` : ""}>${frame}${window}${stamps}${overlay}${typeLine}${flavour}${track}${footer}</g></svg>`;
}
