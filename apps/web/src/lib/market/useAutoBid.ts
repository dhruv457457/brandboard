"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { patchAutoBidderAbi } from "@patched/shared";
import { AUTO_BIDDER, USDC, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { friendlyError } from "@/lib/market/useBid";
import { usePermitSigner } from "@/lib/market/permit";
import { useTx } from "@/lib/market/useTx";

/** How many "max bids" of allowance one auto-bid adds. Outbid bids are refunded by the market but the
 *  allowance they used is not, so a long bidding war needs headroom. The contract still never bids
 *  above the max, and at most one bid per patch is locked at a time. */
const ALLOWANCE_HEADROOM = 10n;

/**
 * Auto-bid ("keep me on top up to $X") through PatchAutoBidder. Turning it on is one permit signature
 * plus one transaction (setAutoBidWithPermit). After that the Patched keeper, a Privy server wallet whose
 * policy only allows PatchAutoBidder.execute, answers every outbid within seconds.
 */
export function useAutoBid() {
  const { walletAddress } = usePatchedAuth();
  const signPermit = usePermitSigner();
  const send = useTx();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** The signed-in brand's current maximum for a patch (0n = off). */
  const current = useCallback(
    async (listingId: number, patchId: number): Promise<bigint> => {
      if (!AUTO_BIDDER || !walletAddress) return 0n;
      return publicClient.readContract({
        address: AUTO_BIDDER, abi: patchAutoBidderAbi, functionName: "maxBid", args: [walletAddress, BigInt(listingId), patchId],
      });
    },
    [walletAddress],
  );

  async function run(fn: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      // Let the keeper see the new rule and place the first bid; don't make the user wait for it.
      fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
      return true;
    } catch (err) {
      setError(friendlyError(err).replace("The bid didn't", "Auto-bid didn't"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function enable(listingId: number, patchId: number, max: bigint) {
    return run(async () => {
      if (!AUTO_BIDDER || !walletAddress) throw new Error("not signed in");
      const [balance, allowance] = await Promise.all([
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] }),
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [walletAddress, AUTO_BIDDER] }),
      ]);
      if (balance < max) throw new Error("insufficient USDC");

      // Enough allowance already: just set the rule.
      if (allowance >= max * 2n) {
        await send(AUTO_BIDDER, encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "setAutoBid", args: [BigInt(listingId), patchId, max] }));
        return;
      }

      const value = allowance + max * ALLOWANCE_HEADROOM;
      const { deadline, v, r, s } = await signPermit(AUTO_BIDDER, value);
      await send(AUTO_BIDDER, encodeFunctionData({
        abi: patchAutoBidderAbi, functionName: "setAutoBidWithPermit",
        args: [BigInt(listingId), patchId, max, value, deadline, v, r, s],
      }));
    });
  }

  function disable(listingId: number, patchId: number) {
    return run(async () => {
      if (!AUTO_BIDDER) return;
      await send(AUTO_BIDDER, encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "setAutoBid", args: [BigInt(listingId), patchId, 0n] }));
    });
  }

  return { available: !!AUTO_BIDDER, current, enable, disable, busy, error };
}
