// The Get Patched Week winner cards, drawn as SVG (then to PNG by lib/server/cardPng.ts) so a winner can be posted on X.
// One card per winner, and one with all three. 1200x675 is the shape X shows without cropping. Pure string building.

import { TRACKS, type TrackId } from "@/lib/contest";

export interface WinnerCardData {
  track: TrackId;
  handle: string;
  /** The profile's display name, if it has one. */
  name: string | null;
  /** A small PNG/JPEG data URL (the renderer cannot fetch links). */
  avatar: string | null;
  note: string | null;
  /** Lucky draw only: the Monad block that picked the winner. */
  block?: number | null;
}

const INK = "#0B0B0C";
const CREAM = "#FAFAF7";
const ORANGE = "#FF5A1F";
const TONE: Record<TrackId, string> = { post: "#FFE58F", feedback: "#BDEBD3", lucky: "#D9CCFF" };
const DISPLAY = "Bricolage Grotesque, Arial Black, sans-serif";
const MONO = "Geist Mono, Courier New, monospace";
const BODY = "Geist, Arial, sans-serif";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** A display name the card's fonts can draw: letters, numbers and plain punctuation only (no emoji or symbols). */
const clean = (s: string | null, handle: string) => {
  const c = (s ?? "").replace(/[^\p{L}\p{N}\s.'’_-]/gu, "").replace(/\s+/g, " ").trim();
  return c.length >= 2 ? c : `@${handle}`;
};
const trackName = (t: TrackId) => TRACKS.find((x) => x.id === t)!.name;
const title = (t: TrackId) => (t === "lucky" ? "LUCKY DRAW WINNER" : `${trackName(t).toUpperCase()} WINNER`);

/** Break text into lines of at most `max` characters, at most `lines` of them (the last one ends with an ellipsis). */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.trim().split(/\s+/)) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) {
    const kept = out.slice(0, lines);
    kept[lines - 1] = kept[lines - 1]!.replace(/[ ,.;:]+$/, "").slice(0, max - 1) + "…";
    return kept;
  }
  return out;
}

/** A round picture with a thick ring, or the first letter when there is no picture. */
function avatar(id: string, d: WinnerCardData, cx: number, cy: number, r: number): string {
  const letter = (d.name || d.handle).replace(/^@/, "")[0]?.toUpperCase() ?? "?";
  const face = d.avatar
    ? `<clipPath id="av-${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image href="${d.avatar}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#av-${id})"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${TONE[d.track]}"/><text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="${r * 0.95}" fill="${INK}">${esc(letter)}</text>`;
  return `<circle cx="${cx + 10}" cy="${cy + 12}" r="${r + 7}" fill="${INK}"/><circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>${face}<circle cx="${cx}" cy="${cy}" r="${r + 22}" fill="none" stroke="${INK}" stroke-opacity=".5" stroke-width="3" stroke-dasharray="3 11" stroke-linecap="round"/>`;
}

const backdrop = (id: string) =>
  `<defs><pattern id="dots-${id}" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.2" fill="#E4DFD2"/></pattern></defs><rect width="1200" height="675" fill="${CREAM}"/><rect width="1200" height="675" fill="url(#dots-${id})"/>`;

const footer = (extra = "") =>
  `<g><rect x="56" y="604" width="46" height="46" rx="14" fill="${INK}" transform="translate(4 4)"/><rect x="56" y="604" width="46" height="46" rx="14" fill="${ORANGE}" stroke="${INK}" stroke-width="3.5"/><path d="M71.5 640 V615 h8.5 a7.5 7.5 0 0 1 0 15 h-8.5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="116" y="636" font-family="${DISPLAY}" font-weight="800" font-size="34" fill="${INK}">patched</text><text x="1144" y="636" text-anchor="end" font-family="${MONO}" font-weight="600" font-size="22" fill="#6B6B6B">Get Patched Week · Oct 8-12 · monad.patched.world${extra}</text></g>`;

