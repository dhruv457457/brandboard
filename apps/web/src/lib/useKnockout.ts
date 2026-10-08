"use client";

import { useEffect, useState } from "react";

export interface PrintArt {
  /** The logo with its flat background taken off, or null when it should be printed as it is. */
  src: string | null;
  /** The mark is mostly white or very light, so it needs a soft shadow to show on a white garment. */
  light: boolean;
}

const NONE: PrintArt = { src: null, light: false };
const cache = new Map<string, PrintArt>();
const SIZE = 320;
/** How far a pixel's colour may be from the background and still count as background (0 to 441). */
const TOLERANCE = 52;

const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Prepares a logo to be printed on a garment: takes off the flat background (a white box, or the coloured tile a mark
 * sits on) so only the mark itself is printed, and notes whether the mark is so light it needs help to show.
 * Returns nothing special until it is ready, and for good if the image can't be read.
 */
export function useKnockout(src: string | null | undefined): PrintArt {
  const [art, setArt] = useState<PrintArt>(src ? cache.get(src) ?? NONE : NONE);
  useEffect(() => {
    if (!src) { setArt(NONE); return; }
    const hit = cache.get(src);
    if (hit) { setArt(hit); return; }
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let result = NONE;
      try { result = analyse(img); } catch { result = NONE; }
      cache.set(src, result);
      if (live) setArt(result);
    };
    img.onerror = () => { cache.set(src, NONE); };
    img.src = src;
    return () => { live = false; };
  }, [src]);
  return art;
}

