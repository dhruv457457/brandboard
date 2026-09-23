// Mirrors the Solidity enums and structs in contracts/src/PatchedMarket.sol (see docs/contracts.md).

export enum Surface {
  Outfit = 0,
  Car = 1,
  Hoodie = 2,
}

export enum ListingStatus {
  Pending = 0,
  Active = 1,
  Delivering = 2,
  Completed = 3,
  Failed = 4,
  Cancelled = 5,
  Rejected = 6,
  Unsold = 7,
}

export enum MilestoneStatus {
  Open = 0,
  Submitted = 1,
  Released = 2,
}

export type Address = `0x${string}`;

export interface OnchainListing {
  creator: Address;
  biddingEndsAt: number;
  hardEndsAt: number;
  status: ListingStatus;
  surface: Surface;
  eventId: number;
  patchCount: number;
  milestoneCount: number;
  nextMilestone: number;
  soldMask: number;
  bond: bigint;
  totalEscrow: bigint;
  milestoneBps: number[];
  deadlines: number[];
  metadataHash: `0x${string}`;
}

export interface OnchainPatch {
  topBidder: Address;
  topBid: bigint;
  floor: bigint;
  buyNow: bigint;
  lastBidAt: number;
  bought: boolean;
  label: string;
}

/** Off-chain JSON stored at metadataURI (docs/data-model.md). */
export interface ListingMetadata {
  version: 1;
  title: string;
  surface: "outfit" | "car" | "hoodie";
  eventSlug?: string;
  sourceImage?: string;
  canvasImage?: string;
  patches: { id: number; name: string; x: number; y: number; w: number; h: number; rotation?: number }[];
  milestones: { name: string; bps: number }[];
}

/** Friendly messages for the contract's custom errors. */
export const CONTRACT_ERRORS: Record<string, string> = {
  NotActive: "This listing is not taking bids right now.",
  BiddingOver: "Bidding has ended for this listing.",
  BiddingNotOver: "Bidding is still open.",
  BadPatch: "That patch does not exist.",
  AlreadyBought: "Someone already bought this patch.",
  BidTooLow: "Someone bid higher a moment ago. Raise your bid and try again.",
  CreatorCannotBid: "You can't bid on your own listing.",
  NotCreator: "Only the creator can do this.",
  NotHolder: "Only the holder of this patch can do this.",
  WrongMilestone: "That milestone isn't the current one.",
  DeadlinePassed: "The deadline for this step has passed.",
  DeadlineNotPassed: "The deadline hasn't passed yet.",
  ReviewNotOver: "The 72-hour review window is still open.",
  ReviewOver: "The review window has closed.",
  AlreadyDisputed: "This patch is already disputed for this milestone.",
  NotDisputed: "There is no dispute to resolve here.",
  InvalidParams: "Some listing details are invalid. Check prices, milestones and deadlines.",
  OverNewCreatorCap: "New creators can list up to $1,000 in buy-now prices until their first delivery.",
  EventInactive: "This event isn't accepting listings.",
  NotForSale: "This patch isn't for sale.",
  PriceAboveMax: "The resale price changed. Check it and try again.",
  NothingToWithdraw: "You have nothing to withdraw.",
};
