import type { ListingMetadata } from "@patched/shared";

export type SurfaceKind = "outfit" | "car" | "hoodie";
export const SURFACES: SurfaceKind[] = ["outfit", "car", "hoodie"];

export interface LivePatch {
  id: number;
  label: string;
  floor: bigint;
  buyNow: bigint;
  topBid: bigint;
  topBidder: `0x${string}` | null;
  bought: boolean;
  side: "front" | "back";
  // position on the canvas, % of the drawing box
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  // presentation (from brand_logos, if the leader uploaded one)
  brandName: string | null;
  logoUrl: string | null;
}

export interface BidEvent {
  id: string; // txHash:logIndex
  patchId: number;
  bidder: `0x${string}`;
  amount: bigint;
  prevBidder: `0x${string}` | null;
  isBuyNow: boolean;
  time: number; // unix ms
}

export interface ListingView {
  chainId: number;
  id: number;
  creator: `0x${string}`;
  creatorHandle: string | null;
  creatorName: string | null;
  creatorVerified: boolean;
  surface: SurfaceKind;
  status: number;
  eventId: number;
  eventName: string | null;
  biddingEndsAt: number; // unix ms
  hardEndsAt: number;
  bond: bigint;
  minIncrement: bigint;
  minIncrementBps: number;
  milestoneBps: number[];
  deadlines: number[];
  title: string;
  canvasImage: string | null;
  canvasImageBack: string | null;
  patches: LivePatch[];
  bids: BidEvent[];
  metadata: ListingMetadata | null;
}

/** Serializable form for passing from server components to client components (bigint → string). */
export type Wire<T> = T extends bigint
  ? string
  : T extends Array<infer U>
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export function toWire<T>(value: T): Wire<T> {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v}n` : v)));
}

export function fromWire<T>(value: Wire<T>): T {
  return JSON.parse(JSON.stringify(value), (_k, v) =>
    typeof v === "string" && /^-?\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v,
  );
}
