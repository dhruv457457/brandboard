import {
  FIXTURE_ADMIN_QUEUE,
  FIXTURE_BRAND_DASHBOARD,
  FIXTURE_EVENTS,
  FIXTURE_LISTINGS,
  FIXTURE_PROFILES,
} from "./fixtures";
import {
  AdminQueueData,
  BidRecord,
  BrandDashboardData,
  EventRecord,
  ListingRecord,
  PatchRecord,
  ProfileRecord,
  SurfaceType,
} from "./types";
import { createPublicClient, http, fromHex } from "viem";
import { patchedMarketAbi, DEPLOYMENTS } from "@patched/shared";

export * from "./types";
export * from "./fixtures";

// Mutable in-memory store for mock mode
let inMemoryListings = [...FIXTURE_LISTINGS];
const inMemoryProfiles = { ...FIXTURE_PROFILES };
let inMemoryBrandDashboard = { ...FIXTURE_BRAND_DASHBOARD };
let inMemoryAdminQueue = { ...FIXTURE_ADMIN_QUEUE };

async function fetchOnchainListing(listingIdNum: bigint): Promise<ListingRecord | null> {
  try {
    const deployment = DEPLOYMENTS[10143];
    if (!deployment) return null;

    const client = createPublicClient({
      transport: http("https://testnet-rpc.monad.xyz", { timeout: 3500 }),
    });

    const onchain = await client.readContract({
      address: deployment.market,
      abi: patchedMarketAbi,
      functionName: "getListing",
      args: [listingIdNum],
    });

    if (!onchain || !onchain.creator || onchain.creator === "0x0000000000000000000000000000000000000000") {
      return null;
    }

    const patchesData = await client.readContract({
      address: deployment.market,
      abi: patchedMarketAbi,
      functionName: "getPatches",
      args: [listingIdNum],
    });

    const parsedPatches: PatchRecord[] = patchesData.map((p, idx) => {
      let label = `Patch ${idx + 1}`;
      try {
        label = fromHex(p.label, "string").replace(/\0/g, "").trim() || label;
      } catch {
        // fallback
      }

      const defaultPositions = [
        { x: 38, y: 24.5, w: 24, h: 7, r: -2 },
        { x: 39, y: 37.6, w: 22, h: 4.6, r: 1.5 },
        { x: 36, y: 44, w: 13, h: 8, r: -3 },
      ];
      const pos = defaultPositions[idx] || { x: 30 + idx * 10, y: 30 + idx * 10, w: 20, h: 8 };

      const hasBid = p.topBid > 0n;
      const brand = hasBid ? (p.topBidder.toLowerCase().startsWith("0xc6ff") ? "Nodeflux" : "Top Bidder") : null;

      return {
        id: String(idx),
        listingId: String(listingIdNum),
        name: label,
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        r: pos.r,
        floor: p.floor,
        buyNow: p.buyNow,
        topBid: p.topBid,
        topBidder: hasBid ? p.topBidder : undefined,
        brand,
        c: hasBid ? "p2" : undefined,
        bought: p.bought,
        locked: p.bought,
        history: hasBid
          ? [
              {
                id: `onchain-tx-${idx}`,
                listingId: String(listingIdNum),
                patchId: String(idx),
                patchLabel: label,
                bidder: p.topBidder,
                brandName: brand || "Brand",
                amount: p.topBid,
                timestamp: Number(p.lastBidAt) * 1000 || Date.now() - 3600000,
              },
            ]
          : [],
      };
    });

    const surfaceMap = ["outfit", "car", "hoodie"] as const;
    const surfaceName = surfaceMap[onchain.surface] || "outfit";

    return {
      id: String(listingIdNum),
      creator: onchain.creator,
      creatorHandle: "monad.creator",
      creatorName: "Monad Creator",
      creatorAvatar: "M",
      creatorVerified: true,
      creatorDeliveries: "1 on-chain",
      title: `On-chain ${surfaceName.toUpperCase()} · Monad #${listingIdNum}`,
      surface: surfaceName,
      surfaceEnum: onchain.surface,
      eventId: Number(onchain.eventId),
      eventSlug: "token2049-singapore",
      eventName: "Token2049 Singapore",
      status: onchain.status,
      biddingEndsAt: Number(onchain.biddingEndsAt) * 1000 || Date.now() + 86400000 * 3,
      hardEndsAt: Number(onchain.hardEndsAt) * 1000 || Date.now() + 86400000 * 4,
      bond: onchain.bond,
      totalEscrow: onchain.totalEscrow || parsedPatches.reduce((acc, p) => acc + (p.topBid || 0n), 0n),
      bannerColor: "#836EF9",
      createdAt: Date.now() - 3600000,
      milestones: [
        {
          index: 0,
          name: "Print proof",
          bps: 4000,
          status: 0,
          reviewEndsAt: Date.now() + 86400000 * 5,
        },
        {
          index: 1,
          name: "Venue proof",
          bps: 6000,
          status: 0,
          reviewEndsAt: Date.now() + 86400000 * 10,
        },
      ],
      patches: parsedPatches,
    };
  } catch {
    return null;
  }
}

