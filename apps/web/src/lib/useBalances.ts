"use client";

import { useEffect, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { USDC, publicClient } from "@/lib/config";

/** A wallet's USDC and MON balances, formatted for display and refreshed every 10 seconds. */
export function useBalances(wallet?: `0x${string}`) {
  const [usdc, setUsdc] = useState<string | null>(null);
  const [mon, setMon] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    const load = async () => {
      const [u, m] = await Promise.all([
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }),
        publicClient.getBalance({ address: wallet }),
      ]).catch(() => [null, null] as const);
      if (!alive) return;
      if (u !== null) setUsdc(Number(formatUnits(u, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
      if (m !== null) setMon(Number(formatUnits(m, 18)).toLocaleString("en-US", { maximumFractionDigits: 3 }));
    };
    void load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [wallet]);

  return { usdc, mon };
}
