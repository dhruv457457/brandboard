// Cover images drawn in code, no AI needed: each event's landmarks as flat, bold-outline art in the Patched palette, with
// the real cutout photos of creators in white outfits standing in front, wearing patches placed where their listings
// put them. Stored in the canvases bucket as 1800x600 (3:1) webp.
//   npx tsx scripts/event-covers-art.mts            draw them all into scripts/.covers/ (look at them first)
//   APPLY=1 npx tsx scripts/event-covers-art.mts    upload and set them as the events' covers
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync("../../.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const CHAIN = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const W = 1800, H = 600, INK = "#0B0B0C";
const P = { mint: "#BDEBD3", lilac: "#D9CCFF", butter: "#FFE58F", sky: "#BFE3FF", pink: "#FFC9DA", orange: "#FF5A1F", paper: "#FAFAF7", stage: "#F1EFE8" };
const GROUND = 540;

// ───────────────────────── the people (real cutouts from the listings) ─────────────────────────
type Spot = { x: number; y: number; w: number; h: number; c: string };
const FIGURES: Record<string, { url: string; spots: Spot[] }> = {
  dhruv: {
    url: "https://uxrcfiknkpcrylywhukh.supabase.co/storage/v1/object/public/canvases/0x687c6533ae1567e298964d77392d3fb9bace619c/a38c7517-76bd-4b4b-bf2b-f2a0b4ebf11c.webp",
    spots: [{ x: 56, y: 30, w: 9, h: 6, c: P.butter }, { x: 45.5, y: 25.5, w: 9, h: 7, c: P.lilac }, { x: 64, y: 49, w: 5, h: 7, c: P.pink }],
  },
  suhani: {
    url: "https://uxrcfiknkpcrylywhukh.supabase.co/storage/v1/object/public/canvases/0x687c6533ae1567e298964d77392d3fb9bace619c/558f380f-e4cf-46d1-8ea2-e61635760ed2.webp",
    spots: [{ x: 43, y: 31, w: 14, h: 8, c: P.mint }, { x: 32.5, y: 40, w: 5, h: 8, c: P.butter }, { x: 40, y: 60, w: 8, h: 7, c: P.sky }],
  },
};

async function figure(key: string, height: number): Promise<{ buf: Buffer; w: number; h: number }> {
  const f = FIGURES[key];
  const raw = Buffer.from(await (await fetch(f.url)).arrayBuffer());
  const { width = 1, height: ih = 1 } = await sharp(raw).metadata();
  // Patches on the clothes: stitched rounded squares, as in the product.
  const k = width / 300;
  const patches = f.spots.map((s) => {
    const x = (s.x / 100) * width, y = (s.y / 100) * ih, w = (s.w / 100) * width, h = (s.h / 100) * ih;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${6 * k}" fill="${s.c}" stroke="${INK}" stroke-width="${2.6 * k}"/>` +
      `<rect x="${x + 2.4 * k}" y="${y + 2.4 * k}" width="${w - 4.8 * k}" height="${h - 4.8 * k}" rx="${4 * k}" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="${1.4 * k}" stroke-dasharray="${4 * k} ${3 * k}"/>`;
  }).join("");
  const withPatches = await sharp(raw).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ih}">${patches}</svg>`) }]).png().toBuffer();
  // Trim the empty margin around the person, then size by the person's own height.
  const out = await sharp(await sharp(withPatches).trim({ threshold: 8 }).png().toBuffer()).resize({ height }).png().toBuffer();
  const m = await sharp(out).metadata();
  return { buf: out, w: m.width ?? 0, h: m.height ?? 0 };
}

