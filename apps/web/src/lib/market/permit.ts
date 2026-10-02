"use client";

import { createWalletClient, custom, encodeFunctionData, erc20Abi, parseSignature } from "viem";
import { CHAIN, CHAIN_ID, USDC, publicClient } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useTx } from "@/lib/market/useTx";

export const permitAbi = [
  { type: "function", name: "nonces", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

/**
 * Sign an EIP-2612 USDC permit for `spender` from the signed-in wallet: silently with the Privy embedded
 * wallet, or in the user's own wallet (MetaMask etc.). Returns the pieces a *WithPermit contract call needs.
 */
export function usePermitSigner() {
  const { walletAddress, wallet, isEmbeddedWallet, signTypedData } = usePatchedAuth();

  return async function signPermit(spender: `0x${string}`, value: bigint) {
    if (!walletAddress) throw new Error("not signed in");
    if (!isEmbeddedWallet && !wallet) throw new Error("wallet not connected");
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

export type Permit = Awaited<ReturnType<ReturnType<typeof usePermitSigner>>>;

/**
 * Let `spender` take `value` USDC from the signed-in wallet, in whichever way this wallet supports.
 * - A plain wallet (MetaMask with no code): one permit signature, returned for a *WithPermit call.
 * - A Privy wallet, or any wallet with code: an `approve` transaction first (sponsored and silent for Privy wallets),
 *   then null, so the caller uses the plain call. Privy's gas sponsorship gives every embedded wallet an EIP-7702
 *   delegation, and USDC checks permits from an address with code through ERC-1271, which rejects a plain permit
 *   signature ("EIP2612: invalid signature"). Permits only work for wallets that have no code.
 */
export function usePermitOrApprove() {
  const { walletAddress, isEmbeddedWallet } = usePatchedAuth();
  const signPermit = usePermitSigner();
  const send = useTx();

  return async function authorize(spender: `0x${string}`, value: bigint): Promise<Permit | null> {
    if (!walletAddress) throw new Error("not signed in");
    const code = await publicClient.getCode({ address: walletAddress });
    if (!isEmbeddedWallet && (!code || code === "0x")) return signPermit(spender, value);
    const allowance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "allowance", args: [walletAddress, spender] });
    if (allowance < value) await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, value] }));
    return null;
  };
}
