import type { EventGraph, GNode } from "./types";

/** Where one wallet sits in an event's graph: the numbers behind "You in Token2049" and the share image. */
export interface Standing {
  me: GNode;
  /** Threads touching this wallet (bids led, outbid, spots posted, team, receipts held, spots listed). */
  degree: number;
  /** 1 = the most connected wallet in the event. */
  rank: number;
  people: number;
  /** USDC the wallet leads with, plus (for a creator) what is escrowed on their listings. */
  locked: number;
  spotted: number;
  spotsLed: number;
  /** The wallets and creators it is tied to, strongest tie first, for drawing its corner of the graph. */
  neighbors: { node: GNode; tie: "bid" | "spot" | "team" | "list" }[];
}

/**
 * Works out the same counts the live graph shows, from a snapshot: who leads each spot after replaying every bid in
 * order, who was outbid, then threads per wallet. Pure, so the server (share image) and tests can use it.
 */
export function standing(g: EventGraph, wallet: string): Standing | null {
  const me = g.nodes.find((n) => n.id === `w:${wallet.toLowerCase()}`);
  if (!me) return null;
  const byId = new Map(g.nodes.map((n) => [n.id, n]));

  // Replay the bids: current leader per spot, and everyone who led and then lost.
  const lead = new Map<string, { who: string; amount: number }>();
  const outbid = new Map<string, Set<string>>();
  for (const b of g.bids) {
    const prev = lead.get(b.spot);
    if (prev && prev.who !== b.who) {
      if (!outbid.has(b.spot)) outbid.set(b.spot, new Set());
      outbid.get(b.spot)!.add(prev.who);
    }
    outbid.get(b.spot)?.delete(b.who);
    lead.set(b.spot, { who: b.who, amount: b.amount });
  }

  const edges: { a: string; b: string; tie: Standing["neighbors"][number]["tie"] }[] = [];
  for (const t of g.threads) {
    if (t.kind === "lists") continue;
    edges.push({ a: t.source, b: t.target, tie: t.kind === "spotted" ? "spot" : t.kind === "team" ? "team" : t.kind === "has" ? "list" : "bid" });
  }
  const total = new Map<string, number>();
  for (const [spot, l] of lead) {
    edges.push({ a: l.who, b: spot, tie: "bid" });
    total.set(l.who, (total.get(l.who) ?? 0) + l.amount);
    const owner = byId.get(spot)?.creatorId;
    if (owner) total.set(owner, (total.get(owner) ?? 0) + l.amount);
  }
  for (const [spot, who] of outbid) for (const w of who) edges.push({ a: w, b: spot, tie: "bid" });

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const people = g.nodes.filter((n) => n.kind !== "spot" && n.kind !== "event");
  const ranked = [...people].sort((x, y) => (degree.get(y.id) ?? 0) - (degree.get(x.id) ?? 0));

  // Neighbours: the other end of each of my threads; a spot stands for its creator.
  const seen = new Set<string>([me.id]);
  const neighbors: Standing["neighbors"] = [];
  for (const e of edges) {
    // A creator is also tied to everyone who bids on their spots, though those threads end on the spot.
    const ownerOfSpot = byId.get(e.b)?.kind === "spot" ? byId.get(e.b)?.creatorId : undefined;
    const viaSpot = ownerOfSpot === me.id && e.a !== me.id;
    if (e.a !== me.id && e.b !== me.id && !viaSpot) continue;
    let other = byId.get(viaSpot || e.b === me.id ? e.a : e.b);
    if (other?.kind === "spot") other = byId.get(other.creatorId ?? "");
    if (!other || seen.has(other.id)) continue;
    seen.add(other.id);
    neighbors.push({ node: other, tie: e.tie });
  }
  // A brand's bids reach the creators whose spots it leads, even though the thread ends on the spot.
  const strength = { spot: 0, team: 1, bid: 2, list: 3 } as const;
  neighbors.sort((x, y) => strength[x.tie] - strength[y.tie]);

  return {
    me,
    degree: degree.get(me.id) ?? 0,
    rank: ranked.findIndex((n) => n.id === me.id) + 1,
    people: people.length,
    locked: total.get(me.id) ?? 0,
    spotted: g.threads.filter((t) => t.kind === "spotted" && t.source === me.id).length,
    spotsLed: [...lead.values()].filter((l) => l.who === me.id).length,
    neighbors,
  };
}
