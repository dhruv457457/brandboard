"use client";

import { createWalletClient, custom } from "viem";
import { CHAIN, CHAIN_ID, GAS_SPONSORED, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

/**
 * Send a contract call from the signed-in wallet and wait for it to be mined.
 * Privy embedded wallet: gas-sponsored (when GAS_SPONSORED) and silent. External wallet: signed in the wallet, pays MON.
 */
export function useTx() {
  const { walletAddress, wallet, isEmbeddedWallet, sendTransaction } = usePatchedAuth();

  return async function send(to: `0x${string}`, data: `0x${string}`) {
    if (!walletAddress) throw new Error("not signed in");
    let hash: `0x${string}`;
    if (isEmbeddedWallet || !wallet) {
      if (!GAS_SPONSORED && (await publicClient.getBalance({ address: walletAddress })) === 0n) throw new Error("no gas");
      hash = (await sendTransaction({ to, data, chainId: CHAIN_ID }, { sponsor: GAS_SPONSORED })).hash;
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