// ───────────────────────── drawing helpers ─────────────────────────
const o = (fill: string, w = 5) => `fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const cloud = (x: number, y: number, s = 1) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 40a30 30 0 0 1 34-30a40 40 0 0 1 74 8a26 26 0 0 1 4 52H22A26 26 0 0 1 0 40z" ${o("#fff", 4)}/></g>`;
const sun = (x: number, y: number, r: number, fill = P.butter) => `<circle cx="${x}" cy="${y}" r="${r}" ${o(fill, 5)}/>`;
const stitchedPatch = (x: number, y: number, s: number, fill: string, rot = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="${s * 0.16}" ${o(fill, 4)}/><rect x="${-s / 2 + 8}" y="${-s / 2 + 8}" width="${s - 16}" height="${s - 16}" rx="${s * 0.1}" fill="none" stroke="${INK}" stroke-opacity=".5" stroke-width="2.5" stroke-dasharray="7 5"/></g>`;
const ground = (fill: string) => `<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="${fill}"/><line x1="0" y1="${GROUND}" x2="${W}" y2="${GROUND}" stroke="${INK}" stroke-width="6"/>`;
const windows = (x: number, y: number, w: number, h: number, rows: number) =>
  Array.from({ length: rows }, (_, i) => `<line x1="${x}" y1="${y + ((i + 1) * h) / (rows + 1)}" x2="${x + w}" y2="${y + ((i + 1) * h) / (rows + 1)}" stroke="${INK}" stroke-opacity=".22" stroke-width="3"/>`).join("");

/** Marina Bay Sands: three leaning towers and the ship-shaped SkyPark. */
function marinaBay(x: number, s = 1) {
  const tower = (tx: number, lean: number) =>
    `<path d="M${tx} 540L${tx + 95} 540L${tx + 95 + lean} 170L${tx + lean + 12} 170Z" ${o("#fff", 5)}/>${windows(tx + 14, 190, 70, 330, 9)}`;
  return `<g transform="translate(${x} 0) scale(${s})" transform-origin="${x} 540">
    ${tower(0, 40)}${tower(130, 8)}${tower(260, -26)}
    <path d="M-40 168Q190 128 430 150L520 130L462 176Q200 206 -30 196Z" ${o(P.sky, 5)}/>
    <path d="M60 150Q100 110 150 128" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="300" cy="136" rx="46" ry="7" ${o(P.mint, 3)}/>
  </g>`;
}

/** Gardens by the Bay: three Supertrees. */
function supertrees(x: number) {
  const tree = (tx: number, h: number, r: number, c: string) =>
    `<g><path d="M${tx - 9} 540L${tx - 5} ${540 - h}L${tx + 5} ${540 - h}L${tx + 9} 540Z" ${o("#fff", 4)}/>
      <path d="M${tx - r} ${540 - h - 6}Q${tx} ${540 - h - r * 1.15} ${tx + r} ${540 - h - 6}Q${tx} ${540 - h + 26} ${tx - r} ${540 - h - 6}Z" ${o(c, 5)}/>
      <path d="M${tx - r * 0.55} ${540 - h - 8}L${tx - 4} ${540 - h + 6}M${tx + r * 0.55} ${540 - h - 8}L${tx + 4} ${540 - h + 6}M${tx} ${540 - h - r * 0.9}L${tx} ${540 - h + 4}" stroke="${INK}" stroke-width="3" stroke-opacity=".6" fill="none"/></g>`;
  return tree(x, 330, 92, P.mint) + tree(x + 170, 240, 70, P.pink) + tree(x + 300, 290, 80, P.lilac);
}

/** ArtScience Museum: a lotus of petals. */
function lotus(x: number) {
  const petal = (a: number) => `<ellipse cx="0" cy="-70" rx="34" ry="86" transform="rotate(${a})" ${o("#fff", 4)}/>`;
  return `<g transform="translate(${x} 540)">${[-62, -38, -14, 14, 38, 62].map(petal).join("")}<ellipse cx="0" cy="-8" rx="62" ry="18" ${o(P.sky, 4)}/></g>`;
}

/** Obelisco de Buenos Aires. */
function obelisco(x: number) {
  return `<g><path d="M${x - 34} 540L${x + 34} 540L${x + 12} 150L${x - 12} 150Z" ${o("#fff", 5)}/>
    <path d="M${x - 12} 150L${x + 12} 150L${x} 96Z" ${o("#fff", 5)}/>
    <line x1="${x}" y1="160" x2="${x}" y2="520" stroke="${INK}" stroke-opacity=".18" stroke-width="3"/>
    <rect x="${x - 6}" y="230" width="12" height="20" rx="3" ${o(P.sky, 3)}/>
    <rect x="${x - 40}" y="520" width="80" height="20" ${o(P.stage, 4)}/></g>`;
}

/** A row of La Boca houses. */
function houses(x: number, n: number) {
  const cols = [P.pink, P.sky, P.butter, P.mint, P.lilac];
  return Array.from({ length: n }, (_, i) => {
    const hx = x + i * 96, hh = 84 + ((i * 37) % 54), c = cols[i % cols.length];
    return `<g><rect x="${hx}" y="${GROUND - hh}" width="88" height="${hh}" ${o(c, 5)}/><path d="M${hx - 4} ${GROUND - hh}L${hx + 44} ${GROUND - hh - 38}L${hx + 92} ${GROUND - hh}Z" ${o(c === P.pink ? P.butter : P.pink, 5)}/>
      <rect x="${hx + 14}" y="${GROUND - hh + 18}" width="22" height="26" rx="3" ${o("#fff", 3)}/><rect x="${hx + 52}" y="${GROUND - hh + 18}" width="22" height="26" rx="3" ${o("#fff", 3)}/></g>`;
  }).join("");
}

const tree = (x: number, r: number, c: string) =>
  `<g><rect x="${x - 7}" y="${GROUND - r * 1.1}" width="14" height="${r * 1.1}" ${o("#8B5E3C", 4)}/><circle cx="${x}" cy="${GROUND - r * 1.45}" r="${r}" ${o(c, 5)}/></g>`;

/** A hackathon hall: bunting, string lights, a long table with laptops. */
function hall() {
  const flags = Array.from({ length: 16 }, (_, i) => {
    const fx = 30 + i * 62, fy = 36 + Math.sin(i * 0.8) * 10;
    return `<path d="M${fx} ${fy}L${fx + 44} ${fy}L${fx + 22} ${fy + 56}Z" ${o([P.pink, P.butter, P.mint, P.sky, P.lilac][i % 5], 4)}/>`;
  }).join("");
  const bulbs = Array.from({ length: 14 }, (_, i) => `<circle cx="${50 + i * 70}" cy="${120 + Math.sin(i * 1.1) * 18}" r="9" ${o(P.butter, 3)}/>`).join("");
  const laptops = [110, 290, 470, 650].map((lx, i) =>
    `<g><rect x="${lx}" y="398" width="92" height="62" rx="6" ${o([P.sky, P.mint, P.pink, P.lilac][i], 4)}/><path d="M${lx - 12} 460L${lx + 104} 460L${lx + 96} 474L${lx - 4} 474Z" ${o("#fff", 4)}/></g>`).join("");
  return `<path d="M0 36Q450 80 900 36" fill="none" stroke="${INK}" stroke-width="4"/>${flags}
    <path d="M0 116Q450 160 900 116" fill="none" stroke="${INK}" stroke-width="3" opacity=".6"/>${bulbs}
    <rect x="60" y="474" width="14" height="${GROUND - 474}" fill="${INK}"/><rect x="826" y="474" width="14" height="${GROUND - 474}" fill="${INK}"/>
    <rect x="40" y="474" width="840" height="16" rx="5" ${o("#fff", 4)}/>${laptops}
    <rect x="300" y="250" width="300" height="110" rx="12" ${o(P.stage, 5)}/><circle cx="450" cy="305" r="30" ${o(P.orange, 5)}/>`;
}

interface Scene { name: string; event: number; bg: [string, string]; art: string; figures: string[] }

const SCENES: Scene[] = [
  {
    name: "Token2049 Demo", event: 1, bg: [P.mint, P.butter], figures: ["suhani", "dhruv"],
    art: `${sun(1500, 130, 70, P.pink)}${cloud(1180, 60)}${ground(P.stage)}${hall()}${stitchedPatch(960, 170, 70, P.lilac, -8)}${stitchedPatch(1650, 380, 60, P.butter, 9)}`,
  },
  {
    name: "Metropolis Buenos Aires", event: 2, bg: [P.butter, P.pink], figures: ["dhruv", "suhani"],
    art: `${sun(1560, 140, 76, "#fff")}${cloud(900, 70, 1.1)}${cloud(1360, 170, 0.8)}${ground(P.stage)}${tree(120, 60, P.lilac)}${houses(230, 5)}${obelisco(850)}${houses(930, 2)}${tree(1140, 50, P.lilac)}${stitchedPatch(1000, 170, 66, P.sky, 7)}${stitchedPatch(1690, 430, 62, P.mint, -10)}`,
  },
  {
    name: "Monad Open Singapore", event: 3, bg: ["#B9A8FF", P.pink], figures: ["suhani", "dhruv"],
    art: `${Array.from({ length: 22 }, (_, i) => `<circle cx="${60 + ((i * 83) % 1000)}" cy="${30 + ((i * 47) % 170)}" r="${2 + (i % 3)}" fill="#fff" opacity=".85"/>`).join("")}${sun(1560, 120, 64, P.butter)}${cloud(1100, 70, 0.9)}${ground("#E9E4FF")}${supertrees(110)}${marinaBay(560, 0.95)}${stitchedPatch(1010, 190, 64, P.mint, -8)}${stitchedPatch(1700, 420, 60, P.butter, 8)}`,
  },
  {
    name: "Token2049 Singapore", event: 4, bg: [P.sky, "#fff"], figures: ["dhruv", "suhani"],
    art: `${sun(1560, 130, 72, P.butter)}${cloud(640, 60, 1.2)}${cloud(1100, 120, 0.9)}${ground(P.stage)}${lotus(170)}${marinaBay(420, 1.05)}<path d="M0 560Q150 540 300 560T600 560T900 560" fill="none" stroke="${INK}" stroke-width="4" opacity=".5"/>${stitchedPatch(1020, 200, 64, P.pink, 8)}${stitchedPatch(1710, 440, 60, P.lilac, -9)}`,
  },
];

mkdirSync("scripts/.covers", { recursive: true });
const urls: Record<number, string> = {};
for (const sc of SCENES) {
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${sc.bg[0]}"/><stop offset="1" stop-color="${sc.bg[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${sc.art}</svg>`;
  const layers: sharp.OverlayOptions[] = [];
  const fh = 508;
  for (let i = 0; i < sc.figures.length; i++) {
    const f = await figure(sc.figures[i], fh);
    layers.push({ input: f.buf, left: Math.round(1150 + i * 290 - f.w / 2), top: Math.max(0, GROUND + 34 - f.h) });
  }
  const png = await sharp(Buffer.from(bg)).composite(layers).png().toBuffer();
  const webp = await sharp(png).webp({ quality: 86 }).toBuffer();
  writeFileSync(`scripts/.covers/event-${sc.event}.webp`, webp);
  writeFileSync(`scripts/.covers/event-${sc.event}.png`, png);
  console.log(`drew ${sc.name} (${Math.round(webp.length / 1024)} KB)`);
  if (process.env.APPLY) {
    const path = `events/${CHAIN}-${sc.event}-${randomUUID().slice(0, 8)}.webp`;
    const up = await db.storage.from("canvases").upload(path, webp, { contentType: "image/webp" });
    if (up.error) throw up.error;
    urls[sc.event] = db.storage.from("canvases").getPublicUrl(path).data.publicUrl;
    const { error } = await db.from("patched_events").update({ banner_url: urls[sc.event] }).eq("chain_id", CHAIN).eq("event_id", sc.event);
    if (error) throw error;
    console.log(`  cover set: ${urls[sc.event]}`);
  }
}