/** One winner, big. */
export function winnerCard(d: WinnerCardData, id = "w"): string {
  const t = TRACKS.find((x) => x.id === d.track)!;
  const name = clean(d.name, d.handle);
  // The name stays left of the prize coin (x 520 to about 900).
  const nameSize = Math.max(38, Math.min(78, Math.floor(380 / Math.max(name.length, 6) / 0.56)));
  const note = d.note ? wrap(d.note, 40, 3) : [];
  const proof = d.track === "lucky" && d.block ? `Picked by Monad block #${d.block.toLocaleString("en-US")}` : "";
  return `<svg viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title(d.track))}: ${esc(name)}">${backdrop(id)}
<rect x="56" y="46" width="1088" height="528" rx="44" fill="${INK}" transform="translate(12 14)"/><rect x="56" y="46" width="1088" height="528" rx="44" fill="${TONE[d.track]}" stroke="${INK}" stroke-width="6"/><rect x="82" y="72" width="1036" height="476" rx="30" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="3" stroke-dasharray="10 9"/>
${avatar(id, d, 292, 318, 150)}
<g transform="rotate(-3 700 150)"><rect x="520" y="104" width="${Math.round(title(d.track).length * 16.8 + 52)}" height="58" rx="12" fill="${INK}"/><text x="546" y="143" font-family="${DISPLAY}" font-weight="800" font-size="24" letter-spacing="1.2" fill="${CREAM}">${title(d.track)}</text></g>
<text x="520" y="262" font-family="${DISPLAY}" font-weight="800" font-size="${nameSize}" fill="${INK}">${esc(name)}</text>
<text x="522" y="308" font-family="${MONO}" font-weight="600" font-size="30" fill="${INK}" fill-opacity=".7">@${esc(d.handle)}</text>
${note.map((l, i) => `<text x="522" y="${368 + i * 40}" font-family="${BODY}" font-weight="600" font-size="29" fill="${INK}">${esc(l)}</text>`).join("")}
${proof ? `<text x="522" y="${368 + note.length * 40 + 14}" font-family="${MONO}" font-weight="600" font-size="22" fill="${INK}" fill-opacity=".7">${esc(proof)}</text>` : ""}
<g transform="rotate(8 1010 164)"><circle cx="1016" cy="178" r="86" fill="${INK}"/><circle cx="1008" cy="168" r="86" fill="${ORANGE}" stroke="${INK}" stroke-width="5"/><circle cx="1008" cy="168" r="70" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2.5" stroke-dasharray="4 7"/><text x="1008" y="186" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="62" fill="#fff">$${t.prize}</text><text x="1008" y="214" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="20" fill="#fff">USDC</text></g>
${footer()}</svg>`;
}

/** All three winners on one card, for a single announcement post. */
export function winnersCard(list: WinnerCardData[]): string {
  const id = "all";
  const order: TrackId[] = ["lucky", "post", "feedback"];
  const sorted = order.map((t) => list.find((w) => w.track === t)).filter(Boolean) as WinnerCardData[];
  const colW = 340;
  const cols = sorted
    .map((d, i) => {
      const x = 74 + i * (colW + 20);
      const cx = x + colW / 2;
      const name = clean(d.name, d.handle);
      const size = Math.max(26, Math.min(40, Math.floor(300 / Math.max(name.length, 6) / 0.56)));
      return `<rect x="${x}" y="150" width="${colW}" height="400" rx="34" fill="${INK}" transform="translate(8 10)"/><rect x="${x}" y="150" width="${colW}" height="400" rx="34" fill="${TONE[d.track]}" stroke="${INK}" stroke-width="5"/>
<text x="${cx}" y="196" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="25" letter-spacing="1.5" fill="${INK}">${d.track === "lucky" ? "LUCKY DRAW" : trackName(d.track).toUpperCase()}</text>
${avatar(`${id}${i}`, d, cx, 322, 78)}
<text x="${cx}" y="454" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="${size}" fill="${INK}">${esc(name)}</text>
<text x="${cx}" y="486" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="20" fill="${INK}" fill-opacity=".7">@${esc(d.handle)}</text>
<rect x="${cx - 58}" y="504" width="116" height="34" rx="17" fill="${ORANGE}" stroke="${INK}" stroke-width="3"/><text x="${cx}" y="528" text-anchor="middle" font-family="${DISPLAY}" font-weight="800" font-size="20" fill="#fff">$10 USDC</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Get Patched Week winners">${backdrop(id)}
<text x="74" y="104" font-family="${DISPLAY}" font-weight="800" font-size="60" fill="${INK}">Get Patched Week winners</text>
<text x="76" y="134" font-family="${MONO}" font-weight="600" font-size="22" fill="#6B6B6B">three winners · $10 USDC each · thank you to everyone who joined</text>
${cols}${footer()}</svg>`;
}
