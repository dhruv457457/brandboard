"use client";

import { useEffect, useRef, useState } from "react";
import {
  auctionEventBus,
  BidPlacedEvent,
  OutbidEvent,
} from "./eventBus";
import { getListing, mutateMockListing } from "../data";

const BRANDS: [string, "p1" | "p2" | "p3" | "p4" | "p5"][] = [
  ["Nodeflux", "p2"],
  ["Zeta Pay", "p3"],
  ["Kappa Labs", "p1"],
  ["Orbit", "p4"],
  ["Hexa", "p5"],
];

interface UseListingLiveOptions {
  enabled?: boolean;
  onBidPlaced?: (event: BidPlacedEvent) => void;
  onOutbid?: (event: OutbidEvent) => void;
}

export function useListingLive(
  listingId: string,
  options: UseListingLiveOptions = {}
) {
  const { enabled = true, onBidPlaced, onOutbid } = options;
  const [recentBids, setRecentBids] = useState<BidPlacedEvent[]>([]);
  const [lastBid, setLastBid] = useState<BidPlacedEvent | null>(null);

  const onBidPlacedRef = useRef(onBidPlaced);
  onBidPlacedRef.current = onBidPlaced;
  const onOutbidRef = useRef(onOutbid);
  onOutbidRef.current = onOutbid;

  useEffect(() => {
    if (!enabled) return;

    // Listen for BidPlaced events for this listing
    const unsubBid = auctionEventBus.on("BidPlaced", (event) => {
      if (event.listingId !== listingId) return;
      setLastBid(event);
      setRecentBids((prev) => [event, ...prev.slice(0, 19)]);
      onBidPlacedRef.current?.(event);
    });

    const unsubOutbid = auctionEventBus.on("Outbid", (event) => {
      if (event.listingId !== listingId) return;
      onOutbidRef.current?.(event);
    });

    // Mock Simulation Loop
    let timeoutId: NodeJS.Timeout;
    const isMock = process.env.NEXT_PUBLIC_DATA_MODE !== "live";

    async function simTick() {
      if (!isMock) return;

      const listing = await getListing(listingId);
      if (!listing) return;

      const openPatches = listing.patches.filter((p) => !p.locked && !p.bought);
      if (openPatches.length === 0) return;

      // Pick a random open patch
      const patch = openPatches[Math.floor(Math.random() * openPatches.length)];
      const candidateBrands = BRANDS.filter(([b]) => b !== patch.brand);
      const [brand, color] =
        candidateBrands[Math.floor(Math.random() * candidateBrands.length)];

      const currentTop = patch.topBid && patch.topBid > 0n ? patch.topBid : patch.floor;
      const minStep = 10_000_000n; // $10 USDC min increment in simulation
      const randomIncSteps = [0n, 5_000_000n, 10_000_000n, 20_000_000n, 40_000_000n];
      const extra = randomIncSteps[Math.floor(Math.random() * randomIncSteps.length)];
      const nextAmount = currentTop + minStep + extra;

      // Anti-snipe: if less than 5 minutes remain on listing, add 5 minutes
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;
      let newBiddingEndsAt = listing.biddingEndsAt;
      if (listing.biddingEndsAt - now < fiveMinutesMs && listing.biddingEndsAt > now) {
        newBiddingEndsAt = Math.min(
          listing.biddingEndsAt + fiveMinutesMs,
          listing.hardEndsAt || listing.biddingEndsAt + fiveMinutesMs
        );
        auctionEventBus.emit("BiddingExtended", {
          listingId,
          newEndsAt: newBiddingEndsAt,
        });
      }

      // Check if user was top bidder and is now outbid
      const wasUserLeading = patch.topBidder === "user_wallet";

      // Mutate listing in memory
      mutateMockListing(listingId, (prev) => {
        const updatedPatches = prev.patches.map((p) => {
          if (p.id === patch.id) {
            return {
              ...p,
              topBid: nextAmount,
              brand,
              c: color,
              topBidder: `0x${brand.toLowerCase().replace(/\s/g, "")}`,
              history: [
                {
                  id: `bid-${Date.now()}`,
                  listingId,
                  patchId: p.id,
                  patchLabel: p.name,
                  bidder: `0x${brand.toLowerCase().replace(/\s/g, "")}`,
                  brandName: brand,
                  amount: nextAmount,
                  timestamp: Date.now(),
                },
                ...(p.history || []),
              ],
            };
          }
          return p;
        });

        const newTotalEscrow = updatedPatches.reduce(
          (sum, p) => sum + (p.topBid || 0n),
          0n
        );

        return {
          ...prev,
          biddingEndsAt: newBiddingEndsAt,
          totalEscrow: newTotalEscrow,
          patches: updatedPatches,
        };
      });

      const bidEvent: BidPlacedEvent = {
        listingId,
        patchId: patch.id,
        patchLabel: patch.name,
        bidder: `0x${brand.toLowerCase().replace(/\s/g, "")}`,
        brandName: brand,
        amount: nextAmount,
        prevBidder: patch.topBidder,
        prevAmount: patch.topBid,
        color,
        timestamp: Date.now(),
      };

      auctionEventBus.emit("BidPlaced", bidEvent);

      if (wasUserLeading) {
        auctionEventBus.emit("Outbid", {
          listingId,
          patchId: patch.id,
          patchLabel: patch.name,
          minNextBid: nextAmount + 10_000_000n,
          outbidBy: brand,
        });
      }

      // Schedule next random tick between 4.5s and 8.5s
      const delay = 4500 + Math.random() * 4000;
      timeoutId = setTimeout(simTick, delay);
    }

    // Start simulation loop after initial short delay
    timeoutId = setTimeout(simTick, 5000);

    return () => {
      unsubBid();
      unsubOutbid();
      clearTimeout(timeoutId);
    };
  }, [listingId, enabled]);

  return {
    recentBids,
    lastBid,
    isLive: true,
  };
}
