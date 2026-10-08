// Pictures for the canvas: profile photos, brand logos, event banners and NFT cards. Each is loaded once, scaled down
// into a small canvas (so drawing 300 of them per frame stays cheap) and faded in when it arrives.

type Fit = "cover" | "contain";
interface Entry {
  c: HTMLCanvasElement | null;
  state: "queued" | "loading" | "ready" | "failed";
  at: number;
}

const OK_URL = /^(https:\/\/|\/)/;

export class Sprites {
  private map = new Map<string, Entry>();
  private queue: { key: string; url: string; size: number; fit: Fit }[] = [];
  private active = 0;
  private dead = false;

  constructor(private onLoad: () => void, private max = 6) {}

  destroy() {
    this.dead = true;
    this.queue = [];
  }

  /** The picture as a small canvas, or null while it loads or if it can't. Asking again is free. */
  get(url: string | null | undefined, size = 96, fit: Fit = "cover"): { c: HTMLCanvasElement; alpha: number } | null {
    if (!url || !OK_URL.test(url)) return null;
    const key = `${url}|${size}|${fit}`;
    let e = this.map.get(key);
    if (!e) {
      e = { c: null, state: "queued", at: 0 };
      this.map.set(key, e);
      this.queue.push({ key, url, size, fit });
      this.pump();
    }
    if (e.state !== "ready" || !e.c) return null;
    return { c: e.c, alpha: Math.min(1, (performance.now() - e.at) / 280) };
  }

  /** True while something is still fading in, so the draw loop knows to keep going. */
  get fading() {
    const now = performance.now();
    for (const e of this.map.values()) if (e.state === "ready" && now - e.at < 300) return true;
    return false;
  }

  private pump() {
    while (!this.dead && this.active < this.max && this.queue.length) {
      const job = this.queue.shift()!;
      const e = this.map.get(job.key)!;
      e.state = "loading";
      this.active += 1;
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.active -= 1;
        if (!this.dead) {
          try {
            e.c = scale(img, job.size, job.fit);
            e.state = "ready";
            e.at = performance.now();
            this.onLoad();
          } catch {
            e.state = "failed";
          }
        }
        this.pump();
      };
      img.onerror = () => {
        this.active -= 1;
        e.state = "failed";
        this.pump();
      };
      img.src = job.url;
    }
  }
}

function scale(img: HTMLImageElement, size: number, fit: Fit): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  const k = fit === "cover" ? Math.max(size / w, size / h) : Math.min(size / w, size / h);
  g.drawImage(img, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
  return c;
}
