"use client";

import { useState } from "react";
import { MilestoneStatus } from "@patched/shared";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { mutateMockListing } from "../data";

export interface SubmitProofArgs {
  listingId: string;
  milestoneIndex: number;
  proofFiles: string[];
  proofHash?: string;
  proofUri?: string;
}

export function useSubmitProof(): ChainHookResult<SubmitProofArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({
    listingId,
    milestoneIndex,
    proofFiles,
  }: SubmitProofArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));

      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      const reviewEndsAt = Date.now() + 72 * 3600 * 1000; // 72-hour review window

      mutateMockListing(listingId, (prev) => ({
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.index === milestoneIndex
            ? {
                ...m,
                status: MilestoneStatus.Submitted,
                reviewEndsAt,
                proofFiles,
              }
            : m
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

export interface DisputeArgs {
  listingId: string;
  milestoneIndex: number;
  patchId: string | number;
  reason: string;
}

export function useDispute(): ChainHookResult<DisputeArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({
    listingId,
    milestoneIndex,
  }: DisputeArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));
      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      mutateMockListing(listingId, (prev) => ({
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.index === milestoneIndex
            ? {
                ...m,
                disputed: true,
              }
            : m
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

export interface ReleaseMilestoneArgs {
  listingId: string;
  milestoneIndex: number;
}

export function useReleaseMilestone(): ChainHookResult<ReleaseMilestoneArgs, boolean> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async ({
    listingId,
    milestoneIndex,
  }: ReleaseMilestoneArgs): Promise<boolean> => {
    try {
      setStatus("signing");
      setError(null);

      await new Promise((resolve) => setTimeout(resolve, 600));
      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 600));

      mutateMockListing(listingId, (prev) => ({
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.index === milestoneIndex
            ? {
                ...m,
                status: MilestoneStatus.Released,
              }
            : m
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