function analyse(img: HTMLImageElement): PrintArt {
  // Draw it at working size, then crop away any clear margin so the tile or mark fills the frame.
  const scale = Math.min(1, SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  let w = Math.max(2, Math.round(img.naturalWidth * scale));
  let h = Math.max(2, Math.round(img.naturalHeight * scale));
  let canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  let ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return NONE;
  ctx.drawImage(img, 0, 0, w, h);
  {
    const all = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (all[(y * w + x) * 4 + 3] < 128) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return NONE;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    if (cw < w * 0.97 || ch < h * 0.97) {
      const next = document.createElement("canvas");
      next.width = Math.max(2, cw);
      next.height = Math.max(2, ch);
      const nctx = next.getContext("2d", { willReadFrequently: true });
      if (!nctx) return NONE;
      nctx.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
      canvas = next;
      ctx = nctx;
      w = next.width;
      h = next.height;
    }
  }
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const at = (x: number, y: number) => (y * w + x) * 4;

  // Mean lightness of the mark as it is (opaque pixels only), for marks that are already on a clear background.
  const meanLum = () => {
    let n = 0, sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      sum += lum(px[i], px[i + 1], px[i + 2]);
      n++;
    }
    return n ? sum / n : 1;
  };

  // The background colour: what most of the opaque pixels near the edge agree on (a band, so a rounded tile counts too).
  // Sample a band just inside a thin outline (the outermost 2% is ignored here and cut away below).
  const skip = Math.max(1, Math.round(Math.min(w, h) * 0.02));
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.07));
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let ringOpaque = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const depth = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (depth < skip || depth >= band + skip) continue;
      const i = at(x, y);
      if (px[i + 3] < 200) continue;
      ringOpaque++;
      const key = ((px[i] >> 5) << 6) | ((px[i + 1] >> 5) << 3) | (px[i + 2] >> 5);
      const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += px[i]; b.g += px[i + 1]; b.b += px[i + 2];
      buckets.set(key, b);
    }
  }
  const ringAll = 2 * band * (w + h);
  let top: { n: number; r: number; g: number; b: number } | null = null;
  for (const b of buckets.values()) if (!top || b.n > top.n) top = b;
  // No flat colour at the edge (the mark reaches the edge, or the image is already clear): print it as it is.
  if (!top || ringOpaque < ringAll * 0.12 || top.n < ringOpaque * 0.5) {
    return { src: null, light: meanLum() > 0.86 };
  }
  const bg = [top.r / top.n, top.g / top.n, top.b / top.n];
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
  // A dark tile with a plain white or grey mark (a wordmark on navy) is printed as the mark alone, in the tile's own colour.
  // A dark tile with colour in the mark (a red sun on black) stays as the patch it is.
  if (lum(bg[0], bg[1], bg[2]) < 0.3) {
    let markPx = 0, chroma = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128 || dist(i) <= TOLERANCE) continue;
      markPx++;
      if (Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) > 70) chroma++;
    }
    if (markPx < w * h * 0.006 || chroma > markPx * 0.15) return { src: null, light: false };
    for (let i = 0; i < px.length; i += 4) {
      const a = Math.min(1, Math.max(0, (dist(i) - 24) / 170));
      px[i] = bg[0];
      px[i + 1] = bg[1];
      px[i + 2] = bg[2];
      px[i + 3] = Math.round(px[i + 3] * a);
    }
    ctx.putImageData(data, 0, 0);
    return { src: canvas.toDataURL("image/png"), light: false };
  }

  // A thin outline round the very edge would wall the background in, so the outermost rows are dropped first.
  const m = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (Math.min(x, y, w - 1 - x, h - 1 - y) < m) px[at(x, y) + 3] = 0;
  }

  const passable = (i: number) => px[i + 3] < 40 || dist(i) <= TOLERANCE;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const k = y * w + x;
    if (seen[k]) return;
    seen[k] = 1;
    if (passable(k * 4)) stack.push(k);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (Math.min(x, y, w - 1 - x, h - 1 - y) <= m + 1) push(x, y);
  }
  let removed = 0;
  while (stack.length) {
    const k = stack.pop()!;
    px[k * 4 + 3] = 0;
    removed++;
    const x = k % w;
    const y = (k - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // Barely anything came off: leave the logo as it was.
  if (removed < w * h * 0.04) return { src: null, light: false };

  // What is left, as pixels still visible. A white mark on a colour would vanish on a white garment, so keep its tile.
  let n = 0, sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    sum += lum(px[i], px[i + 1], px[i + 2]);
    n++;
  }
  if (n < w * h * 0.006) return { src: null, light: false };
  const mean = sum / n;
  if (mean > 0.88) return { src: null, light: false };

  // Thin leftovers of an outline (a hair of colour along the cut) are not part of the mark: drop pixels that are mostly surrounded by clear ones.
  for (let pass = 0; pass < 2; pass++) {
    const gone: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (px[at(x, y) + 3] === 0) continue;
        let clear = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && px[at(x + dx, y + dy) + 3] === 0) clear++;
        if (clear >= 5) gone.push(at(x, y) + 3);
      }
    }
    for (const i of gone) px[i] = 0;
  }

  // Keep the mark itself: drop specks, and small detached bits hugging the edge (what is left of an outline).
  {
    const label = new Int32Array(w * h);
    const sizes: number[] = [0];
    const edge: boolean[] = [false];
    const rim = m * 3;
    let next = 0;
    for (let start = 0; start < w * h; start++) {
      if (label[start] || px[start * 4 + 3] === 0) continue;
      next++;
      let size = 0;
      let touches = false;
      const q = [start];
      label[start] = next;
      while (q.length) {
        const k = q.pop()!;
        size++;
        const x = k % w;
        const y = (k - x) / w;
        if (Math.min(x, y, w - 1 - x, h - 1 - y) < rim) touches = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nk = ny * w + nx;
          if (label[nk] || px[nk * 4 + 3] === 0) continue;
          label[nk] = next;
          q.push(nk);
        }
      }
      sizes.push(size);
      edge.push(touches);
    }
    const biggest = Math.max(0, ...sizes);
    for (let k = 0; k < w * h; k++) {
      const c = label[k];
      if (c && (sizes[c] < biggest * 0.002 || (edge[c] && sizes[c] < biggest * 0.25))) px[k * 4 + 3] = 0;
    }
  }

  // Soften the cut edge so the mark doesn't get a hard halo.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (px[i + 3] === 0) continue;
      if (px[at(x - 1, y) + 3] === 0 || px[at(x + 1, y) + 3] === 0 || px[at(x, y - 1) + 3] === 0 || px[at(x, y + 1) + 3] === 0) px[i + 3] = 150;
    }
  }
  ctx.putImageData(data, 0, 0);
  return { src: canvas.toDataURL("image/png"), light: mean > 0.86 };
}
