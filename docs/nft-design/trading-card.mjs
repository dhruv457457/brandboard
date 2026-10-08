// Three new Patch NFT directions, light and on-brand. System fonts only, so each can run on-chain.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
mkdirSync("nft3", { recursive: true });

const INK = "#0B0B0C", OR = "#FF5A1F", PAPER = "#FAFAF7", CREAM = "#F4EFE3";
const P = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
const DISPLAY = "Arial Black, Arial, sans-serif", BODY = "Arial, sans-serif", MONO = "Courier New, monospace";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fitSize = (t, maxW, max, k = 0.66) => Math.min(max, Math.floor(maxW / (Math.max(t.length, 3) * k)));

const TIER = {
  Cotton: { stops: [["0", "#2A2A2A"], ["1", "#0B0B0C"]], label: "COTTON" },
  Silk: { stops: [["0", "#836EF9"], [".5", "#FF8AD8"], ["1", "#7FD3FF"]], label: "SILK" },
  Gold: { stops: [["0", "#8A6100"], [".3", "#F7D774"], [".55", "#B8860B"], [".8", "#FFF0A8"], ["1", "#8A6100"]], label: "GOLD" },
};
const grad = (id, tier) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${TIER[tier].stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>`;

// Patch shapes centred on (0,0), about 2*hw wide.
function shapePath(i, hw, hh) {
  switch (i % 5) {
    case 0: { const r = hh * 0.42; return `M${-hw + r} ${-hh} H${hw - r} A${r} ${r} 0 0 1 ${hw} ${-hh + r} V${hh - r} A${r} ${r} 0 0 1 ${hw - r} ${hh} H${-hw + r} A${r} ${r} 0 0 1 ${-hw} ${hh - r} V${-hh + r} A${r} ${r} 0 0 1 ${-hw + r} ${-hh} Z`; }
    case 1: return `M${-hh} 0 a${hh} ${hh} 0 1 0 ${2 * hh} 0 a${hh} ${hh} 0 1 0 ${-2 * hh} 0 Z`;
    case 2: return `M${-hw * .78} ${-hh} Q0 ${-hh * 1.18} ${hw * .78} ${-hh} V${hh * .05} Q${hw * .78} ${hh * .7} 0 ${hh * 1.05} Q${-hw * .78} ${hh * .7} ${-hw * .78} ${hh * .05} Z`;
    default: return `M${-hw} 0 L${-hw / 2} ${-hh} L${hw / 2} ${-hh} L${hw} 0 L${hw / 2} ${hh} L${-hw / 2} ${hh} Z`;
  }
}

// An embroidered patch: hard shadow, satin fill, merrowed edge in the tier thread, stitched ring, name.
function patch(o, id, x, y, hw, hh, rot = -4) {
  const d = shapePath(o.patchId, hw, hh);
  const size = fitSize(o.brand, (o.patchId % 5 === 1 ? hh * 1.5 : hw * 1.45), hh * 0.62);
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <path d="${d}" transform="translate(14 16)" fill="${INK}"/>
    <path d="${d}" fill="${P[o.patchId % 5]}"/>
    <path d="${d}" fill="url(#satin-${id})"/>
    <path d="${d}" fill="none" stroke="url(#tier-${id})" stroke-width="22"/>
    <path d="${d}" fill="none" stroke="${INK}" stroke-opacity=".35" stroke-width="22" stroke-dasharray="2.5 4.5"/>
    <path d="${d}" transform="scale(.84)" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="4" stroke-dasharray="12 8"/>
    <text x="0" y="${size * .35}" text-anchor="middle" font-family="${DISPLAY}" font-size="${size}" fill="${INK}">${esc(o.brand)}</text>
  </g>`;
}
const defs = (id, o) => `<defs>
  ${grad(`tier-${id}`, o.tier)}
  <pattern id="satin-${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="3.5" height="9" fill="#fff" opacity=".28"/></pattern>
  <pattern id="dots-${id}" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="#E2DDD0"/></pattern>
  <pattern id="half-${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="9" cy="9" r="3" fill="#fff" opacity=".45"/></pattern>
  <linearGradient id="sheen-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>`;

