"use client";

import { createWalletClient, custom } from "viem";
import { useSendTransaction } from "@privy-io/react-auth";
import { CHAIN, CHAIN_ID, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

/**
 * Send a contract call from the signed-in wallet and wait for it to be mined.
 * Privy embedded wallet: gas-sponsored and silent. External wallet: signed in the wallet, pays MON.
 */
export function useTx() {
  const { walletAddress, wallet, isEmbeddedWallet } = usePatchedAuth();
  const { sendTransaction } = useSendTransaction();

  return async function send(to: `0x${string}`, data: `0x${string}`) {
    if (!walletAddress) throw new Error("not signed in");
    let hash: `0x${string}`;
    if (isEmbeddedWallet || !wallet) {
      hash = (await sendTransaction({ to, data, chainId: CHAIN_ID }, { sponsor: true })).hash;
    } else {
      if ((await publicClient.getBalance({ address: walletAddress })) === 0n) throw new Error("no gas");
      await wallet.switchChain(CHAIN_ID);
      const client = createWalletClient({ account: walletAddress, chain: CHAIN, transport: custom(await wallet.getEthereumProvider()) });
      hash = await client.sendTransaction({ account: walletAddress, chain: CHAIN, to, data });
    }
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("reverted");
    return receipt;
  };
}
