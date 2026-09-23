"use client";

import { useState } from "react";
import { ListingStatus, Surface } from "@patched/shared";
import { ChainHookResult, ChainTxStatus, parseContractError } from "./types";
import { addMockListing } from "../data";
import { ListingRecord, PatchRecord, SurfaceType } from "../data/types";

export interface CreateListingArgs {
  surface: SurfaceType;
  title: string;
  eventId?: number;
  eventName?: string;
  biddingEndsAt: number; // Unix ms
  bond: bigint; // 6 decimals (min $25 USDC = 25_000_000n)
  patches: {
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    r?: number;
    floor: bigint;
    buyNow: bigint;
  }[];
  milestones?: {
    name: string;
    bps: number;
  }[];
  payees?: string[];
  shares?: number[];
  metadataUri?: string;
}

export function useCreateListing(): ChainHookResult<CreateListingArgs, string | null> {
  const [status, setStatus] = useState<ChainTxStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setError(null);
  };

  const execute = async (args: CreateListingArgs): Promise<string | null> => {
    try {
      setStatus("signing");
      setError(null);

      if (args.patches.length === 0) {
        throw new Error("InvalidParams");
      }

      await new Promise((resolve) => setTimeout(resolve, 700));

      setStatus("confirming");
      await new Promise((resolve) => setTimeout(resolve, 700));

      const newListingId = `listing-${Date.now().toString(36)}`;
      const surfaceEnum =
        args.surface === "outfit"
          ? Surface.Outfit
          : args.surface === "car"
          ? Surface.Car
          : Surface.Hoodie;

      const patches: PatchRecord[] = args.patches.map((p, idx) => ({
        id: `p-${idx}`,
        listingId: newListingId,
        name: p.name,
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        r: p.r || 0,
        floor: p.floor,
        buyNow: p.buyNow,
        topBid: 0n,
      }));

      const newListing: ListingRecord = {
        id: newListingId,
        creator: "0xuser...wallet",
        creatorHandle: "current_user",
        creatorName: "You",
        title: args.title,
        surface: args.surface,
        surfaceEnum,
        eventId: args.eventId,
        eventName: args.eventName,
        status: ListingStatus.Pending,
        biddingEndsAt: args.biddingEndsAt,
        hardEndsAt: args.biddingEndsAt + 86400 * 1000,
        bond: args.bond,
        totalEscrow: 0n,
        patches,
        milestones: (args.milestones || []).map((m, idx) => ({
          index: idx,
          name: m.name,
          bps: m.bps,
          status: 0,
        })),
        createdAt: Date.now(),
      };

      addMockListing(newListing);

      setStatus("done");
      return newListingId;
    } catch (err) {
      setStatus("error");
      setError(parseContractError(err));
      return null;
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