// A rubber stamp (rectangle, double border) and a round passport stamp.
const rectStamp = (x, y, w, word, color, rot, size = 44) => `<g transform="rotate(${rot} ${x + w / 2} ${y + 40})" opacity=".9"><rect x="${x}" y="${y}" width="${w}" height="${size * 1.8}" rx="10" fill="none" stroke="${color}" stroke-width="7"/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${size * 1.8 - 20}" rx="5" fill="none" stroke="${color}" stroke-width="2.5"/><text x="${x + w / 2}" y="${y + size * 1.25}" text-anchor="middle" font-family="${DISPLAY}" font-size="${size}" letter-spacing="3" fill="${color}">${word}</text></g>`;
const roundStamp = (cx, cy, r, word, sub, color, rot) => `<g transform="rotate(${rot} ${cx} ${cy})" opacity=".88"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="6"/><circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5 5"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="${DISPLAY}" font-size="${word.length > 6 ? 22 : 28}" fill="${color}">${word}</text><text x="${cx}" y="${cy + 32}" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="16" fill="${color}">${sub}</text></g>`;
const logo = (x, y, s = 1.3) => `<g transform="translate(${x} ${y}) rotate(-8 20 20) scale(${s})"><rect x="6" y="6" width="31" height="31" rx="9" fill="${INK}"/><rect x="3.5" y="3.5" width="31" height="31" rx="9" fill="${OR}" stroke="${INK}" stroke-width="2.4"/><rect x="7.8" y="7.8" width="22.4" height="22.4" rx="5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M15.5 28V12.5h5.2a4.4 4.4 0 0 1 0 8.8h-5.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
const hoodie = (cx, top, s, fill = "#fff") => `<g transform="translate(${cx} ${top}) scale(${s})"><path d="M-120 40 Q-60 -10 0 -10 Q60 -10 120 40 L240 120 L300 330 L220 360 L180 230 L180 600 L-180 600 L-180 230 L-220 360 L-300 330 L-240 120 Z" fill="${fill}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-95 30 Q0 140 95 30" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M-30 95 L-38 190 M30 95 L38 190" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M-110 470 Q0 500 110 470 L110 560 L-110 560 Z" fill="none" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/></g>`;
const tee = (cx, top, s, fill = "#fff") => `<g transform="translate(${cx} ${top}) scale(${s})"><path d="M-110 0 Q0 60 110 0 L250 90 L300 290 L215 320 L180 210 L180 600 L-180 600 L-180 210 L-215 320 L-300 290 L-250 90 Z" fill="${fill}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-110 0 Q0 60 110 0" fill="none" stroke="${INK}" stroke-width="8"/></g>`;
const car = (cx, top, s, fill = "#fff") => `<g transform="translate(${cx} ${top}) scale(${s})"><path d="M-330 200 Q-330 130 -260 115 L-170 30 Q-145 5 -100 5 L110 5 Q150 5 175 30 L255 115 Q330 130 330 200 L330 260 L-330 260 Z" fill="${fill}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/><path d="M-150 110 L-95 40 L-10 40 L-10 110 Z M20 110 L20 40 L100 40 L160 110 Z" fill="#E8F2FF" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><circle cx="-190" cy="262" r="58" fill="${INK}"/><circle cx="-190" cy="262" r="24" fill="#fff"/><circle cx="190" cy="262" r="58" fill="${INK}"/><circle cx="190" cy="262" r="24" fill="#fff"/></g>`;
const STEPS = ["WON", "PRINTED", "SEEN", "DELIVERED"];
const doneOf = (st) => ({ won: 1, printed: 2, seen: 3, delivered: 4, refunded: 1, disputed: 2 }[st] ?? 0);

