"use client";

import { useState } from "react";
import { encodeFunctionData, erc20Abi, parseEventLogs, stringToHex } from "viem";
import { patchedMarketAbi, type ListingMetadata } from "@patched/shared";
import { MARKET, USDC, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { friendlyError } from "./useBid";
import { useTx } from "./useTx";

export type CreateStep = "idle" | "saving" | "approving" | "creating" | "done" | "error";

export interface CreateListingInput {
  metadata: ListingMetadata;
  surfaceIndex: 0 | 1 | 2;
  eventId: number;
  biddingEndsAt: number; // unix seconds
  bond: bigint;
  floors: bigint[];
  buyNows: bigint[];
  deadlines: number[]; // unix seconds, one per milestone
}

/** Save metadata → approve the bond (if needed) → createListing. Returns the new listing id. */
export function useCreateListing() {
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const [step, setStep] = useState<CreateStep>("idle");
  const [error, setError] = useState<string | null>(null);

  async function create(input: CreateListingInput): Promise<number | null> {
    if (!walletAddress) return null;
    setError(null);
    try {
      setStep("saving");
      const res = await authedFetch("/api/listings/metadata", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.metadata),
      });
      const saved = (await res.json()) as { metadataHash?: `0x${string}`; metadataURI?: string; error?: string };
      if (!res.ok || !saved.metadataHash) throw new Error(saved.error ?? "Couldn't save the listing details.");

      const [balance, allowance] = await Promise.all([
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] }),
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [walletAddress, MARKET] }),
      ]);
      if (balance < input.bond) throw new Error("insufficient USDC for the bond");
      if (allowance < input.bond) {
        setStep("approving");
        await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [MARKET, input.bond] }));
      }

      setStep("creating");
      const params = {
        surface: input.surfaceIndex,
        eventId: input.eventId,
        biddingEndsAt: input.biddingEndsAt,
        bond: input.bond,
        floors: input.floors,
        buyNows: input.buyNows,
        labels: input.metadata.patches.map((p) => stringToHex(p.name.slice(0, 31), { size: 32 })),
        milestoneBps: input.metadata.milestones.map((m) => m.bps),
        deadlines: input.deadlines,
        payees: [] as `0x${string}`[],
        shares: [] as number[],
        metadataURI: saved.metadataURI!,
        metadataHash: saved.metadataHash,
      };
      await publicClient.simulateContract({
        address: MARKET, abi: patchedMarketAbi, functionName: "createListing", args: [params], account: walletAddress,
      });
      const receipt = await send(MARKET, encodeFunctionData({ abi: patchedMarketAbi, functionName: "createListing", args: [params] }));
      const [created] = parseEventLogs({ abi: patchedMarketAbi, eventName: "ListingCreated", logs: receipt.logs });
      fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
      setStep("done");
      return created ? Number(created.args.listingId) : null;
    } catch (err) {
      const msg = err instanceof Error && /Couldn't|invalid|Sign in/.test(err.message) ? err.message : friendlyError(err);
      setError(/bond/.test(String(err)) ? "You need enough USDC in your wallet to cover the bond." : msg.replace("The bid didn't", "It didn't"));
      setStep("error");
      return null;
    }
  }

  return { create, step, error };
}
