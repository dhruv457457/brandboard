// The Patchwork engine: force layout, canvas drawing, camera, effects, replay. No React in here; Patchwork.tsx owns the UI.
// Everything is drawn as Patched stickers (ink outline, hard offset shadow, pastel fill, dashed stitching) and every
// colour is read from the CSS tokens, so the theme toggle repaints the graph.

import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, type Simulation, type SimulationNodeDatum } from "d3-force";
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior } from "d3-zoom";
import { select } from "d3-selection";
import type { EventGraph, GBid, GNode, GThread, ThreadKind } from "@/lib/graph/types";
import { Sprites } from "./sprites";

export interface RNode extends GNode, SimulationNodeDatum {
  x: number;
  y: number;
  visible: boolean;
  born: number;
  bump: number;
  phase: number;
  rot: number;
  leader: RNode | null;
  amount: number;
  bidCount: number;
  sold: boolean;
  /** USDC this brand currently leads with / a creator has escrowed. */
  total: number;
}
export interface RThread {
  id: string;
  kind: ThreadKind;
  source: RNode;
  target: RNode;
  t: number;
  amount: number;
  tx: string | null;
  photo: string | null;
  visible: boolean;
  born: number;
}

export type Layer = "leads" | "flow" | "spotted" | "outbid";
export type ToastIcon = "zap" | "camera" | "stamp" | "node";
export interface Callbacks {
  select: (id: string | null) => void;
  /** Something the panel shows changed (called at most a few times a second). */
  changed: () => void;
  toast: (title: string, sub: string, icon: ToastIcon) => void;
  replay: (s: { playing: boolean; p: number; label: string }) => void;
}

export interface Row {
  icon: "zap" | "undo" | "camera" | "square" | "receipt";
  text: string;
  amount: string;
  tx: string | null;
  node?: string;
}
export interface Described {
  node: RNode;
  stats: { v: string; k: string }[];
  rows: Row[];
  rank: number;
  degree: number;
  photos: string[];
  leader: RNode | null;
}

