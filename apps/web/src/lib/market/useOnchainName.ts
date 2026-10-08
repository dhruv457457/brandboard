"use client";

import { encodeFunctionData, stringToHex } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, GAS_SPONSORED, MARKET, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";

/** What the contract allows in a name (letters, digits, space . - _), at most 31 bytes. */
const clean = (s: string | null | undefined) => (s ?? "").replace(/[^A-Za-z0-9 ._-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);

/**
 * The name drawn on a person's patch NFTs is stored on-chain, under their wallet. Most people never visit Settings, so
 * before their first bid or listing we write it for them from what the profile already knows (brand name, display name,
 * handle). Silent and sponsored for Patched wallets; wallets that sign in a browser extension are never asked for an
 * extra signature. It never blocks the action it runs before.
 */
export function useEnsureOnchainName() {
  const { walletAddress, isEmbeddedWallet, sendTransaction } = usePatchedAuth();
  const { profile } = useProfile();

  return async function ensureOnchainName(prefer: "brand" | "creator", nameOverride?: string) {
    try {
      if (!walletAddress || !isEmbeddedWallet || !GAS_SPONSORED) return;
      const name = nameOverride
        ? clean(nameOverride)
        : prefer === "brand"
          ? clean(profile?.brand_name) || clean(profile?.display_name) || clean(profile?.handle) || clean(profile?.x_handle)
          : clean(profile?.handle) || clean(profile?.x_handle) || clean(profile?.display_name);
      if (!name) return;
      const current = await publicClient.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "brandName", args: [walletAddress] });
      const next = stringToHex(name, { size: 32 });
      // A name the person just chose replaces the old one; the automatic fallback only fills an empty one.
      if (nameOverride ? current.toLowerCase() === next.toLowerCase() : current !== "0x0000000000000000000000000000000000000000000000000000000000000000") return;
      const data = encodeFunctionData({ abi: patchedMarketAbi, functionName: "setBrandName", args: [next] });
      const { hash } = await sendTransaction({ to: MARKET, data, chainId: CHAIN_ID }, { sponsor: true });
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (err) {
      console.warn("Couldn't write the on-chain name; continuing without it.", err);
    }
  };
}