// ───────── A. Paper patch: the app's own look, bright and clean ─────────
function paper(o, id) {
  const done = doneOf(o.stage);
  const stamps = [
    done >= 2 ? roundStamp(845, 260, 82, "PRINTED", "SEP 28", OR, -14) : "",
    done >= 3 ? roundStamp(860, 500, 76, "SEEN", "MUMBAI", "#836EF9", 10) : "",
    done >= 4 ? rectStamp(420, 590, 360, "DELIVERED", OR, -9) : "",
  ].join("");
  const track = STEPS.map((s, i) => {
    const x = 120 + i * 255, on = i < done;
    return `${i < 3 ? `<line x1="${x + 26}" y1="880" x2="${x + 229}" y2="880" stroke="${i < done - 1 ? OR : INK}" stroke-opacity="${i < done - 1 ? 1 : .2}" stroke-width="6" stroke-dasharray="14 10"/>` : ""}
      <rect x="${x - 22}" y="858" width="44" height="44" rx="12" fill="${on ? OR : "#fff"}" stroke="${INK}" stroke-width="4" transform="rotate(${[-6, 4, -3, 6][i]} ${x} 880)"/>
      <text x="${x}" y="938" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="22" fill="${on ? INK : "#8A857B"}">${s}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${defs(id, o)}
    <rect width="1000" height="1000" fill="${PAPER}"/><rect width="1000" height="1000" fill="url(#dots-${id})"/>
    ${logo(60, 52)}<text x="122" y="100" font-family="${DISPLAY}" font-size="40" fill="${INK}">patched</text>
    <g transform="rotate(4 820 80)"><rect x="672" y="50" width="282" height="64" rx="32" fill="${INK}"/><rect x="666" y="44" width="282" height="64" rx="32" fill="${o.sponsorNo === 1 ? OR : "#fff"}" stroke="${INK}" stroke-width="4"/><text x="807" y="86" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="24" fill="${o.sponsorNo === 1 ? "#fff" : INK}">No.${String(o.sponsorNo).padStart(3, "0")} · @${esc(o.creator)}</text></g>
    ${patch(o, id, 480, 430, 290, 175, -4)}
    <g transform="rotate(-7 160 640)"><rect x="68" y="618" width="196" height="64" rx="14" fill="${INK}"/><rect x="62" y="612" width="196" height="64" rx="14" fill="#fff" stroke="${INK}" stroke-width="4"/><text x="160" y="656" text-anchor="middle" font-family="${DISPLAY}" font-size="30" fill="${INK}">$${o.price.toLocaleString("en-US")}</text></g>
    ${stamps}
    <text x="60" y="770" font-family="${DISPLAY}" font-size="44" fill="${INK}">${esc(o.label)}</text>
    <text x="62" y="808" font-family="${MONO}" font-weight="700" font-size="22" fill="#5F5B53">${esc(o.event).toUpperCase()} · ${TIER[o.tier].label} THREAD</text>
    ${track}
  </svg>`;
}

// ───────── B. Trading card: a collectible with the patch on the garment ─────────
function tcg(o, id) {
  const done = doneOf(o.stage);
  const winFill = { Outfit: P[1], Car: P[3], "Team hoodie": P[2] }[o.surface];
  const icons = STEPS.map((s, i) => {
    const x = 175 + i * 220, on = i < done;
    return `<circle cx="${x}" cy="820" r="32" fill="${on ? OR : "#fff"}" stroke="${INK}" stroke-width="4"/>
      <text x="${x}" y="831" text-anchor="middle" font-family="${DISPLAY}" font-size="28" fill="${on ? "#fff" : "#B5AFA3"}">${i + 1}</text>
      <text x="${x}" y="876" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="19" fill="${on ? INK : "#8A857B"}">${s}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${defs(id, o)}<filter id="grey-${id}"><feColorMatrix type="saturate" values="0.1"/></filter>
    ${o.bare ? "" : `<rect width="1000" height="1000" fill="${PAPER}"/><rect width="1000" height="1000" fill="url(#dots-${id})"/>`}
    <g ${o.stage === "refunded" ? `filter="url(#grey-${id})" opacity=".8"` : ""}>
    <rect x="70" y="40" width="860" height="930" rx="44" fill="${INK}" transform="translate(14 14)"/>
    <rect x="70" y="40" width="860" height="930" rx="44" fill="url(#tier-${id})" stroke="${INK}" stroke-width="8"/>
    ${o.tier === "Gold" ? `<rect x="70" y="40" width="860" height="930" rx="44" fill="url(#sheen-${id})"/>` : ""}
    <rect x="100" y="70" width="800" height="870" rx="28" fill="${CREAM}" stroke="${INK}" stroke-width="5"/>
    <text x="130" y="140" font-family="${DISPLAY}" font-size="${fitSize(o.brand, 480, 60)}" fill="${INK}">${esc(o.brand)}</text>
    <circle cx="815" cy="118" r="56" fill="${OR}" stroke="${INK}" stroke-width="5"/>
    <text x="815" y="114" text-anchor="middle" font-family="${DISPLAY}" font-size="${o.price >= 1000 ? 26 : 32}" fill="#fff">$${o.price.toLocaleString("en-US")}</text>
    <text x="815" y="140" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="15" fill="#fff">USDC</text>
    <rect x="130" y="180" width="740" height="430" rx="18" fill="${winFill}" stroke="${INK}" stroke-width="5"/>
    <rect x="130" y="180" width="740" height="430" rx="18" fill="url(#half-${id})"/>
    ${o.surface === "Car" ? car(500, 300, 0.95) : o.surface === "Team hoodie" ? hoodie(500, 205, 0.66) : tee(500, 215, 0.62)}
    ${(() => { const at = o.surface === "Car" ? [500, 430] : [500, 380]; return o.stage === "refunded"
      ? `<path d="${shapePath(o.patchId, 290, 175)}" transform="translate(${at[0]} ${at[1]}) scale(.36) rotate(-3)" fill="none" stroke="${INK}" stroke-opacity=".6" stroke-width="10" stroke-dasharray="4 16" stroke-linecap="round"/>`
      : `<g transform="translate(${at[0]} ${at[1]}) scale(.36) translate(-500 -380)">${patch(o, id, 500, 380, 290, 175, -3)}</g>`; })()}
    ${done >= 2 ? roundStamp(235, 290, 62, "PRINTED", "SEP 28", OR, -14) : ""}
    ${done >= 3 ? roundStamp(770, 300, 58, "SEEN", "MUMBAI", "#836EF9", 12) : ""}
    ${done >= 4 ? rectStamp(530, 500, 310, "DELIVERED", OR, -8, 38) : ""}
    <rect x="130" y="630" width="740" height="56" rx="12" fill="#fff" stroke="${INK}" stroke-width="4"/>
    <text x="150" y="668" font-family="${MONO}" font-weight="700" font-size="22" fill="${INK}">${o.surface.toUpperCase()} · ${esc(o.label).toUpperCase()} · ${esc(o.event).toUpperCase()}</text>
    <text x="130" y="742" font-family="${BODY}" font-style="italic" font-size="26" fill="#5F5B53">${o.sponsorNo === 1 ? "The first brand to back" : `Sponsor #${o.sponsorNo} of`} @${esc(o.creator)}.</text>
    ${icons}
    ${o.stage === "refunded" ? rectStamp(240, 330, 520, `REFUNDED $${o.price}`, INK, -9, 46) : ""}
    ${o.stage === "disputed" ? `<g transform="rotate(-9 500 400)"><rect x="90" y="360" width="820" height="70" fill="#FFD400" stroke="${INK}" stroke-width="4"/><g fill="${INK}">${[...Array(20)].map((_, k) => `<path d="M${90 + k * 42} 360 l22 0 -26 70 -22 0z"/>`).join("")}</g><rect x="300" y="368" width="400" height="54" fill="#FFD400"/><text x="500" y="406" text-anchor="middle" font-family="${DISPLAY}" font-size="30" fill="${INK}">PROOF DISPUTED</text></g>` : ""}
    <text x="130" y="922" font-family="${MONO}" font-weight="700" font-size="20" fill="${INK}">No.${String(o.sponsorNo).padStart(3, "0")}</text>
    <text x="500" y="922" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="20" fill="#8A857B">${TIER[o.tier].label} THREAD</text>
    <text x="870" y="922" text-anchor="end" font-family="${MONO}" font-weight="700" font-size="20" fill="${INK}">PATCHED · MONAD</text>
    </g></svg>`;
}

// ───────── C. Die-cut sticker: the patch alone on a bold colour ─────────
function sticker(o, id) {
  const done = doneOf(o.stage);
  const bg = { Cotton: "#FFE3D6", Silk: "#E9E2FF", Gold: "#FFF1C2" }[o.tier];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">${defs(id, o)}
    <rect width="1000" height="1000" fill="${bg}"/>
    <circle cx="500" cy="470" r="380" fill="#fff" opacity=".55"/>
    <g transform="translate(500 450) rotate(-6)"><path d="${shapePath(o.patchId, 340, 215)}" transform="scale(1.13)" fill="#fff" stroke="${INK}" stroke-width="6"/></g>
    ${patch(o, id, 500, 450, 340, 215, -6)}
    ${done >= 2 ? roundStamp(820, 200, 86, "PRINTED", "SEP 28", OR, -14) : ""}
    ${done >= 3 ? roundStamp(175, 230, 80, "SEEN", "MUMBAI", "#836EF9", 10) : ""}
    ${done >= 4 ? rectStamp(560, 620, 360, "DELIVERED", OR, -9) : ""}
    <g transform="rotate(-2 500 870)">
      <rect x="140" y="800" width="720" height="140" rx="10" fill="${INK}" transform="translate(10 10)"/>
      <rect x="140" y="800" width="720" height="140" rx="10" fill="#fff" stroke="${INK}" stroke-width="5"/>
      <line x1="168" y1="812" x2="168" y2="928" stroke="${INK}" stroke-opacity=".3" stroke-width="3" stroke-dasharray="7 6"/>
      <line x1="832" y1="812" x2="832" y2="928" stroke="${INK}" stroke-opacity=".3" stroke-width="3" stroke-dasharray="7 6"/>
      <text x="196" y="858" font-family="${DISPLAY}" font-size="36" fill="${INK}">${esc(o.label)}</text>
      <text x="196" y="898" font-family="${MONO}" font-weight="700" font-size="20" fill="#5F5B53">No.${String(o.sponsorNo).padStart(3, "0")} · @${esc(o.creator)} · $${o.price.toLocaleString("en-US")}</text>
      <text x="804" y="858" text-anchor="end" font-family="${DISPLAY}" font-size="26" fill="${OR}">${STEPS[Math.max(done, 1) - 1]}</text>
      ${STEPS.map((_, i) => `<rect x="${640 + i * 42}" y="882" width="32" height="14" rx="7" fill="${i < done ? OR : INK}" fill-opacity="${i < done ? 1 : .15}"/>`).join("")}
    </g>
    ${logo(46, 42, 1.1)}
  </svg>`;
}

const base = { brand: "KITE", label: "Chest pocket", event: "ETHGlobal Mumbai", creator: "mira", surface: "Outfit", sponsorNo: 1 };
const variants = [
  ["won", { ...base, stage: "won", patchId: 0, price: 420, tier: "Silk" }],
  ["delivered", { ...base, stage: "delivered", patchId: 2, price: 1200, tier: "Gold" }],
];
for (const [dir, fn] of [["A-paper", paper], ["B-card", tcg], ["C-sticker", sticker]]) {
  for (const [st, o] of variants) {
    const svg = fn(o, `${dir}-${st}`.replace(/[^a-z0-9-]/gi, ""));
    await sharp(Buffer.from(svg), { density: 96 }).resize(900, 900).png().toFile(`nft3/${dir}-${st}.png`);
  }
}
const setB = {
  hero: { ...base, stage: "delivered", patchId: 2, price: 1200, tier: "Gold" },
  won: { ...base, stage: "won", patchId: 0, price: 420, tier: "Silk" },
  printed: { ...base, stage: "printed", patchId: 0, price: 420, tier: "Silk" },
  seen: { ...base, stage: "seen", patchId: 0, price: 420, tier: "Silk" },
  delivered: { ...base, stage: "delivered", patchId: 0, price: 420, tier: "Silk" },
  refunded: { ...base, stage: "refunded", patchId: 1, price: 85, tier: "Cotton", brand: "LUMA", sponsorNo: 4, surface: "Team hoodie", label: "Left sleeve" },
  disputed: { ...base, stage: "disputed", patchId: 3, price: 60, tier: "Cotton", brand: "ORB", sponsorNo: 6, surface: "Car", label: "Rear door", event: "Week 2 of 4" },
  car: { ...base, stage: "seen", patchId: 3, price: 640, tier: "Silk", brand: "PENDLE", surface: "Car", label: "Rear door", event: "Week 2 of 4", sponsorNo: 2, creator: "samir" },
};
for (const [k, o] of Object.entries(setB)) {
  await sharp(Buffer.from(tcg(o, `b${k}`)), { density: 96 }).resize(900, 900).png().toFile(`nft3/B-${k}.png`);
  await sharp(Buffer.from(tcg({ ...o, bare: true }, `t${k}`)), { density: 96 }).resize(900, 900).png().toFile(`nft3/T-${k}.png`);
}
{
  const names = Object.keys(setB);
  const bims = await Promise.all(names.map((k) => sharp(`nft3/B-${k}.png`).resize(400, 400).toBuffer()));
  await sharp({ create: { width: 3240, height: 420, channels: 3, background: "#ffffff" } }).composite(bims.map((b, i) => ({ input: b, left: 10 + i * 404, top: 10 }))).png().toFile("nft3/B-sheet.png");
}
const files = ["A-paper", "B-card", "C-sticker"].flatMap((d) => ["won", "delivered"].map((s) => `nft3/${d}-${s}.png`));
const ims = await Promise.all(files.map((f) => sharp(f).resize(460, 460).toBuffer()));
await sharp({ create: { width: 2860, height: 520, channels: 3, background: "#ffffff" } })
  .composite(ims.map((b, i) => ({ input: b, left: 20 + i * 473, top: 30 }))).png().toFile("nft3/sheet.png");
console.log("ok");