const PASTEL = ["p1", "p2", "p3", "p4", "p5"] as const;
const TOKENS = ["paper", "card", "soft", "ink", "muted", "accent", "accent-text", "accent-soft", "green", "shadow", "stage", "p1", "p2", "p3", "p4", "p5"] as const;
const DIST: Partial<Record<ThreadKind, number>> = { lists: 200, has: 16, leads: 130, spotted: 120, holds: 70 };
const STR: Partial<Record<ThreadKind, number>> = { lists: 0.15, has: 1, leads: 0.025, spotted: 0.035, holds: 0.05 };
const RING = { creator: 210, brand: 400, holder: 400, spotter: 440 } as const;
const BEND: Partial<Record<ThreadKind, number>> = { leads: 0.14, outbid: 0.1, spotted: -0.18, holds: 0.1 };
const ORDER: Record<string, number> = { spotter: 0, brand: 1, holder: 1, creator: 2, spot: 3, event: 4 };
const TAU = Math.PI * 2;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const usd = (v: number) => "$" + Math.round(v).toLocaleString("en-US");
const initials = (s: string) => s.replace(/^@/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
function hash01(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

interface Particle { a: RNode; b: RNode; color: string; dur: number; born: number; refund: boolean; done?: () => void }
interface Ripple { node: RNode; born: number; color: string }
interface Snap { a: RNode; b: RNode; born: number }
interface Stamp { node: RNode; born: number }

export class PatchworkEngine {
  nodes: RNode[] = [];
  threads: RThread[] = [];
  byId = new Map<string, RNode>();
  graph: EventGraph | null = null;
  layers: Record<Layer, boolean> = { leads: true, flow: true, spotted: true, outbid: false };
  viewer: string | null = null;
  selectedId: string | null = null;

  private ctx: CanvasRenderingContext2D;
  private sim: Simulation<RNode, undefined>;
  private zoomer: ZoomBehavior<HTMLCanvasElement, unknown>;
  private sprites: Sprites;
  private tokens: Record<string, string> = {};
  private W = 0;
  private H = 0;
  private dpr = 1;
  private hovered: RNode | null = null;
  private drag: RNode | null = null;
  private down: { x: number; y: number; n: RNode | null } | null = null;
  private dirty = true;
  private raf = 0;
  private reduce: boolean;
  private bids: GBid[] = [];
  private seenBids = new Set<string>();
  private nextBid = 0;
  private fx = { particles: [] as Particle[], ripples: [] as Ripple[], snaps: [] as Snap[], stamps: [] as Stamp[] };
  private tip: HTMLDivElement;
  private ro: ResizeObserver;
  private mo: MutationObserver;
  private io: IntersectionObserver;
  private onScreen = true;
  private lastChanged = 0;
  private replayState: { start: number; from: number } | null = null;
  private cam: { from: { x: number; y: number; k: number }; to: { x: number; y: number; k: number }; start: number; dur: number } | null = null;
  private frameCount = 0;
  private display = '"Arial Black", sans-serif';
  private sans = "system-ui, sans-serif";

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private cb: Callbacks) {
    this.ctx = canvas.getContext("2d")!;
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.sprites = new Sprites(() => (this.dirty = true));
    this.readTokens();

    this.sim = forceSimulation<RNode>([])
      .force("link", forceLink<RNode, RThread>([]))
      .force("charge", forceManyBody<RNode>().distanceMax(520))
      .force("collide", forceCollide<RNode>().iterations(2))
      .force("radial", forceRadial<RNode>(0, 0, 0))
      .force("drift", () => this.drift())
      .velocityDecay(0.38)
      .alphaDecay(0.025)
      .alphaTarget(this.reduce ? 0 : 0.012)
      .stop();

    this.zoomer = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.25, 4])
      .filter((ev: Event) => {
        if (ev.type === "wheel") return true;
        const e = ev as MouseEvent;
        if (e.type === "dblclick") return false;
        if (e.button) return false;
        const r = canvas.getBoundingClientRect();
        return !this.hit(e.clientX - r.left, e.clientY - r.top);
      })
      .on("zoom", () => {
        this.dirty = true;
        this.hideTip();
      });
    select(canvas).call(this.zoomer).on("dblclick.zoom", null);

    this.tip = document.createElement("div");
    this.tip.style.cssText =
      "position:absolute;pointer-events:none;background:var(--card);color:var(--ink);border:1.5px solid var(--ink);border-radius:12px;padding:7px 10px;font-size:12px;box-shadow:3px 3px 0 var(--shadow);transform:translate(-50%,calc(-100% - 14px));white-space:nowrap;opacity:0;transition:opacity .12s;z-index:5";
    host.appendChild(this.tip);

    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", this.onLeave);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.mo = new MutationObserver(() => {
      this.readTokens();
      this.dirty = true;
    });
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    this.io = new IntersectionObserver(([e]) => (this.onScreen = e?.isIntersecting ?? true));
    this.io.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    select(this.canvas).on(".zoom", null);
    this.ro.disconnect();
    this.mo.disconnect();
    this.io.disconnect();
    this.sprites.destroy();
    this.sim.stop();
    this.tip.remove();
  }

  // ------------------------------------------------------------------ data in

  /** First load of an event, or a switch to another one: build everything and fly the camera over the whole graph. */
  load(g: EventGraph) {
    this.graph = g;
    this.nodes = [];
    this.threads = [];
    this.byId.clear();
    this.fx = { particles: [], ripples: [], snaps: [], stamps: [] };
    this.replayState = null;
    this.selectedId = null;
    this.hovered = null;
    const creators = g.nodes.filter((n) => n.kind === "creator");
    const now = performance.now();
    let rank = 0;
    for (const n of g.nodes) {
      const ci = creators.indexOf(n);
      let x = 0;
      let y = 0;
      if (n.kind === "creator") {
        const a = (ci / Math.max(1, creators.length)) * TAU;
        x = Math.cos(a) * RING.creator;
        y = Math.sin(a) * RING.creator;
      } else if (n.kind !== "event" && n.kind !== "spot") {
        const a = hash01(n.id) * TAU;
        x = Math.cos(a) * 400;
        y = Math.sin(a) * 400;
      }
      this.add(n, x, y, now + (this.reduce ? -1e9 : Math.min(1400, rank++ * 14)));
    }
    for (const n of this.nodes) {
      if (n.kind !== "spot") continue;
      const c = this.byId.get(n.creatorId ?? "");
      n.x = (c?.x ?? 0) + (hash01(n.id) - 0.5) * 40;
      n.y = (c?.y ?? 0) + (hash01(n.id + "y") - 0.5) * 40;
    }
    const hub = this.byId.get("event");
    if (hub) {
      hub.fx = 0;
      hub.fy = 0;
    }
    for (const t of g.threads) this.addThread(t, -1e9);
    this.bids = g.bids;
    this.seenBids = new Set(g.bids.map((b) => b.id));
    this.applyBidsUpTo(1, false);
    this.sim.nodes(this.nodes);
    this.refreshForces();
    this.sim.alpha(1);
    this.sim.tick(this.reduce ? 320 : 260);
    this.fit(0);
    this.dirty = true;
    this.cb.select(null);
    this.changed(true);
  }

  /** A fresh snapshot of the same event: new people, spots, photos and bids come in with their animation. */
  update(g: EventGraph) {
    if (!this.graph || g.event.id !== this.graph.event.id) return this.load(g);
    const now = performance.now();
    this.graph = g;
    const hub = this.byId.get("event")!;
    const fresh: RNode[] = [];
    for (const n of g.nodes) {
      const cur = this.byId.get(n.id);
      if (cur) {
        Object.assign(cur, { label: n.label, name: n.name, image: n.image, logo: n.logo, roles: n.roles, kind: n.kind, verified: n.verified, won: n.won, tokenId: n.tokenId, href: n.href, surface: n.surface });
        continue;
      }
      const anchor = n.kind === "spot" ? this.byId.get(n.creatorId ?? "") : hub;
      const a = hash01(n.id) * TAU;
      // spots start on their creator, people just outside the ring and settle in
      const d = n.kind === "spot" ? 24 : n.kind === "creator" ? RING.creator : RING.brand;
      const x = (n.kind === "spot" ? (anchor?.x ?? 0) : 0) + Math.cos(a) * d;
      const y = (n.kind === "spot" ? (anchor?.y ?? 0) : 0) + Math.sin(a) * d;
      const rn = this.add(n, x, y, now);
      fresh.push(rn);
    }
    const known = new Set(this.threads.filter((t) => t.kind !== "leads" && t.kind !== "outbid").map((t) => t.id));
    for (const t of g.threads) {
      if (known.has(t.id)) continue;
      const th = this.addThread(t, now);
      if (th && t.kind === "spotted") {
        this.fx.ripples.push({ node: th.target, born: now, color: this.tokens["accent-text"]! });
        th.target.bump = now;
        this.cb.toast(`${th.source.label} spotted ${th.target.label}`, "on the wall", "camera");
      }
    }
    for (const n of fresh) if (n.kind === "creator") this.cb.toast(`${n.label} joined`, "listed spots", "node");
    this.sim.nodes(this.nodes);
    // Bids we haven't seen, in order, each with its animation.
    this.bids = g.bids;
    for (const b of g.bids) {
      if (this.seenBids.has(b.id)) continue;
      this.seenBids.add(b.id);
      const spot = this.byId.get(b.spot);
      const who = this.byId.get(b.who);
      if (spot && who) this.applyBid(spot, who, b.amount, b.buyNow, true, false);
    }
    this.dirty = true;
    this.changed(true);
  }

  private add(n: GNode, x: number, y: number, born: number): RNode {
    const rn: RNode = {
      ...n, x, y, visible: true, born, bump: -1e9, phase: hash01(n.id) * TAU, rot: ((hash01(n.id + "r") * 6 - 3) * Math.PI) / 180,
      leader: null, amount: 0, bidCount: 0, sold: Boolean(n.won), total: 0,
    };
    this.nodes.push(rn);
    this.byId.set(rn.id, rn);
    return rn;
  }

  private addThread(t: GThread, born: number): RThread | null {
    const source = this.byId.get(t.source);
    const target = this.byId.get(t.target);
    if (!source || !target) return null;
    const th: RThread = { id: t.id, kind: t.kind, source, target, t: t.t, amount: t.amount ?? 0, tx: t.tx ?? null, photo: t.photo ?? null, visible: true, born };
    this.threads.push(th);
    this.dirty = true;
    return th;
  }

  // ------------------------------------------------------------------ bids

  private applyBidsUpTo(p: number, animate: boolean) {
    this.nextBid = 0;
    while (this.nextBid < this.bids.length && this.bids[this.nextBid]!.t <= p) {
      const b = this.bids[this.nextBid++]!;
      const spot = this.byId.get(b.spot);
      const who = this.byId.get(b.who);
      if (spot && who) this.applyBid(spot, who, b.amount, b.buyNow, animate, !animate);
    }
  }

  /** `who` bids `amount` on `spot`. Animated bids fly a USDC dot to the spot first and only then change the state. */
  private applyBid(spot: RNode, who: RNode, amount: number, buyNow: boolean, animate: boolean, silent: boolean) {
    const land = () => {
      const now = performance.now();
      const prev = spot.leader;
      const prevAmount = spot.amount;
      if (prev === who) {
        spot.amount = amount;
        who.total += amount - prevAmount;
        const own = this.leads(spot);
        if (own) own.amount = amount;
        return;
      }
      if (prev) {
        const old = this.leads(spot);
        if (old) {
          old.kind = "outbid";
          old.born = -1e9;
        }
        prev.total -= prevAmount;
        if (animate) {
          this.fx.snaps.push({ a: prev, b: spot, born: now });
          this.shoot(spot, prev, this.tokens.muted!, 900, true);
        }
      }
      // A brand that bids again after being outbid drops its old ghost thread.
      this.threads = this.threads.filter((t) => !(t.kind === "outbid" && t.source === who && t.target === spot));
      spot.leader = who;
      spot.amount = amount;
      spot.bidCount += 1;
      who.total += amount;
      const creator = this.byId.get(spot.creatorId ?? "");
      if (creator) creator.total += amount - (prev ? prevAmount : 0);
      this.threads.push({ id: `lead:${spot.id}:${who.id}:${spot.bidCount}`, kind: "leads", source: who, target: spot, t: 0, amount, tx: null, photo: null, visible: true, born: animate ? now : -1e9 });
      if (buyNow || (spot.buyNow && amount >= spot.buyNow)) {
        spot.sold = true;
        if (animate) this.fx.stamps.push({ node: spot, born: now });
      }
      if (animate) {
        this.fx.ripples.push({ node: spot, born: now, color: this.tokens.accent! });
        spot.bump = now;
        if (!silent) this.cb.toast(`${who.label} ${spot.sold ? "bought" : "leads"} ${spot.label}`, `${usd(amount)} locked in escrow`, spot.sold ? "stamp" : "zap");
      }
      this.dirty = true;
      this.changed();
    };
    if (animate && !this.reduce) {
      who.visible = true;
      this.shoot(who, spot, this.tokens.accent!, silent ? 520 : 1000, false, land);
    } else land();
  }

  private leads(spot: RNode): RThread | undefined {
    for (let i = this.threads.length - 1; i >= 0; i--) {
      const t = this.threads[i]!;
      if (t.kind === "leads" && t.target === spot) return t;
    }
    return undefined;
  }

  private shoot(a: RNode, b: RNode, color: string, dur: number, refund: boolean, done?: () => void) {
    if (this.reduce) return done?.();
    this.fx.particles.push({ a, b, color, dur, born: performance.now(), refund, done });
  }

  // ------------------------------------------------------------------ queries for the panel

  radius(n: RNode): number {
    switch (n.kind) {
      case "event": return 44;
      case "creator": return 20 + Math.min(10, n.total / 150);
      case "spot": return 9 + Math.min(5, n.amount / 100);
      case "brand":
      case "holder": return 16 + Math.min(9, n.total / 250);
      default: return 12;
    }
  }

  degree(n: RNode, kind?: ThreadKind): number {
    let d = 0;
    for (const t of this.threads) if (t.visible && (kind ? t.kind === kind : t.kind !== "lists") && (t.source === n || t.target === n)) d++;
    return d;
  }

  private people(): RNode[] {
    return this.nodes.filter((n) => n.visible && n.kind !== "spot" && n.kind !== "event");
  }
  rankOf(n: RNode): number {
    const list = this.people().map((x) => [x, this.degree(x)] as const).sort((a, b) => b[1] - a[1]);
    return list.findIndex(([x]) => x === n) + 1;
  }

  get viewerNode(): RNode | null {
    return this.viewer ? (this.byId.get(`w:${this.viewer}`) ?? null) : null;
  }

  /** Every person in the graph, most connected first (the "View as list" table). */
  table() {
    return this.people().map((n) => ({ n, d: this.degree(n) })).sort((a, b) => b.d - a.d);
  }

  overview() {
    const vis = this.nodes.filter((n) => n.visible);
    const top = this.people().map((n) => ({ n, d: this.degree(n) })).sort((a, b) => b.d - a.d).slice(0, 5);
    return {
      creators: vis.filter((n) => n.roles.includes("creator")).length,
      spots: vis.filter((n) => n.kind === "spot").length,
      brands: vis.filter((n) => n.roles.includes("brand") || n.roles.includes("holder")).length,
      spotters: vis.filter((n) => n.roles.includes("spotter")).length,
      escrow: this.nodes.filter((n) => n.kind === "spot").reduce((s, n) => s + n.amount, 0),
      bids: this.nodes.filter((n) => n.kind === "spot").reduce((s, n) => s + n.bidCount, 0),
      top,
    };
  }

  describe(id: string): Described | null {
    const n = this.byId.get(id);
    if (!n || !n.visible) return null;
    const rows: Row[] = [];
    const photos: string[] = [];
    for (const t of this.threads) {
      if (!t.visible || (t.source !== n && t.target !== n) || t.kind === "lists") continue;
      const a = t.source;
      const b = t.target;
      if (t.kind === "leads") rows.push({ icon: "zap", text: `${a.label} leads ${b.label}${n.kind !== "spot" ? ` on ${this.byId.get(b.creatorId ?? "")?.label ?? ""}` : ""}`, amount: usd(t.amount), tx: this.txOf(b, a), node: n === a ? b.id : a.id });
      if (t.kind === "outbid") rows.push({ icon: "undo", text: `${a.label} was outbid on ${b.label}`, amount: "refunded", tx: null, node: n === a ? b.id : a.id });
      if (t.kind === "spotted") {
        rows.push({ icon: "camera", text: `${a.label} spotted ${b.label}`, amount: "", tx: null, node: n === a ? b.id : a.id });
        if (t.photo && b === n) photos.push(t.photo);
      }
      if (t.kind === "holds") rows.push({ icon: "receipt", text: `${a.label} holds the receipt for ${b.label}`, amount: "", tx: null, node: a.id });
      if (t.kind === "has" && n.kind === "creator") rows.push({ icon: "square", text: b.label, amount: b.leader ? usd(b.amount) : "open", tx: null, node: b.id });
    }
    const stats: { v: string; k: string }[] = [];
    const led = this.threads.filter((t) => t.kind === "leads" && t.source === n).length;
    if (n.kind === "spot") stats.push({ v: n.leader ? usd(n.amount) : "Open", k: "top bid" }, { v: String(n.bidCount), k: "bids" }, { v: usd(n.buyNow ?? 0), k: "buy now" });
    else if (n.kind === "creator") {
      const own = this.nodes.filter((s) => s.kind === "spot" && s.creatorId === n.id);
      stats.push({ v: usd(n.total), k: "escrowed" }, { v: `${own.filter((s) => s.leader).length}/${own.length}`, k: "spots led" }, { v: String(this.degree(n, "spotted")), k: "spotted by" });
    } else if (n.kind === "spotter") stats.push({ v: String(this.degree(n, "spotted")), k: "spotted" }, { v: String(this.degree(n)), k: "threads" }, { v: `#${this.rankOf(n)}`, k: "rank" });
    else stats.push({ v: usd(n.total), k: "leading" }, { v: String(led), k: "spots led" }, { v: String(this.threads.filter((t) => t.kind === "outbid" && t.source === n).length), k: "outbid" });
    return { node: n, stats, rows: rows.slice(0, 16), rank: this.rankOf(n), degree: this.degree(n), photos, leader: n.leader };
  }

  /** Transaction of the bid that put `who` on `spot`, for the explorer link. */
  private txOf(spot: RNode, who: RNode): string | null {
    for (let i = this.bids.length - 1; i >= 0; i--) {
      const b = this.bids[i]!;
      if (b.spot === spot.id && b.who === who.id && b.tx) return b.tx;
    }
    return null;
  }

  // ------------------------------------------------------------------ camera and selection

  select(id: string | null, fly = false) {
    this.selectedId = id;
    this.dirty = true;
    this.cb.select(id);
    if (id && fly) this.focus(id);
  }
  setLayer(l: Layer, on: boolean) {
    this.layers[l] = on;
    this.dirty = true;
  }
  setViewer(wallet: string | null) {
    this.viewer = wallet ? wallet.toLowerCase() : null;
    this.dirty = true;
    this.changed(true);
  }

  focus(id: string, k = 1.6) {
    const n = this.byId.get(id);
    if (n) this.flyTo(n.x, n.y, k);
  }
  findMe(): boolean {
    const me = this.viewerNode;
    if (!me) return false;
    if (this.replayState) this.stopReplay(true);
    this.select(me.id);
    this.flyTo(me.x, me.y, 1.5);
    this.fx.ripples.push({ node: me, born: performance.now(), color: this.tokens.accent! });
    return true;
  }
  fit(ms = 700) {
    const vis = this.nodes.filter((n) => n.visible);
    if (!vis.length || !this.W) return;
    const xs = vis.map((n) => n.x);
    const ys = vis.map((n) => n.y);
    const x0 = Math.min(...xs) - 70;
    const x1 = Math.max(...xs) + 70;
    const y0 = Math.min(...ys) - 70;
    const y1 = Math.max(...ys) + 100;
    const k = clamp(Math.min(this.W / (x1 - x0), this.H / (y1 - y0)), 0.25, 1.3);
    this.moveTo({ x: this.W / 2 - ((x0 + x1) / 2) * k, y: this.H / 2 - ((y0 + y1) / 2) * k + 10, k }, ms);
  }
  private flyTo(wx: number, wy: number, k: number) {
    this.moveTo({ x: this.W / 2 - wx * k, y: this.H / 2 - wy * k, k }, 900);
  }
  private moveTo(to: { x: number; y: number; k: number }, ms: number) {
    const cur = zoomTransform(this.canvas);
    if (this.reduce || ms === 0) {
      this.setTransform(to);
      this.cam = null;
    } else this.cam = { from: { x: cur.x, y: cur.y, k: cur.k }, to, start: performance.now(), dur: ms };
  }
  private setTransform(t: { x: number; y: number; k: number }) {
    select(this.canvas).call(this.zoomer.transform, zoomIdentity.translate(t.x, t.y).scale(t.k));
  }

  // ------------------------------------------------------------------ replay

  get replaying() {
    return this.replayState !== null;
  }
  startReplay(from = 0) {
    if (!this.graph) return;
    if (!this.replayState) this.fit(700);
    this.resetTo(from);
    this.replayState = { start: performance.now(), from };
    this.select(null);
    this.emitReplay(from);
  }
  /** Stop playing. `jumpToEnd` shows the full graph again. */
  stopReplay(jumpToEnd = true) {
    this.replayState = null;
    if (jumpToEnd) this.resetTo(1);
    this.emitReplay(1);
    this.changed(true);
  }
  seek(p: number) {
    this.resetTo(p);
    if (p >= 1) this.stopReplay(false);
    else this.replayState = { start: performance.now(), from: p };
    this.emitReplay(p);
  }
  private emitReplay(p: number) {
    const g = this.graph;
    const label = !g || p >= 1 ? "Now" : new Date(g.t0 + p * (g.t1 - g.t0)).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    this.cb.replay({ playing: this.replayState !== null, p, label });
  }
  private resetTo(p: number) {
    this.threads = this.threads.filter((t) => t.kind !== "leads" && t.kind !== "outbid");
    for (const n of this.nodes) {
      n.leader = null;
      n.amount = 0;
      n.bidCount = 0;
      n.total = 0;
      n.sold = false;
      n.visible = n.kind === "event" || n.t <= p;
    }
    for (const t of this.threads) t.visible = t.t <= p;
    this.applyBidsUpTo(p, false);
    this.fx = { particles: [], ripples: [], snaps: [], stamps: [] };
    this.dirty = true;
  }
  private tickReplay(now: number) {
    const r = this.replayState;
    if (!r) return;
    const DUR = 22000;
    const p = Math.min(1, r.from + (now - r.start) / DUR);
    for (const n of this.nodes) {
      if (n.visible || n.t > p) continue;
      const near = n.kind === "spot" ? this.byId.get(n.creatorId ?? "") : this.threads.find((t) => (t.source === n || t.target === n) && (t.source === n ? t.target : t.source).visible);
      const a = near ? ("source" in near ? (near.source === n ? near.target : near.source) : near) : this.byId.get("event")!;
      n.visible = true;
      n.born = now;
      n.x = a.x + (hash01(n.id + "x") - 0.5) * 40;
      n.y = a.y + (hash01(n.id + "y") - 0.5) * 40;
      n.vx = n.vy = 0;
      this.dirty = true;
    }
    for (const t of this.threads) {
      if (t.visible || t.t > p) continue;
      t.visible = true;
      t.born = now;
      if (t.kind === "spotted") this.fx.ripples.push({ node: t.target, born: now, color: this.tokens["accent-text"]! });
      this.dirty = true;
    }
    while (this.nextBid < this.bids.length && this.bids[this.nextBid]!.t <= p) {
      const b = this.bids[this.nextBid++]!;
      const spot = this.byId.get(b.spot);
      const who = this.byId.get(b.who);
      if (spot && who) this.applyBid(spot, who, b.amount, b.buyNow, true, true);
    }
    this.emitReplay(p);
    if (p >= 1) this.stopReplay(false);
  }

  // ------------------------------------------------------------------ simulation

  private drift() {
    if (this.reduce) return;
    const t = performance.now() / 1000;
    for (const n of this.nodes) {
      if (n.fx != null) continue;
      n.vx = (n.vx ?? 0) + Math.sin(t * 0.5 + n.phase) * 0.025;
      n.vy = (n.vy ?? 0) + Math.cos(t * 0.37 + n.phase * 1.3) * 0.025;
    }
  }
  private refreshForces() {
    const live = (t: RThread) => t.visible && t.source.visible && t.target.visible && DIST[t.kind] != null;
    (this.sim.force("link") as ReturnType<typeof forceLink<RNode, RThread>>)
      .links(this.threads.filter(live))
      .distance((l) => (DIST[l.kind] ?? 100) + (l.kind === "has" ? this.radius(l.source) : 0))
      .strength((l) => STR[l.kind] ?? 0.05);
    (this.sim.force("charge") as ReturnType<typeof forceManyBody<RNode>>).strength((n) => (!n.visible ? 0 : n.kind === "spot" ? -18 : n.kind === "event" ? -800 : -260));
    (this.sim.force("collide") as ReturnType<typeof forceCollide<RNode>>).radius((n) => (n.visible ? this.radius(n) + (n.kind === "spot" ? 2 : 6) : 0));
    (this.sim.force("radial") as ReturnType<typeof forceRadial<RNode>>)
      .radius((n) => (RING as Record<string, number>)[n.kind] ?? 0)
      .strength((n) => (!n.visible || n.kind === "spot" || n.kind === "event" ? 0 : n.kind === "creator" ? 0.1 : 0.06));
  }
  private shown(t: RThread) {
    if (!t.visible || !t.source.visible || !t.target.visible) return false;
    if (t.kind === "lists" || t.kind === "has" || t.kind === "holds") return true;
    return this.layers[t.kind as Layer] ?? true;
  }

  // ------------------------------------------------------------------ input

  private resize() {
    const r = this.host.getBoundingClientRect();
    const first = this.W === 0;
    this.W = r.width;
    this.H = r.height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(this.W * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.H * this.dpr));
    this.dirty = true;
    if (first && this.W > 0 && this.nodes.length) this.fit(0);
  }
  private readTokens() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of TOKENS) this.tokens[k] = cs.getPropertyValue(`--${k}`).trim() || "#888";
    // Canvas can't resolve var(), so read the font stacks next/font put on <html>.
    this.display = cs.getPropertyValue("--font-bricolage").trim() || '"Arial Black", sans-serif';
    this.sans = cs.getPropertyValue("--font-geist").trim() || "system-ui, sans-serif";
  }
  private pos(ev: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top] as const;
  }
  private hit(sx: number, sy: number): RNode | null {
    const k = zoomTransform(this.canvas);
    const [x, y] = k.invert([sx, sy]);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i]!;
      if (!n.visible) continue;
      if (Math.hypot(n.x - x, n.y - y) < this.radius(n) * (n.kind === "spot" ? 1.3 : 1) + 4) return n;
    }
    return null;
  }
  private onDown = (ev: PointerEvent) => {
    const [x, y] = this.pos(ev);
    const n = this.hit(x, y);
    this.down = { x, y, n };
    if (n && n.kind !== "event") {
      this.drag = n;
      n.fx = n.x;
      n.fy = n.y;
      this.canvas.setPointerCapture(ev.pointerId);
      this.sim.alphaTarget(0.2);
    }
  };
  private onMove = (ev: PointerEvent) => {
    const [x, y] = this.pos(ev);
    if (this.drag) {
      const [wx, wy] = zoomTransform(this.canvas).invert([x, y]);
      this.drag.fx = wx;
      this.drag.fy = wy;
      this.hideTip();
      this.dirty = true;
      return;
    }
    const n = this.hit(x, y);
    if (n !== this.hovered) {
      this.hovered = n;
      this.canvas.style.cursor = n ? "pointer" : "grab";
      this.dirty = true;
    }
    if (n) this.showTip(n);
    else this.hideTip();
  };
  private onLeave = () => {
    if (!this.drag) {
      this.hovered = null;
      this.hideTip();
      this.dirty = true;
    }
  };
  private onUp = (ev: PointerEvent) => {
    const [x, y] = this.pos(ev);
    const moved = this.down ? Math.hypot(x - this.down.x, y - this.down.y) : 99;
    if (this.drag) {
      this.drag.fx = null;
      this.drag.fy = null;
      this.sim.alphaTarget(this.reduce ? 0 : 0.012);
      this.drag = null;
    }
    if (moved < 5 && this.down) this.select(this.down.n ? this.down.n.id : null);
    this.down = null;
  };

  private showTip(n: RNode) {
    const k = zoomTransform(this.canvas);
    const [sx, sy] = k.apply([n.x, n.y]);
    const tip = this.tip;
    tip.replaceChildren();
    const b = document.createElement("b");
    b.textContent = n.kind === "spot" ? `${n.label} on ${this.byId.get(n.creatorId ?? "")?.label ?? ""}` : n.name;
    const sub = document.createElement("span");
    const text =
      n.kind === "spot" ? (n.leader ? `${n.leader.label} · ${usd(n.amount)}` : `Open · ${usd(n.floor ?? 0)}+`)
      : n.kind === "creator" ? `${n.surface === "hoodie" ? "Team hoodie" : n.surface === "car" ? "Car" : "Outfit"} · ${usd(n.total)} escrowed`
      : n.kind === "brand" || n.kind === "holder" ? `${usd(n.total)} leading`
      : n.kind === "spotter" ? `Spotted ${this.degree(n, "spotted")}`
      : "Event";
    sub.textContent = ` ${text}`;
    tip.append(b, sub);
    tip.style.left = `${sx}px`;
    tip.style.top = `${sy - this.radius(n) * k.k}px`;
    tip.style.opacity = "1";
  }
  private hideTip() {
    this.tip.style.opacity = "0";
  }

  // ------------------------------------------------------------------ frame loop

  private changed(force = false) {
    const now = performance.now();
    if (force || now - this.lastChanged > 350) {
      this.lastChanged = now;
      this.cb.changed();
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden || !this.onScreen || !this.W || !this.graph) return;
    this.frameCount++;
    this.tickReplay(now);
    if (this.cam) {
      const p = clamp((now - this.cam.start) / this.cam.dur, 0, 1);
      const e = ease(p);
      const { from, to } = this.cam;
      this.setTransform({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k * Math.pow(to.k / from.k, e) });
      if (p >= 1) this.cam = null;
    }
    const animating = !this.reduce || this.drag !== null || this.dirty || this.sprites.fading;
    if (!animating) return;
    this.refreshForces();
    if (this.dirty) this.sim.alpha(Math.max(this.sim.alpha(), this.reduce ? 0 : 0.18));
    if (this.reduce) this.sim.tick(this.dirty ? 120 : 1);
    else this.sim.tick();
    this.dirty = false;
    this.draw(now);
    if (this.frameCount % 20 === 0) this.changed();
  };

  // ------------------------------------------------------------------ drawing

  private neighborsOf(n: RNode): Set<RNode> {
    const set = new Set<RNode>([n]);
    for (const t of this.threads) {
      if (!this.shown(t)) continue;
      if (t.source === n) set.add(t.target);
      if (t.target === n) set.add(t.source);
    }
    if (n.kind === "spot") {
      const c = this.byId.get(n.creatorId ?? "");
      if (c) set.add(c);
    }
    return set;
  }

  private draw(now: number) {
    const ctx = this.ctx;
    const T = this.tokens;
    const tr = zoomTransform(this.canvas);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = T.stage!;
    ctx.fillRect(0, 0, this.W, this.H);
    // cutting-mat dot grid
    let gs = 26 * tr.k;
    while (gs < 13) gs *= 2;
    ctx.fillStyle = T.ink!;
    ctx.globalAlpha = 0.09;
    for (let x = tr.x % gs; x < this.W; x += gs) for (let y = tr.y % gs; y < this.H; y += gs) ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(tr.x, tr.y);
    ctx.scale(tr.k, tr.k);
    const sel = this.selectedId ? this.byId.get(this.selectedId) ?? null : null;
    const focus = this.hovered ?? sel;
    const nb = focus ? this.neighborsOf(focus) : null;

    for (const t of this.threads) if (this.shown(t)) this.drawThread(t, now, focus);
    this.drawSnaps(now);
    this.drawRipples(now);

    // The viewer's halo.
    const me = this.viewerNode;
    if (me?.visible) {
      const p = this.reduce ? 0 : (now % 1800) / 1800;
      const r0 = this.radius(me) + 7;
      ctx.fillStyle = T.accent!;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(me.x, me.y, r0 + 3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = T.accent!;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9 * (1 - p);
      ctx.beginPath();
      ctx.arc(me.x, me.y, r0 + p * 22, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const vis = this.nodes.filter((n) => n.visible).sort((a, b) => (ORDER[a.kind] ?? 0) - (ORDER[b.kind] ?? 0));
    const view = { x0: -tr.x / tr.k - 80, y0: -tr.y / tr.k - 80, x1: (this.W - tr.x) / tr.k + 80, y1: (this.H - tr.y) / tr.k + 80 };
    for (const n of vis) {
      if (n.x < view.x0 || n.x > view.x1 || n.y < view.y0 || n.y > view.y1) continue;
      const p = clamp((now - n.born) / 560, 0, 1);
      if (now < n.born) continue;
      let s = p >= 1 ? 1 : 1 + 0.45 * Math.exp(-5 * p) * Math.cos(9 * p);
      const bp = (now - n.bump) / 450;
      if (bp >= 0 && bp < 1) s *= 1 + 0.14 * Math.sin(Math.PI * bp);
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 3) * (nb && !nb.has(n) ? 0.15 : 1);
      ctx.translate(n.x, n.y);
      ctx.scale(s, s);
      if (n === sel) {
        ctx.strokeStyle = T["accent-text"]!;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius(n) + (n.kind === "event" ? 14 : 7), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      this.drawNode(n, tr.k);
      ctx.restore();
    }

    // USDC in (orange), refunds back (muted).
    this.fx.particles = this.fx.particles.filter((pt) => {
      const p = (now - pt.born) / pt.dur;
      if (p >= 1) {
        pt.done?.();
        return false;
      }
      const c = this.ctrl(pt.a, pt.b, pt.refund ? -(BEND.leads ?? 0) : (BEND.leads ?? 0));
      for (let i = 4; i >= 0; i--) {
        const q = this.qpt(pt.a, c, pt.b, clamp(ease(p) - i * 0.025, 0, 1));
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = (1 - i / 5) * 0.95;
        ctx.beginPath();
        ctx.arc(q[0], q[1], (pt.refund ? 2.6 : 3.6) * (1 - i / 7), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    });
    this.drawStamps(now);

    // Labels: always for the hub, creators when zoomed in a little, everything for the focused node's neighbors.
    for (const n of vis) {
      const show = n.kind === "event" || (nb ? nb.has(n) : (n.kind === "creator" && tr.k > 0.5) || ((n.kind === "brand" || n.kind === "holder") && tr.k > 0.75) || n === me || tr.k > 1.4);
      if (!show || now < n.born) continue;
      ctx.globalAlpha = Math.min(1, clamp((now - n.born) / 560, 0, 1) * 3);
      this.drawLabel(n, tr.k, n === me);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private ctrl(a: RNode, b: RNode, bend: number): [number, number] {
    return [(a.x + b.x) / 2 - (b.y - a.y) * bend, (a.y + b.y) / 2 + (b.x - a.x) * bend];
  }
  private qpt(a: RNode, c: [number, number], b: RNode, t: number): [number, number] {
    const u = 1 - t;
    return [u * u * a.x + 2 * u * t * c[0] + t * t * b.x, u * u * a.y + 2 * u * t * c[1] + t * t * b.y];
  }
  private curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0, upto = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const c = this.ctrl(a as RNode, b as RNode, bend);
    if (upto >= 1) {
      if (bend) ctx.quadraticCurveTo(c[0], c[1], b.x, b.y);
      else ctx.lineTo(b.x, b.y);
    } else {
      for (let i = 1; i <= 18; i++) {
        const p = this.qpt(a as RNode, c, b as RNode, (upto * i) / 18);
        ctx.lineTo(p[0], p[1]);
      }
    }
    ctx.stroke();
  }

  private drawThread(th: RThread, now: number, focus: RNode | null) {
    const ctx = this.ctx;
    const T = this.tokens;
    const a = th.source;
    const b = th.target;
    const hot = !!focus && (a === focus || b === focus || (focus.kind === "spot" && th.kind === "has" && b === focus));
    const dim = focus && !hot ? 0.07 : 1;
    const pr = clamp((now - th.born) / 650, 0, 1);
    if (now < th.born) return;
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    switch (th.kind) {
      case "lists":
        ctx.strokeStyle = T.ink!; ctx.globalAlpha = 0.12 * dim; ctx.lineWidth = 1; this.curve(a, b, 0, pr);
        break;
      case "has":
        ctx.strokeStyle = T.ink!; ctx.globalAlpha = 0.45 * dim; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2.5]); this.curve(a, b, 0, pr);
        break;
      case "outbid":
        ctx.strokeStyle = T.ink!; ctx.globalAlpha = 0.16 * dim; ctx.lineWidth = 1; ctx.setLineDash([1, 4]); this.curve(a, b, BEND.outbid, pr);
        break;
      case "holds":
        ctx.strokeStyle = T.green!; ctx.globalAlpha = 0.8 * dim; ctx.lineWidth = 1.6; this.curve(a, b, BEND.holds, pr);
        break;
      case "leads": {
        ctx.strokeStyle = hot ? T["accent-text"]! : T.ink!;
        ctx.globalAlpha = (hot ? 0.95 : 0.55) * dim;
        ctx.lineWidth = 1 + Math.min(3, th.amount / 160);
        this.curve(a, b, BEND.leads, pr);
        if (this.layers.flow && !this.reduce && pr >= 1 && !b.sold) {
          const c = this.ctrl(a, b, BEND.leads ?? 0);
          ctx.fillStyle = T.accent!;
          ctx.globalAlpha = 0.9 * dim;
          for (let i = 0; i < 2; i++) {
            const p = this.qpt(a, c, b, (now / 1700 + i / 2 + a.phase) % 1);
            ctx.beginPath();
            ctx.arc(p[0], p[1], 2.1, 0, TAU);
            ctx.fill();
          }
        }
        break;
      }
      case "spotted": {
        ctx.strokeStyle = T["accent-text"]!; ctx.globalAlpha = 0.85 * dim; ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = this.reduce ? 0 : -now / 45;
        this.curve(a, b, BEND.spotted, pr);
        ctx.setLineDash([]);
        if (pr >= 1) {
          const m = this.qpt(a, this.ctrl(a, b, BEND.spotted ?? 0), b, 0.5);
          ctx.globalAlpha = dim; ctx.fillStyle = T.card!; ctx.strokeStyle = T["accent-text"]!; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(m[0], m[1], 6.5, 0, TAU); ctx.fill(); ctx.stroke();
          this.glyph("camera", m[0], m[1], 8, T["accent-text"]!, 2.4);
        }
        break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  private drawSnaps(now: number) {
    const ctx = this.ctx;
    this.fx.snaps = this.fx.snaps.filter((s) => now - s.born < 650);
    for (const s of this.fx.snaps) {
      const p = ease((now - s.born) / 650);
      const mx = (s.a.x + s.b.x) / 2;
      const my = (s.a.y + s.b.y) / 2;
      ctx.strokeStyle = this.tokens["accent-text"]!; ctx.lineWidth = 2; ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.a.x + (mx - s.a.x) * (1 - p) - 6 * p, s.a.y + (my - s.a.y) * (1 - p) + 8 * p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.b.x, s.b.y); ctx.lineTo(s.b.x + (mx - s.b.x) * (1 - p) + 6 * p, s.b.y + (my - s.b.y) * (1 - p) - 8 * p); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  private drawRipples(now: number) {
    const ctx = this.ctx;
    this.fx.ripples = this.fx.ripples.filter((r) => now - r.born < 1100);
    for (const r of this.fx.ripples) {
      const p = (now - r.born) / 1100;
      ctx.strokeStyle = r.color; ctx.lineWidth = 2.5 * (1 - p); ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.arc(r.node.x, r.node.y, this.radius(r.node) * (1 + p * 2.2), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  private drawStamps(now: number) {
    const ctx = this.ctx;
    this.fx.stamps = this.fx.stamps.filter((s) => now - s.born < 2200);
    for (const st of this.fx.stamps) {
      const t = now - st.born;
      const p = clamp(t / 380, 0, 1);
      const sc = 2.4 - 1.4 * ease(p);
      ctx.save();
      ctx.translate(st.node.x, st.node.y - 4);
      ctx.rotate((-30 + 18 * ease(p)) * (Math.PI / 180));
      ctx.scale(sc, sc);
      ctx.globalAlpha = t > 1700 ? 1 - (t - 1700) / 500 : 1;
      ctx.font = `800 13px ${this.display}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 2; ctx.strokeStyle = this.tokens["accent-text"]!; ctx.fillStyle = this.tokens.card!;
      ctx.beginPath(); ctx.roundRect(-22, -10, 44, 20, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.tokens["accent-text"]!;
      ctx.fillText("SOLD", 0, 1);
      ctx.restore();
    }
  }

  private glyph(name: "camera" | "shirt" | "users" | "car" | "check", x: number, y: number, size: number, color: string, lw = 2) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke(GLYPH[name]);
    ctx.restore();
  }

  /** Hard offset shadow under a shape: the sticker look. */
  private sticker(shape: () => void, off = 3) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(off, off);
    ctx.fillStyle = this.tokens.shadow!;
    shape();
    ctx.fill();
    ctx.restore();
  }

  private drawNode(n: RNode, k: number) {
    const ctx = this.ctx;
    const T = this.tokens;
    const r = this.radius(n);
    const font = (px: number) => `800 ${px}px ${this.display}`;

    if (n.kind === "event") {
      const s = r * 2;
      const box = () => { ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 18); };
      ctx.rotate(-0.1);
      this.sticker(box, 5);
      ctx.fillStyle = T.accent!; box(); ctx.fill();
      const img = this.sprites.get(n.image, 192, "cover");
      if (img) {
        ctx.save(); ctx.beginPath(); ctx.roundRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6, 15); ctx.clip();
        ctx.globalAlpha *= img.alpha; ctx.drawImage(img.c, -s / 2 + 3, -s / 2 + 3, s - 6, s - 6); ctx.restore();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = T.ink!; box(); ctx.stroke();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.8; ctx.globalAlpha *= 0.9;
      ctx.beginPath(); ctx.roundRect(-s / 2 + 7, -s / 2 + 7, s - 14, s - 14, 12); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha /= 0.9;
      if (!img) {
        ctx.fillStyle = "#fff"; ctx.font = font(48); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("p", 0, -3);
      } else {
        // the Patched mark rides on the corner like a sewn-on tag
        ctx.save(); ctx.translate(s / 2 - 8, s / 2 - 8); ctx.rotate(0.14);
        const tag = () => { ctx.beginPath(); ctx.roundRect(-14, -14, 28, 28, 8); };
        this.sticker(tag, 2); ctx.fillStyle = T.accent!; tag(); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.ink!; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = font(20); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("p", 0, -1);
        ctx.restore();
      }
      return;
    }

    if (n.kind === "spot") {
      ctx.rotate(n.rot);
      const s = r * 2;
      // A won spot is a real NFT: show its card once the camera is close enough to make it out.
      const nft = n.tokenId && k > 1.1 ? this.sprites.get(`/patch/${n.tokenId}/card.png`, 160, "cover") : null;
      if (nft) {
        const big = s * 2.3;
        const box = () => { ctx.beginPath(); ctx.roundRect(-big / 2, -big / 2, big, big, 7); };
        this.sticker(box, 2.5);
        ctx.fillStyle = T.card!; box(); ctx.fill();
        ctx.save(); box(); ctx.clip(); ctx.globalAlpha *= nft.alpha; ctx.drawImage(nft.c, -big / 2, -big / 2, big, big); ctx.restore();
        ctx.lineWidth = 1.6; ctx.strokeStyle = T.ink!; box(); ctx.stroke();
        return;
      }
      const box = () => { ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 4); };
      if (n.leader) {
        this.sticker(box, 2);
        ctx.fillStyle = T[PASTEL[n.color % 5]!]!; box(); ctx.fill();
        const logo = this.sprites.get(n.leader.image, 64, "contain");
        if (logo && k > 0.7) {
          ctx.save(); ctx.globalAlpha *= logo.alpha; const q = s - 5; ctx.drawImage(logo.c, -q / 2, -q / 2, q, q); ctx.restore();
        }
        ctx.strokeStyle = n.sold ? T["accent-text"]! : T.ink!; ctx.lineWidth = 1.5; box(); ctx.stroke();
        if (!logo) {
          ctx.setLineDash([2, 2]); ctx.globalAlpha *= 0.55; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(-s / 2 + 3, -s / 2 + 3, s - 6, s - 6, 2); ctx.stroke(); ctx.setLineDash([]);
        }
      } else {
        ctx.fillStyle = T["accent-soft"]!; box(); ctx.fill();
        ctx.setLineDash([3, 2]); ctx.strokeStyle = T["accent-text"]!; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      }
      return;
    }

    if (n.kind === "brand" || n.kind === "holder") {
      const s = r * 2;
      const box = () => { ctx.beginPath(); ctx.roundRect(-s / 2, -s / 2, s, s, 9); };
      this.sticker(box);
      ctx.fillStyle = T.card!; box(); ctx.fill();
      const img = this.sprites.get(n.image, 96, "contain");
      if (img) {
        ctx.save(); ctx.globalAlpha *= img.alpha; const q = s - 8; ctx.drawImage(img.c, -q / 2, -q / 2, q, q); ctx.restore();
      } else {
        ctx.fillStyle = T[PASTEL[n.color % 5]!]!; ctx.beginPath(); ctx.roundRect(-s / 2 + 4, -s / 2 + 4, s - 8, s - 8, 6); ctx.fill();
        ctx.fillStyle = "#0B0B0C"; ctx.font = font(r * 0.78); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(initials(n.label), 0, 1);
      }
      ctx.lineWidth = 2; ctx.strokeStyle = T.ink!; box(); ctx.stroke();
      if (n.verified) {
        ctx.fillStyle = T.green!; ctx.beginPath(); ctx.arc(s / 2 - 1, -s / 2 + 1, 6, 0, TAU); ctx.fill();
        this.glyph("check", s / 2 - 1, -s / 2 + 1, 8, "#fff", 4);
      }
      return;
    }

    // creators and spotters wear their face
    const circ = () => { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); };
    this.sticker(circ);
    ctx.fillStyle = T[PASTEL[n.color % 5]!]!; circ(); ctx.fill();
    const face = this.sprites.get(n.image, 96, "cover");
    if (face) {
      ctx.save(); circ(); ctx.clip(); ctx.globalAlpha *= face.alpha; ctx.drawImage(face.c, -r, -r, r * 2, r * 2); ctx.restore();
    } else {
      ctx.fillStyle = "#0B0B0C"; ctx.font = font(r * 0.78); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(initials(n.name), 0, 1);
    }
    ctx.lineWidth = n.kind === "spotter" ? 1.5 : 2; ctx.strokeStyle = T.ink!; circ(); ctx.stroke();
    if (n.kind === "creator") {
      const bx = r * 0.72;
      ctx.fillStyle = T.card!; ctx.beginPath(); ctx.arc(bx, bx, 8, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.ink!; ctx.stroke();
      this.glyph(n.surface === "hoodie" ? "users" : n.surface === "car" ? "car" : "shirt", bx, bx, 10, T.ink!, 2.2);
    }
  }

  private drawLabel(n: RNode, k: number, me: boolean) {
    const ctx = this.ctx;
    const T = this.tokens;
    const hub = n.kind === "event";
    ctx.font = hub ? `800 ${15 / k}px ${this.display}` : `600 ${11 / k}px ${this.sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    let text = n.label;
    if (n.kind === "spot") text = n.leader ? `${n.label} ${usd(n.amount)}` : `${n.label} OPEN`;
    if (text.length > 22) text = `${text.slice(0, 21)}…`;
    const y = n.y + (hub ? this.radius(n) + 8 : this.radius(n) + 5 / k);
    ctx.lineWidth = 3 / k;
    ctx.strokeStyle = T.stage!;
    ctx.lineJoin = "round";
    ctx.strokeText(text, n.x, y);
    ctx.fillStyle = me ? T["accent-text"]! : T.ink!;
    ctx.fillText(text, n.x, y);
  }
}

// lucide paths, drawn on the canvas
const GLYPH = {
  shirt: new Path2D("M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"),
  users: new Path2D("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"),
  camera: new Path2D("M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0"),
  car: new Path2D("M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0M14 17h1M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0"),
  check: new Path2D("M20 6 9 17l-5-5"),
};
