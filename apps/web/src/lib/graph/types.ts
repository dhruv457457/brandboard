// Patchwork: one event as a graph. Wallets are nodes (a wallet that creates and also bids is ONE node with two roles),
// every thread comes from an indexed chain event. Amounts are whole USDC numbers: this is display data only.

export type NodeKind = "event" | "creator" | "spot" | "brand" | "holder" | "spotter";
export type NodeRole = "creator" | "brand" | "holder" | "spotter";
export type SurfaceName = "outfit" | "car" | "hoodie";

export interface GNode {
  id: string;
  kind: NodeKind;
  /** Everything this wallet does in the event; `kind` is the main one. */
  roles: NodeRole[];
  label: string;
  /** Full name for tooltips and the panel. */
  name: string;
  /** Profile picture, brand logo or (for the hub) the event banner. */
  image: string | null;
  /** Second picture for a brand node that is also a person: its logo. */
  logo: string | null;
  wallet: string | null;
  href: string | null;
  /** 0..1 along the event's timeline when this first showed up (drives Replay). */
  t: number;
  /** 0..4, an index into the pastel palette. */
  color: number;
  verified?: boolean;
  // creators
  surface?: SurfaceName;
  // spots
  creatorId?: string;
  listingId?: number;
  patchId?: number;
  floor?: number;
  buyNow?: number;
  /** Receipt token (listingId << 8 | patchId) once the patch is won: its NFT card is /patch/<tokenId>/card.png. */
  tokenId?: string;
  /** The listing is closed for bidding and this spot was won. */
  won?: boolean;
}

export type ThreadKind = "lists" | "has" | "leads" | "outbid" | "spotted" | "holds";

export interface GThread {
  id: string;
  kind: ThreadKind;
  source: string;
  target: string;
  t: number;
  amount?: number;
  tx?: string | null;
  /** spotted: the photo. */
  photo?: string | null;
}

/** One bid in block order. Replay and the live state are both built from these. */
export interface GBid {
  id: string;
  spot: string;
  who: string;
  amount: number;
  t: number;
  buyNow: boolean;
  tx: string;
}

export interface GraphEvent {
  id: number;
  slug: string | null;
  name: string;
  banner: string | null;
  city: string | null;
  startsAt: number | null;
  endsAt: number | null;
}

export interface EventGraph {
  chainId: number;
  explorer: string;
  event: GraphEvent;
  nodes: GNode[];
  threads: GThread[];
  bids: GBid[];
  /** Wall-clock span that t = 0..1 maps to (ms). */
  t0: number;
  t1: number;
  stats: { creators: number; spots: number; brands: number; spotters: number; bids: number; escrowUsd: number };
}

export interface GraphEventRow {
  id: number;
  slug: string | null;
  name: string;
  banner: string | null;
  listings: number;
  escrowUsd: number;
}
