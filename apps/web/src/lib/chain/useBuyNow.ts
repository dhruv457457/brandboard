"use client";

import { useState } from "react";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { useBid } from "./useBid";
import { getListing } from "../data";

export interface BuyNowArgs {
  listingId: string;
  patchId: string | number;
  brandName: string;
  logoUrl?: string | null;
  color?: string;
}

export function useBuyNow(): ChainHookResult<BuyNowArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const { execute: placeBid } = useBid();

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({
    listingId,
    patchId,
    brandName,
    logoUrl,
    color = "p5",
  }: BuyNowArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      const listing = await getListing(listingId);
      if (!listing) {
        throw new Error("BadPatch");
      }

      const patch = listing.patches.find((p) => p.id === patchId);
      if (!patch) {
        throw new Error("BadPatch");
      }

      if (patch.bought || patch.locked) {
        throw new Error("AlreadyBought");
      }

      const buyNowAmount = patch.buyNow;
      const success = await placeBid({
        listingId,
        patchId,
        amount: buyNowAmount,
        brandName,
        logoUrl,
        color,
      });

      if (!success) {
        throw new Error("Transaction failed");
      }

      setStatus("done");
      return true;
    } catch (err) {
      setStatus("error");
      setError(parseContractError(err));
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
