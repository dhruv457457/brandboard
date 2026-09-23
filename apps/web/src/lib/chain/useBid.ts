"use client";

import { useState } from "react";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { mutateMockListing } from "../data";
import { auctionEventBus } from "../live/eventBus";

export interface BidArgs {
  listingId: string;
  patchId: string | number;
  amount: bigint; // 6 decimals
  brandName: string;
  logoUrl?: string | null;
  color?: "p1" | "p2" | "p3" | "p4" | "p5" | string;
}

export function useBid(): ChainHookResult<BidArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({
    listingId,
    patchId,
    amount,
    brandName,
    logoUrl,
    color = "p5",
  }: BidArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      // Simulate wallet signature delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      setStatus("confirming");
      // Simulate on-chain confirmation delay
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Mock update
      let patchName = "Patch";
      let prevBidder: string | undefined;
      let prevAmount: bigint | undefined;
      let isBought = false;

      mutateMockListing(listingId, (prev) => {
        const patch = prev.patches.find((p) => p.id === patchId);
        if (patch) {
          patchName = patch.name;
          prevBidder = patch.topBidder;
          prevAmount = patch.topBid;
          if (amount >= patch.buyNow) {
            isBought = true;
          }
        }

        const updatedPatches = prev.patches.map((p) => {
          if (p.id === patchId) {
            return {
              ...p,
              topBid: amount,
              brand: brandName,
              logo: logoUrl || null,
              c: color,
              topBidder: "user_wallet",
              bought: isBought || p.bought,
              locked: isBought || p.locked,
              history: [
                {
                  id: `bid-${Date.now()}`,
                  listingId,
                  patchId: p.id,
                  patchLabel: p.name,
                  bidder: "user_wallet",
                  brandName,
                  amount,
                  isBuyNow: isBought,
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
          totalEscrow: newTotalEscrow,
          patches: updatedPatches,
        };
      });

      // Emit event
      auctionEventBus.emit("BidPlaced", {
        listingId,
        patchId,
        patchLabel: patchName,
        bidder: "user_wallet",
        brandName,
        amount,
        prevBidder,
        prevAmount,
        isBuyNow: isBought,
        color,
        logo: logoUrl,
        timestamp: Date.now(),
      });

      if (isBought) {
        auctionEventBus.emit("PatchBought", {
          listingId,
          patchId,
          patchLabel: patchName,
          buyer: "user_wallet",
          brandName,
          amount,
          timestamp: Date.now(),
        });
      }

      setStatus("done");
      return true;
    } catch (err) {
      setStatus("error");
      const friendly = parseContractError(err);
      setError(friendly);
      return false;
    }
  };

  return {
    status,
    error,
    execute,
    reset,
    isLoading: status === "signing" || status === "confirming",
    isSuccess: status === "done",
  };
}
