"use client";

import { useEffect, useState } from "react";
import { Droplets, X } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { PLAY_MONEY, TEST_TOKEN } from "@/lib/config";
import { useBalances } from "@/lib/useBalances";
import { openAddMoney } from "./AddMoney";

const KEY = "patched:fund-nudge-dismissed";

/**
 * A signed-in person with $0 gets one clear next step at the top of Home: fund the wallet. On a test network that is a
 * free faucet, so the line says so. Dismissing it remembers on this device; it never comes back once they hold money.
 */
export function FundYourWallet() {
  const { authenticated, walletAddress } = usePatchedAuth();
  const { usdc } = useBalances(authenticated ? walletAddress : undefined);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!authenticated || !walletAddress || dismissed || usdc === null || Number(usdc.replace(/,/g, "")) > 0) return null;
  const free = PLAY_MONEY && !TEST_TOKEN;

  return (
    <div role="status" className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--accent)] bg-[var(--accent-soft)] p-3 sm:p-4">
      <span className="w-10 h-10 rounded-xl bg-[var(--card)] grid place-items-center flex-none"><Droplets size={20} /></span>
      <span className="min-w-0 flex-1 text-sm">
        <b className="block text-[15px]">Your wallet is empty</b>
        {free ? "Get free test USDC from Circle's faucet to place your first bid. It takes about a minute." : "Add money to place your first bid."}
      </span>
      <button type="button" onClick={openAddMoney} className="btn-base btn-small btn-primary flex-none">{free ? "Get free USDC" : "Add money"}</button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* storage blocked: it just comes back next visit */
          }
        }}
        className="flex-none w-8 h-8 grid place-items-center rounded-full hover:bg-[var(--card)]"
      ><X size={16} /></button>
    </div>
  );
}
