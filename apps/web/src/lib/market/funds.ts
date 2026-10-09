"use client";

import { erc20Abi } from "viem";
import { USDC, publicClient } from "@/lib/config";
import { openAddMoneyFor } from "@/components/wallet/AddMoney";

/**
 * Check the wallet holds `amount` before an action spends it. When it doesn't, the Add money sheet opens with what's
 * missing ("This bid needs $10. Your wallet has $0.") and the faucet steps, and the action stops with "insufficient
 * USDC". `what` names the action: "bid", "sweep", "auto-bid limit", "listing stake", "campaign budget".
 */
export async function requireFunds(wallet: `0x${string}`, amount: bigint, what: string): Promise<bigint> {
  const balance = await publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
  if (balance < amount) {
    showShortfall(balance, amount, what);
    throw new Error("insufficient USDC");
  }
  return balance;
}

/** Open Add money for an amount the caller has already found short. */
export function showShortfall(balance: bigint, amount: bigint, what: string) {
  openAddMoneyFor({ need: Number(amount) / 1e6, have: Number(balance) / 1e6, what });
}
