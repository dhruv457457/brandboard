"use client";

import { createWalletClient, custom, parseSignature } from "viem";
import { useSignTypedData } from "@privy-io/react-auth";
import { CHAIN, CHAIN_ID, USDC, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { permitAbi } from "@/lib/market/useBid";

/**
 * Sign an EIP-2612 USDC permit for `spender` from the signed-in wallet: silently with the Privy embedded
 * wallet, or in the user's own wallet (MetaMask etc.). Returns the pieces a *WithPermit contract call needs.
 */
export function usePermitSigner() {
  const { walletAddress, wallet, isEmbeddedWallet } = usePatchedAuth();
  const { signTypedData } = useSignTypedData();

  return async function signPermit(spender: `0x${string}`, value: bigint) {
    if (!walletAddress) throw new Error("not signed in");
    const [nonce, name, version] = await Promise.all([
      publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "nonces", args: [walletAddress] }),
      publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "name" }),
      publicClient.readContract({ address: USDC, abi: permitAbi, functionName: "version" }),
    ]);
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
      message: { owner: walletAddress, spender, value, nonce, deadline },
    };
    let signature: `0x${string}`;
    if (!isEmbeddedWallet && wallet) {
      await wallet.switchChain(CHAIN_ID);
      const client = createWalletClient({ account: walletAddress, chain: CHAIN, transport: custom(await wallet.getEthereumProvider()) });
      signature = await client.signTypedData({ ...typedData, account: walletAddress });
    } else {
      signature = (await signTypedData(typedData)).signature as `0x${string}`;
    }
    const { v, r, s } = parseSignature(signature);
    return { deadline, v: Number(v), r, s };
  };
}
