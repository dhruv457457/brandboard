"use client";

import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, createWalletClient, custom, encodeFunctionData, erc20Abi } from "viem";
import { CONTRACT_ERRORS, patchedMarketAbi } from "@patched/shared";
import { CHAIN, CHAIN_ID, MARKET, USDC, publicClient, GAS_SPONSORED, TEST_TOKEN } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { STEP_UP_USD, useStepUp } from "@/lib/market/stepUp";
import { usePermitOrApprove } from "@/lib/market/permit";

export type TxStatus = "idle" | "signing" | "confirming" | "done" | "error";

/** Turn any wallet / contract error into one sentence a person understands. */
export function friendlyError(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
    }
    if (/user rejected|denied/i.test(err.message)) return "You cancelled the signature.";
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof Error && err.name === "PasskeyRequired")
    return "demo" in err && err.demo
      ? `Moves of $${STEP_UP_USD.toLocaleString("en-US")} or more aren't available on the shared demo account. Sign in with your own email or X for those.`
      : `Moves of $${STEP_UP_USD.toLocaleString("en-US")} or more need a passkey. Turn one on in Settings, under Security, then try again.`;
  if (/wallet not connected/i.test(msg)) return "Your wallet isn't connected in this browser. Open MetaMask (or your wallet), connect it to Patched, then try again.";
  if (/mfa/i.test(msg)) return "The passkey check didn't go through. Try again.";
  if (/rejected|denied|cancel/i.test(msg)) return "You cancelled the signature.";
  if (/FaucetCooldown/i.test(msg)) return "You already used the faucet today. Try again tomorrow.";
  if (/no gas/i.test(msg))
    return GAS_SPONSORED
      ? "Your wallet needs a little MON to pay gas. Use the Patched wallet (email or X login) for gas-free bids."
      : "Your wallet needs a little MON to pay gas. Send some MON to your wallet address (in the account menu).";
  if (/insufficient/i.test(msg))
    return TEST_TOKEN
      ? "Not enough test USD in your wallet. Get 1,000 free from the faucet on My bids."
      : "Not enough USDC in your wallet for this bid.";
  return "The bid didn't go through. Try again in a moment.";
}

/**
 * Real bid. A plain external wallet (MetaMask etc.) signs one USDC permit and sends bidWithPermit, paying a little
 * MON. A Privy embedded wallet approves the exact amount, then bids: two gas-sponsored transactions, both silent
 * (permits don't work for wallets with code, see usePermitOrApprove). The call is simulated first so a stale bid
 * fails fast with a clear reason.
 */
export function useBid() {
  const { walletAddress, wallet, isEmbeddedWallet, authenticated, login, sendTransaction } = usePatchedAuth();
  const authorize = usePermitOrApprove();
  const stepUp = useStepUp();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);

  async function bid(listingId: number, patchId: number, amount: bigint): Promise<boolean> {
    if (!authenticated || !walletAddress) {
      login();
      return false;
    }
    setError(null);
    setHash(null);
    try {
      if (!isEmbeddedWallet && !wallet) throw new Error("wallet not connected");
      // Big bids: passkey check through Privy MFA before anything is signed.
      await stepUp.ensure(amount);
      setStatus("signing");
      const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] });
      if (balance < amount) throw new Error("insufficient USDC");

      // External wallets pay their own gas; check before asking them to sign anything.
      let external: ReturnType<typeof createWalletClient> | null = null;
      const paysGas = !GAS_SPONSORED || (!isEmbeddedWallet && !!wallet);
      if (paysGas && (await publicClient.getBalance({ address: walletAddress })) === 0n) throw new Error("no gas");
      if (!isEmbeddedWallet && wallet) {
        await wallet.switchChain(CHAIN_ID);
        external = createWalletClient({ account: walletAddress, chain: CHAIN, transport: custom(await wallet.getEthereumProvider()) });
      }

      // A permit signature where the wallet supports it, otherwise an approve first (see usePermitOrApprove).
      const permit = await authorize(MARKET, amount);
      const id = BigInt(listingId);
      // Fail fast with the contract's own reason (e.g. someone just outbid you).
      if (permit) {
        const args = [id, patchId, amount, permit.deadline, permit.v, permit.r, permit.s] as const;
        await publicClient.simulateContract({ address: MARKET, abi: patchedMarketAbi, functionName: "bidWithPermit", args, account: walletAddress });
      } else {
        await publicClient.simulateContract({ address: MARKET, abi: patchedMarketAbi, functionName: "bid", args: [id, patchId, amount], account: walletAddress });
      }
      const data = permit
        ? encodeFunctionData({ abi: patchedMarketAbi, functionName: "bidWithPermit", args: [id, patchId, amount, permit.deadline, permit.v, permit.r, permit.s] })
        : encodeFunctionData({ abi: patchedMarketAbi, functionName: "bid", args: [id, patchId, amount] });

      setStatus("confirming");
      const txHash = external
        ? await external.sendTransaction({ account: walletAddress, chain: CHAIN, to: MARKET, data })
        : (await sendTransaction({ to: MARKET, data, chainId: CHAIN_ID }, { sponsor: GAS_SPONSORED })).hash;
      setHash(txHash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") throw new Error("reverted");

      setStatus("done");
      // Let the indexer pick it up right away instead of waiting for the next scheduled run.
      fetch("/api/indexer/sync", { method: "POST" }).catch(() => {});
      return true;
    } catch (err) {
      // The person sees one plain sentence; the console keeps the real cause (Privy, RPC or contract) for debugging.
      console.error("Bid failed:", err);
      setError(friendlyError(err));
      setStatus("error");
      return false;
    }
  }

  return { bid, status, error, hash, reset: () => (setStatus("idle"), setError(null)) };
}
