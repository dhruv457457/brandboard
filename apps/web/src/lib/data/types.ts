import {
  ListingStatus,
  MilestoneStatus,
  Surface,
} from "@patched/shared";

export type SurfaceType = "outfit" | "car" | "hoodie";

export interface BidRecord {
  id: string;
  listingId: string;
  patchId: string | number;
  patchLabel: string;
  bidder: string;
  brandName: string;
  amount: bigint; // 6 decimals
  prevBidder?: string;
  prevAmount?: bigint;
  isBuyNow?: boolean;
  txHash?: string;
  timestamp: number; // Unix ms
}

export interface PatchRecord {
  id: string | number;
  listingId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  floor: bigint; // 6 decimals
  buyNow: bigint; // 6 decimals
  topBid: bigint; // 6 decimals
  topBidder?: string;
  brand?: string | null;
  logo?: string | null;
  c?: "p1" | "p2" | "p3" | "p4" | "p5" | string;
  bought?: boolean;
  locked?: boolean;
  history?: BidRecord[];
}

export interface MilestoneRecord {
  index: number;
  name: string;
  bps: number; // e.g. 4000 = 40%
  status: MilestoneStatus;
  reviewEndsAt?: number;
  disputed?: boolean;
  resolved?: boolean;
  proofHash?: string;
  proofUri?: string;
  proofFiles?: string[];
  aiCheckNote?: string;
  aiCheckValid?: boolean;
}

export interface ListingRecord {
  id: string;
  creator: string; // wallet
  creatorHandle: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorVerified?: boolean;
  creatorDeliveries?: string;
  title: string;
  surface: SurfaceType;
  surfaceEnum: Surface;
  eventId?: number;
  eventSlug?: string;
  eventName?: string;
  event?: string;
  status: ListingStatus;
  biddingEndsAt: number; // Unix ms
  endTime?: number; // Unix ms
  hardEndsAt: number; // Unix ms
  bond: bigint; // 6 decimals
  totalEscrow: bigint; // 6 decimals
  patches: PatchRecord[];
  milestones: MilestoneRecord[];
  metadataUri?: string;
  metadataHash?: string;
  bannerColor?: string;
  createdAt: number;
}

export interface ProfileRecord {
  handle: string;
  displayName: string;
  wallet: string;
  avatarUrl?: string;
  avatarInitial: string;
  bio?: string;
  xHandle?: string;
  xVerified?: boolean;
  bannerColor?: string;
  deliveries: number;
  totalDeliveries: number;
  earnedUsdc: bigint;
  badges: string[];
  listings: ListingRecord[];
  posts?: {
    id: string;
    text: string;
    imagePlaceholder?: string;
    timestamp: number;
    likes: number;
    replies: number;
    tag?: string;
  }[];
}

export interface EventRecord {
  id: number;
  slug: string;
  name: string;
  city: string;
  bannerUrl?: string;
  description?: string;
  startsAt: number;
  endsAt: number;
  listingsCount: number;
  volumeUsdc: bigint;
  status: "Live" | "Draft" | "Ended" | "Always on";
}

export interface ReceiptRecord {
  tokenId: string;
  listingId: string;
  patchId: string | number;
  patchLabel: string;
  owner: string;
  brandName: string;
  creatorHandle: string;
  surface: SurfaceType;
  resalePrice?: bigint; // if listed for resale
  acquiredAt: number;
  color: string;
}

export interface BrandDashboardData {
  brandName: string;
  wallet: string;
  inEscrowUsdc: bigint;
  leadingBidsCount: number;
  wonPatchesCount: number;
  estImpressions: number;
  activeBids: {
    listingId: string;
    creatorHandle: string;
    patchId: string | number;
    patchLabel: string;
    surface: string;
    event?: string;
    yourBid: bigint;
    topBid: bigint;
    isTop: boolean;
    status: "Top bid" | "Outbid" | "Won";
  }[];
  proofsToReview: {
    listingId: string;
    creatorHandle: string;
    surfaceTitle: string;
    currentMilestone: string;
    progressPercent: number;
    reviewEndsAt: number;
    proofItems: string[];
  }[];
  receipts: ReceiptRecord[];
  autoBidRule?: {
    listingId: string;
    patchId: string | number;
    patchLabel: string;
    creatorTitle: string;
    maxBidUsdc: bigint;
    enabled: boolean;
  };
}

export interface ModerationItem {
  id: string;
  listingId: string;
  handle: string;
  surface: SurfaceType;
  title: string;
  patchesCount: number;
  flagType: "ok" | "warn";
  flagIcon: "check" | "alert";
  flagText: string;
}

export interface DisputeItem {
  id: string;
  listingId: string;
  milestoneIndex: number;
  patchId: string | number;
  patchLabel: string;
  amountUsdc: bigint;
  brandName: string;
  creatorHandle: string;
  brandStatement: string;
  creatorStatement: string;
  status: "Needs decision" | "Resolved";
}

export interface AdminQueueData {
  events: EventRecord[];
  moderationQueue: ModerationItem[];
  proofReviews: {
    id: string;
    listingId: string;
    creatorHandle: string;
    milestoneName: string;
    percent: number;
    proofItems: string[];
    flagValid: boolean;
    flagNote: string;
  }[];
  disputes: DisputeItem[];
  stats: {
    totalVolumeUsdc: bigint;
    feesUsdc: bigint;
    gasSponsoredUsdc: bigint;
    creatorsCount: number;
  };
}
