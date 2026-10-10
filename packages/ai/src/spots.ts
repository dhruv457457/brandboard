import sharp from "sharp";

/**
 * Spot suggestions the model gets wrong are checked against the picture itself: the canvas is the garment on a
 * transparent background, so any rectangle can be tested against the real silhouette. A suggestion that sits on the
 * background, the head or the wheels is moved onto the garment or dropped, and when the model gives too few usable
 * spots (or none, or an error) the rest are found by searching the silhouette for flat areas, spread apart.
 */
export interface Spot {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type Surface = "outfit" | "car" | "hoodie";

interface Mask {
  W: number;
  H: number;
  /** Integral image of the garment pixels: sum over any rectangle in O(1). */
  sum: Int32Array;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const GRID = 240;

async function loadMask(image: string): Promise<Mask | null> {
  try {
    const bytes = image.startsWith("data:")
      ? Buffer.from(image.slice(image.indexOf(",") + 1), "base64")
      : Buffer.from(await (await fetch(image)).arrayBuffer());
    const { data, info } = await sharp(bytes).ensureAlpha().resize(GRID, GRID, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H } = info;
    const S = W + 1;
    const solidSum = new Int32Array(S * (H + 1));
    const flatSum = new Int32Array(S * (H + 1));
    let x0 = W, y0 = H, x1 = -1, y1 = -1, solid = 0, flat = 0;
    for (let y = 0; y < H; y++) {
      let rowSolid = 0, rowFlat = 0;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const on = data[i + 3] > 40 ? 1 : 0;
        // Flat, light cloth or paint: where a logo sits well. Wheels, windows, skin, hair and shoes are not.
        let light = on && data[i] > 190 && data[i + 1] > 190 && data[i + 2] > 190 ? 1 : 0;
        // ...and smooth: spokes, grilles, seams and edges change brightness quickly, plain paint and cloth don't.
        if (light && x + 1 < W && y + 1 < H) {
          const g = (j: number) => data[j] * 0.3 + data[j + 1] * 0.59 + data[j + 2] * 0.11;
          if (Math.abs(g(i) - g(i + 4)) + Math.abs(g(i) - g(i + W * 4)) > 26) light = 0;
        }
        if (on) {
          solid++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
        flat += light;
        rowSolid += on;
        rowFlat += light;
        solidSum[(y + 1) * S + x + 1] = solidSum[y * S + x + 1] + rowSolid;
        flatSum[(y + 1) * S + x + 1] = flatSum[y * S + x + 1] + rowFlat;
      }
    }
    // No transparency to measure (everything solid) or nothing there: nothing to validate against.
    if (x1 < x0 || solid > W * H * 0.97) return null;
    // A white garment is judged by its light areas; a coloured one (or a dark car) by its whole silhouette.
    return { W, H, sum: flat > solid * 0.2 ? flatSum : solidSum, bbox: { x0, y0, x1: x1 + 1, y1: y1 + 1 } };
  } catch {
    return null;
  }
}

const coverage = (m: Mask, x: number, y: number, w: number, h: number): number => {
  const xa = Math.max(0, Math.round(x)), ya = Math.max(0, Math.round(y));
  const xb = Math.min(m.W, Math.round(x + w)), yb = Math.min(m.H, Math.round(y + h));
  if (xb <= xa || yb <= ya) return 0;
  const S = m.W + 1;
  const inside = m.sum[yb * S + xb] - m.sum[ya * S + xb] - m.sum[yb * S + xa] + m.sum[ya * S + xa];
  return inside / (w * h);
};

/** The band of the subject where a patch looks natural: not the head or shoes on a person, not the roof or wheels on a car. */
function allowedBand(surface: Surface, m: Mask): [number, number] {
  const { y0, y1 } = m.bbox;
  const h = y1 - y0;
  return surface === "car" ? [y0 + h * 0.3, y0 + h * 0.78] : [y0 + h * 0.17, y0 + h * 0.9];
}

const overlaps = (a: Spot, b: Spot) => {
  // A little breathing room: spots may not touch.
  const gap = 1.2;
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap);
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap);
  return ix * iy > 0;
};

function nameFor(surface: Surface, m: Mask, cx: number, cy: number, used: Set<string>): string {
  const { x0, y0, x1, y1 } = m.bbox;
  const rx = (cx - x0) / (x1 - x0), ry = (cy - y0) / (y1 - y0);
  const side = rx < 0.38 ? "left" : rx > 0.62 ? "right" : "center";
  const outer = rx < 0.2 || rx > 0.8;
  const base = surface === "car"
    ? (rx < 0.34 ? "Front" : rx > 0.66 ? "Rear" : "Door") + (ry < 0.5 ? " upper" : " lower")
    : outer && ry < 0.6 ? "Sleeve"
    : ry < 0.4 ? "Chest" : ry < 0.62 ? "Waist" : "Thigh";
  const label = surface === "car" ? base : `${base} ${side}`;
  let name = label, n = 2;
  while (used.has(name)) name = `${label} ${n++}`;
  used.add(name);
  return name.slice(0, 31);
}

