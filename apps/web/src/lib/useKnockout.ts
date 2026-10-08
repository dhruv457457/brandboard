"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, string | null>();
const SIZE = 320;
/** How far a pixel's colour may be from the logo's background and still count as background (0 to 441). */
const TOLERANCE = 46;

/**
 * Takes the flat background off a logo so only the mark itself is printed on the fabric: the colour found in the
 * corners is made transparent, starting from the edges so a white inside the mark stays. Returns null until it's ready,
 * and for good if the image can't be read (blocked by the host, or it already has a transparent background).
 */
export function useKnockout(src: string | null | undefined): string | null {
  const [out, setOut] = useState<string | null>(src ? cache.get(src) ?? null : null);
  useEffect(() => {
    if (!src) { setOut(null); return; }
    if (cache.has(src)) { setOut(cache.get(src) ?? null); return; }
    let live = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let result: string | null = null;
      try { result = knock(img); } catch { result = null; }
      cache.set(src, result);
      if (live) setOut(result);
    };
    img.onerror = () => { cache.set(src, null); };
    img.src = src;
    return () => { live = false; };
  }, [src]);
  return out;
}

function knock(img: HTMLImageElement): string | null {
  const scale = Math.min(1, SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const at = (x: number, y: number) => (y * w + x) * 4;

  // The background colour is the one the four corners agree on. Already transparent there: nothing to do.
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  if (corners.some((i) => px[i + 3] < 200)) return null;
  const bg = [0, 1, 2].map((c) => corners.reduce((n, i) => n + px[i + c], 0) / 4);
  const dist = (i: number) => Math.hypot(px[i] - bg[0], px[i + 1] - bg[1], px[i + 2] - bg[2]);
  if (corners.some((i) => dist(i) > TOLERANCE)) return null; // corners differ: not a flat background

  // Flood from every edge pixel; whatever is close to the background colour and connected to the edge goes transparent.
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const k = y * w + x;
    if (seen[k]) return;
    seen[k] = 1;
    if (dist(k * 4) <= TOLERANCE) stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
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
  // Nothing to gain if almost nothing went, and a mark that was mostly background is better left as it was.
  if (removed < w * h * 0.04 || removed > w * h * 0.95) return null;

  // Soften the cut edge so the mark doesn't get a hard halo.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = at(x, y);
      if (px[i + 3] === 0) continue;
      if (px[at(x - 1, y) + 3] === 0 || px[at(x + 1, y) + 3] === 0 || px[at(x, y - 1) + 3] === 0 || px[at(x, y + 1) + 3] === 0) px[i + 3] = 150;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}
