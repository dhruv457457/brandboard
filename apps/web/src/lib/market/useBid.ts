"use client";

import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, createWalletClient, custom, encodeFunctionData, erc20Abi, parseSignature } from "viem";
import { useSendTransaction, useSignTypedData } from "@privy-io/react-auth";
import { CONTRACT_ERRORS, patchedMarketAbi } from "@patched/shared";
import { CHAIN, CHAIN_ID, MARKET, USDC, publicClient, GAS_SPONSORED, TEST_TOKEN } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

export type TxStatus = "idle" | "signing" | "confirming" | "done" | "error";

export const permitAbi = [
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

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
 * Real bid: one USDC permit signature + one transaction (bidWithPermit). With the Privy embedded
 * wallet the transaction is gas-sponsored and silent; with an external wallet (MetaMask etc.) the user
 * signs in their wallet and pays a little MON. The call is simulated first so a stale bid fails fast
 * with a clear reason.
 */
export function useBid() {
  const { walletAddress, wallet, isEmbeddedWallet, authenticated, login } = usePatchedAuth();
  const { signTypedData } = useSignTypedData();
  const { sendTransaction } = useSendTransaction();
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
      setStatus("signing");
      const [balance, nonce, name, version] = await Promise.all([
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] }),
        publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "nonces", args: [walletAddress] }),
        publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "name" }),
        publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "version" }),
      ]);
      if (balance < amount) throw new Error("insufficient USDC");

      // External wallets pay their own gas; check before asking them to sign anything.
      let external: ReturnType<typeof createWalletClient> | null = null;
      const paysGas = !GAS_SPONSORED || (!isEmbeddedWallet && !!wallet);
      if (paysGas && (await publicClient.getBalance({ address: walletAddress })) === 0n) throw new Error("no gas");
      if (!isEmbeddedWallet && wallet) {
        await wallet.switchChain(CHAIN_ID);
        external = createWalletClient({ account: walletAddress, chain: CHAIN, transport: custom(await wallet.getEthereumProvider()) });
      }

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
      const typedData = {
        domain: { name, version, chainId: CHAIN_ID, verifyingContract: USDC },
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        primaryType: "Permit" as const,
        message: { owner: walletAddress, spender: MARKET, value: amount, nonce, deadline },
      };
      const signature = external
        ? await external.signTypedData({ ...typedData, account: walletAddress })
        : (await signTypedData(typedData)).signature;
      const { v, r, s } = parseSignature(signature as `0x${string}`);
      const args = [BigInt(listingId), patchId, amount, deadline, Number(v), r, s] as const;

      // Fail fast with the contract's own reason (e.g. someone just outbid you).
      await publicClient.simulateContract({
        address: MARKET, abi: patchedMarketAbi, functionName: "bidWithPermit", args, account: walletAddress,
      });

      setStatus("confirming");
      const data = encodeFunctionData({ abi: patchedMarketAbi, functionName: "bidWithPermit", args });
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
      setError(friendlyError(err));
      setStatus("error");
      return false;
    }
  }

  return { bid, status, error, hash, reset: () => (setStatus("idle"), setError(null)) };
}