export async function getListings(
  filter?: SurfaceType | "all"
): Promise<ListingRecord[]> {
  if (!filter || filter === "all") {
    return inMemoryListings;
  }
  return inMemoryListings.filter((l) => l.surface === filter);
}

export async function getListing(id: string): Promise<ListingRecord | null> {
  const isNumeric = /^\d+$/.test(id);
  if (isNumeric || process.env.NEXT_PUBLIC_DATA_MODE === "live") {
    const numericId = isNumeric ? BigInt(id) : 1n;
    const onchain = await fetchOnchainListing(numericId);
    if (onchain) return onchain;
  }

  const found = inMemoryListings.find((l) => l.id === id || l.creatorHandle === id);
  return found || null;
}

export async function getPatches(listingId: string): Promise<PatchRecord[]> {
  const listing = await getListing(listingId);
  return listing ? listing.patches : [];
}

export async function getBids(listingId: string): Promise<BidRecord[]> {
  const listing = await getListing(listingId);
  if (!listing) return [];
  const allBids = listing.patches.flatMap((p) => p.history || []);
  return allBids.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getProfile(handle: string): Promise<ProfileRecord | null> {
  const cleanHandle = handle.replace(/^@/, "");
  const profile = inMemoryProfiles[cleanHandle];
  if (profile) return profile;

  // Fallback if not found: find by listing
  const listing = inMemoryListings.find((l) => l.creatorHandle === cleanHandle);
  if (listing) {
    return {
      handle: listing.creatorHandle,
      displayName: listing.creatorName,
      wallet: listing.creator,
      avatarInitial: listing.creatorAvatar || listing.creatorName[0],
      deliveries: 1,
      totalDeliveries: 1,
      earnedUsdc: listing.totalEscrow,
      badges: ["Creator"],
      listings: [listing],
    };
  }
  return null;
}

export async function getEvents(): Promise<EventRecord[]> {
  return FIXTURE_EVENTS;
}

export async function getBrandDashboard(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _walletOrBrand?: string
): Promise<BrandDashboardData> {
  return inMemoryBrandDashboard;
}

export async function getAdminQueue(): Promise<AdminQueueData> {
  return inMemoryAdminQueue;
}

// Helper methods to mutate mock store from chain hooks & simulations
export function mutateMockListing(
  listingId: string,
  updater: (prev: ListingRecord) => ListingRecord
) {
  inMemoryListings = inMemoryListings.map((l) => {
    if (l.id === listingId) {
      return updater(l);
    }
    return l;
  });
}

export function addMockListing(listing: ListingRecord) {
  inMemoryListings = [listing, ...inMemoryListings];
}

export function updateMockBrandDashboard(
  updater: (prev: BrandDashboardData) => BrandDashboardData
) {
  inMemoryBrandDashboard = updater(inMemoryBrandDashboard);
}

export function updateMockAdminQueue(
  updater: (prev: AdminQueueData) => AdminQueueData
) {
  inMemoryAdminQueue = updater(inMemoryAdminQueue);
}
