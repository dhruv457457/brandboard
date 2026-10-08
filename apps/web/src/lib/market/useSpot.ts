"use client";

import { encodeFunctionData } from "viem";
import { patchSpotterAbi } from "@patched/shared";
import { SPOTTER, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useTx } from "./useTx";
import { friendlyError } from "./useBid";

/**
 * Record a spotted photo on-chain (PatchSpotter.spot). Gas-sponsored and silent for a Privy wallet; an outside wallet signs
 * and pays a little MON. The call is simulated first so "you already spotted this one" fails fast with a clear reason.
 * Returns the transaction hash, or null when this chain has no spotter yet (the photo is then posted without a transaction).
 */
export function useSpot() {
  const { walletAddress } = usePatchedAuth();
  const send = useTx();

  return async function spot(listingId: number, photoHash: `0x${string}`, photoURI: string): Promise<`0x${string}` | null> {
    if (!SPOTTER) return null;
    if (!walletAddress) throw new Error("Sign in to spot someone.");
    try {
      await publicClient.simulateContract({ address: SPOTTER, abi: patchSpotterAbi, functionName: "spot", args: [BigInt(listingId), photoHash, photoURI], account: walletAddress });
      const receipt = await send(SPOTTER, encodeFunctionData({ abi: patchSpotterAbi, functionName: "spot", args: [BigInt(listingId), photoHash, photoURI] }));
      return receipt.transactionHash;
    } catch (err) {
      throw new Error(friendlyError(err, "The spot didn't go through. Try again in a moment."));
    }
  };
}
