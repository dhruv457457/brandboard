import type { BidEvent } from "./types";

const WINDOW_MS = 15 * 60_000;

export interface SpotHeat {
  /** Bids on this spot in the last 15 minutes. */
  recent: number;
  /** Different wallets among those bids. */
  bidders: number;
  /** Two or more brands trading the lead: 3+ recent bids from 2+ wallets. */
  war: boolean;
}

/** How contested a spot is right now, from the bids the page already has. */
export function spotHeat(bids: BidEvent[], patchId: number, now = Date.now()): SpotHeat {
  const recent = bids.filter((b) => b.patchId === patchId && now - b.time < WINDOW_MS);
  const bidders = new Set(recent.map((b) => b.bidder)).size;
  return { recent: recent.length, bidders, war: recent.length >= 3 && bidders >= 2 };
}
