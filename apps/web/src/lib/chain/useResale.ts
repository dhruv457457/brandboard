"use client";

import { useState } from "react";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { updateMockBrandDashboard } from "../data";

export interface ListForResaleArgs {
  tokenId: string;
  price: bigint; // 6 decimals
}

export function useListForResale(): ChainHookResult<ListForResaleArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({ tokenId, price }: ListForResaleArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));
      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      updateMockBrandDashboard((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) =>
          r.tokenId === tokenId ? { ...r, resalePrice: price } : r
        ),
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

export interface BuyResaleArgs {
  tokenId: string;
  maxPrice: bigint;
}

export function useBuyResale(): ChainHookResult<BuyResaleArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({ tokenId }: BuyResaleArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));
      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      updateMockBrandDashboard((prev) => ({
        ...prev,
        receipts: prev.receipts.map((r) =>
          r.tokenId === tokenId
            ? { ...r, owner: "You", resalePrice: undefined }
            : r
        ),
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
