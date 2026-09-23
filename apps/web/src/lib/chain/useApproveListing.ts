"use client";

import { useState } from "react";
import { ListingStatus } from "@patched/shared";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { mutateMockListing, updateMockAdminQueue } from "../data";

export interface ApproveListingArgs {
  listingId: string;
}

export function useApproveListing(): ChainHookResult<ApproveListingArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({ listingId }: ApproveListingArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));
      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      mutateMockListing(listingId, (prev) => ({
        ...prev,
        status: ListingStatus.Active,
      }));

      updateMockAdminQueue((prev) => ({
        ...prev,
        moderationQueue: prev.moderationQueue.filter((m) => m.listingId !== listingId),
      }));

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
