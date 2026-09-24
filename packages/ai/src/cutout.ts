// Green-screen cutout: AI images are generated on a flat #00FF00 background, then we key the green out here.
// Two passes: (1) green-dominant pixels connected to the image border (screen, including its darker shadow
// tones), (2) enclosed pockets that are almost exactly the screen colour (gaps between wheel spokes, under arms).
// Muted greens inside the subject survive. Output is a transparent WebP.
import sharp from "sharp";

/** Pass 1: green-dominance (g minus the larger of r and b) that counts as screen when connected to the border. */
const SCREEN_GREENNESS = 45;
/** Pass 2: enclosed pixels this close to the key colour (RGB distance) and this green-dominant are screen too. */
const POCKET_DISTANCE = 70;
const POCKET_GREENNESS = 110;
/** Remaining pixels with more green-dominance than this get their green pulled down (spill). */
const SPILL_GREENNESS = 12;
const GREEN_MARGIN = 40;

export interface CutoutResult {
  /** image/webp with alpha, or the original bytes when no green screen was found. */
  data: Buffer;
  contentType: "image/webp" | "image/png" | "image/jpeg";
  /** Share of pixels removed (0..1). */
  removed: number;
  cut: boolean;
}

function decodeDataUrl(input: string): { bytes: Buffer; type: CutoutResult["contentType"] } {
  const m = input.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("expected a data: URL image");
  const type = m[1] === "image/png" ? "image/png" : m[1] === "image/webp" ? "image/webp" : "image/jpeg";
  return { bytes: Buffer.from(m[2], "base64"), type };
}

/** Remove a flat green background from an AI image (data: URL). Falls back to the original if there's none. */
export async function cutoutGreen(dataUrl: string): Promise<CutoutResult> {
  const { bytes, type } = decodeDataUrl(dataUrl);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]] as const;

  // Sample the border to find the key colour the model actually produced.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const greens = border.map(px).filter(([r, g, b]) => g > r + GREEN_MARGIN && g > b + GREEN_MARGIN);
  if (greens.length < border.length * 0.5) return { data: bytes, contentType: type, removed: 0, cut: false };
  const key = [0, 1, 2].map((c) => greens.map((p) => p[c]).sort((a, b) => a - b)[greens.length >> 1]);

  const greenness = (i: number) => {
    const [r, g, b] = px(i);
    return g - Math.max(r, b);
  };
  const isKey = (i: number) => greenness(i) > SCREEN_GREENNESS;
  const isPocket = (i: number) => {
    const [r, g, b] = px(i);
    return greenness(i) > POCKET_GREENNESS && Math.hypot(r - key[0], g - key[1], b - key[2]) < POCKET_DISTANCE;
  };

  // Flood fill from the border through key-coloured pixels.
  const bg = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const i of border) if (!bg[i] && isKey(i)) { bg[i] = 1; queue[tail++] = i; }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const n of next) if (n >= 0 && !bg[n] && isKey(n)) { bg[n] = 1; queue[tail++] = n; }
  }

  for (let i = 0; i < w * h; i++) if (!bg[i] && isPocket(i)) bg[i] = 1;

  // Apply alpha, soften the 1px edge, and remove green spill.
  let removed = 0;
  for (let i = 0; i < w * h; i++) {
    if (!bg[i] && greenness(i) > SPILL_GREENNESS) data[i * 4 + 1] = Math.max(data[i * 4], data[i * 4 + 2]) + SPILL_GREENNESS;
    if (bg[i]) {
      data[i * 4 + 3] = 0;
      removed++;
      continue;
    }
    const x = i % w;
    const y = (i / w) | 0;
    const nearBg = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (nearBg) {
      const [r, g, b] = px(i);
      const cap = Math.max(r, b);
      if (g > cap) data[i * 4 + 1] = cap; // despill
      data[i * 4 + 3] = 200;
    }
  }

  const out = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  return { data: out, contentType: "image/webp", removed: removed / (w * h), cut: true };
}
