"use client";

import { useCallback, useState } from "react";
import { encodeFunctionData, erc20Abi } from "viem";
import { patchAutoBidderAbi } from "@patched/shared";
import { AUTO_BIDDER, USDC, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { friendlyError } from "@/lib/market/useBid";
import { usePermitOrApprove } from "@/lib/market/permit";
import { useTx } from "@/lib/market/useTx";
import { useStepUp } from "@/lib/market/stepUp";

/** How many "max bids" of allowance one auto-bid adds. Outbid bids are refunded by the market but the
 *  allowance they used is not, so a long bidding war needs headroom. The contract still never bids
 *  above the max, and at most one bid per patch is locked at a time. */
const ALLOWANCE_HEADROOM = 10n;

const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID ?? "";

/**
 * Auto-bid ("keep me on top up to $X"), two ways:
 * - "signer" (Patched wallets): Patched's key quorum is added to the brand's own wallet as a Privy signer, limited by
 *   a Privy policy that only allows bids on the spots the brand chose, up to each maximum. The keeper then bids from
 *   the brand's wallet within seconds of an outbid. A new spot or a higher maximum needs the wallet to approve a new
 *   policy; lowering or turning one off doesn't. Revoked in one tap from Settings.
 * - "contract" (outside wallets such as MetaMask, which can't take a Privy signer): PatchAutoBidder. Turning it on is
 *   one permit signature plus one transaction; the keeper, a Privy server wallet whose policy only allows
 *   PatchAutoBidder.execute, answers every outbid.
 */
export function useAutoBid() {
  const { walletAddress, isEmbeddedWallet, getAccessToken, addSigner, removeSigner } = usePatchedAuth();
  const authorize = usePermitOrApprove();
  const send = useTx();
  const stepUp = useStepUp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode: "signer" | "contract" | null = isEmbeddedWallet && SIGNER_ID ? "signer" : AUTO_BIDDER ? "contract" : null;

  const api = useCallback(
    async <T,>(method: "GET" | "POST", body?: object): Promise<T> => {
      const token = await getAccessToken();
      const res = await fetch("/api/autobid", {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Auto-bid didn't go through. Try again.");
      return json;
    },
    [getAccessToken],
  );

  /** The signed-in brand's current maximum for a patch (0n = off). */
  const current = useCallback(
    async (listingId: number, patchId: number): Promise<bigint> => {
      if (!walletAddress) return 0n;
      if (mode === "signer") {
        const { bids } = await api<{ bids: { listingId: number; patchId: number; max: string }[] }>("GET");
        const b = bids.find((x) => x.listingId === listingId && x.patchId === patchId);
        return b ? BigInt(b.max) : 0n;
      }
      if (!AUTO_BIDDER) return 0n;
      return publicClient.readContract({
        address: AUTO_BIDDER, abi: patchAutoBidderAbi, functionName: "maxBid", args: [walletAddress, BigInt(listingId), patchId],
      });
    },
    [walletAddress, mode, api],
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
      const msg = err instanceof Error ? err.message : "";
      // Our API's own sentences are already readable; wallet and contract errors go through friendlyError.
      setError(/^(Pick|Bidding|This spot|You can't|Auto-bid|Privy|Too many|Enter)/.test(msg) ? msg : friendlyError(err).replace("The bid didn't", "Auto-bid didn't"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function enable(listingId: number, patchId: number, max: bigint) {
    return run(async () => {
      if (!walletAddress || !mode) throw new Error("not signed in");
      const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] });
      if (balance < max) throw new Error("insufficient USDC");
      // A high maximum lets Patched spend that much for you, so it gets the same passkey check as a big bid.
      await stepUp.ensure(max);

      if (mode === "signer") {
        const r = await api<{ signerId: string; policyId: string; signer: "ok" | "missing" | "other-policy" }>("POST", {
          action: "set", listingId, patchId, max: max.toString(),
        });
        // A new spot or a higher maximum always comes back with a new policy: the brand's wallet puts our signer on it
        // (Privy asks for the passkey here when one is on), and only then does the raise count.
        if (r.signer !== "ok") {
          // A signer from an older policy must come off first: a signer's policy can't be swapped in place.
          if (r.signer === "other-policy") await removeSigner();
          try {
            await addSigner(r.signerId, r.policyId);
          } catch (err) {
            // Our signer already came off for the swap, so the auto-bids that were on are stopped too: say so.
            if (r.signer !== "other-policy") throw err;
            console.error("addSigner failed after removeSigner:", err);
            throw new Error("Auto-bid didn't change, and Patched is off your wallet until you approve it. Try again.");
          }
          await api("POST", { action: "confirm", policyId: r.policyId });
        }
        return;
      }

      const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [walletAddress, AUTO_BIDDER!] });
      // Enough allowance for a long bidding war already: just set the rule. Otherwise top it up with a permit (or an approve, for wallets with code),
      // because every auto-bid uses allowance and outbid refunds don't give it back.
      if (allowance >= max * ALLOWANCE_HEADROOM) {
        await send(AUTO_BIDDER!, encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "setAutoBid", args: [BigInt(listingId), patchId, max] }));
        return;
      }

      const value = max * ALLOWANCE_HEADROOM;
      const permit = await authorize(AUTO_BIDDER!, value);
      await send(AUTO_BIDDER!, permit
        ? encodeFunctionData({
          abi: patchAutoBidderAbi, functionName: "setAutoBidWithPermit",
          args: [BigInt(listingId), patchId, max, value, permit.deadline, permit.v, permit.r, permit.s],
        })
        : encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "setAutoBid", args: [BigInt(listingId), patchId, max] }));
    });
  }

  function disable(listingId: number, patchId: number) {
    return run(async () => {
      if (mode === "signer") {
        await api("POST", { action: "off", listingId, patchId });
        return;
      }
      if (!AUTO_BIDDER) return;
      await send(AUTO_BIDDER, encodeFunctionData({ abi: patchAutoBidderAbi, functionName: "setAutoBid", args: [BigInt(listingId), patchId, 0n] }));
    });
  }

  /**
   * Can Patched actually place the next auto-bid? It needs USDC in the wallet, and for the contract way also
   * allowance for the auto-bidder; both run down during a long bidding war. The signer way approves as it goes.
   */
  const health = useCallback(
    async (need: bigint): Promise<"ok" | "balance" | "allowance"> => {
      if (!walletAddress || !mode) return "ok";
      const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] });
      if (balance < need) return "balance";
      if (mode === "signer") return "ok";
      const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [walletAddress, AUTO_BIDDER!] });
      return allowance < need ? "allowance" : "ok";
    },
    [walletAddress, mode],
  );

  return { available: !!mode, mode, current, health, enable, disable, busy, error };
}