/**
 * Check the model's spots against the silhouette, then top up to `count`. Percent boxes in, percent boxes out.
 * Without a usable mask the model's own answer is returned as it was.
 */
export async function checkSpots(image: string, surface: Surface, proposed: Spot[], count: number): Promise<Spot[]> {
  const m = await loadMask(image);
  if (!m) return proposed;
  const sx = m.W / 100, sy = m.H / 100;
  const [bandTop, bandBottom] = allowedBand(surface, m);
  const kept: Spot[] = [];
  const used = new Set<string>();

  for (const p of proposed) {
    let x = p.x * sx, y = p.y * sy, w = p.w * sx, h = p.h * sy;
    // Squarish (a logo patch, not a stripe), and small next to the garment.
    const side = Math.min(Math.sqrt(w * h), (m.bbox.x1 - m.bbox.x0) * 0.26);
    x += (w - side) / 2; y += (h - side) / 2; w = side; h = side;
    let ok = coverage(m, x, y, w, h) >= 0.97 && y >= bandTop - h * 0.3 && y + h <= bandBottom + h * 0.3;
    if (!ok) {
      // Nudge: nearest valid position within a small search around where the model pointed.
      let best: { x: number; y: number; d: number } | null = null;
      const step = Math.max(1, Math.round(w / 4));
      for (let dy = -h * 1.5; dy <= h * 1.5; dy += step) {
        for (let dx = -w * 1.5; dx <= w * 1.5; dx += step) {
          const nx = x + dx, ny = y + dy;
          if (ny < bandTop || ny + h > bandBottom || coverage(m, nx, ny, w, h) < 0.97) continue;
          const d = dx * dx + dy * dy;
          if (!best || d < best.d) best = { x: nx, y: ny, d };
        }
      }
      if (best) { x = best.x; y = best.y; ok = true; }
    }
    if (!ok) continue;
    const spot: Spot = { name: p.name, x: x / sx, y: y / sy, w: w / sx, h: h / sy };
    if (kept.some((k) => overlaps(k, spot))) continue;
    used.add(spot.name);
    kept.push(spot);
  }

  if (kept.length < count) {
    // Search the silhouette for flat areas: squares well inside it, each as far from the others as possible.
    const bw = m.bbox.x1 - m.bbox.x0;
    const size = Math.max(8, Math.round(surface === "car" ? bw * 0.09 : bw * 0.2));
    const step = Math.max(2, Math.round(size / 3));
    // Strictest first; if the garment has too little flat area for that, accept a little more texture, then a smaller patch.
    let cands: { x: number; y: number }[] = [];
    let found = 0;
    for (const [need, scale] of [[0.985, 1], [0.95, 1], [0.92, 0.85], [0.88, 0.7]] as const) {
      cands = [];
      const sz = size * scale;
      for (let y = Math.ceil(bandTop); y + sz <= bandBottom; y += step)
        for (let x = m.bbox.x0; x + sz <= m.bbox.x1; x += step)
          if (coverage(m, x, y, sz, sz) >= need) cands.push({ x, y });
      found = sz;
      if (cands.length >= (count - kept.length) * 6) break;
    }
    const size2 = found;
    const centres = kept.map((k) => ({ cx: (k.x + k.w / 2) * sx, cy: (k.y + k.h / 2) * sy }));
    while (kept.length < count && cands.length) {
      let bestI = -1, bestD = -1;
      cands.forEach((c, i) => {
        const cx = c.x + size2 / 2, cy = c.y + size2 / 2;
        const d = centres.length ? Math.min(...centres.map((o) => (o.cx - cx) ** 2 + (o.cy - cy) ** 2)) : -((cx - (m.bbox.x0 + bw / 2)) ** 2 + (cy - (m.bbox.y0 + m.bbox.y1) / 2) ** 2);
        if (d > bestD) { bestD = d; bestI = i; }
      });
      const c = cands.splice(bestI, 1)[0]!;
      const cx = c.x + size2 / 2, cy = c.y + size2 / 2;
      const spot: Spot = { name: nameFor(surface, m, cx, cy, used), x: c.x / sx, y: c.y / sy, w: size2 / sx, h: size2 / sy };
      if (kept.some((k) => overlaps(k, spot))) continue;
      kept.push(spot);
      centres.push({ cx, cy });
    }
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  return kept.slice(0, count).map((s) => ({ ...s, x: r(s.x), y: r(s.y), w: r(s.w), h: r(s.h) }));
}
