"use client";

import { useEffect, useState } from "react";
import { keccak256, toBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, publicClient } from "@/lib/config";

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));
const cache = new Map<string, boolean>();

/** Whether this wallet holds the market's admin role (read from the contract, cached per session). */
export function useIsAdmin(wallet?: string): boolean {
  const key = wallet?.toLowerCase();
  const [admin, setAdmin] = useState(() => (key ? cache.get(key) ?? false : false));
  useEffect(() => {
    if (!key) return setAdmin(false);
    if (cache.has(key)) return setAdmin(cache.get(key)!);
    let alive = true;
    publicClient
      .readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, key as `0x${string}`] })
      .then((v) => {
        cache.set(key, v);
        if (alive) setAdmin(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return admin;
}
