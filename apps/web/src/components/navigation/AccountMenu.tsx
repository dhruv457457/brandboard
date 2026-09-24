"use client";

import { useEffect, useRef, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { Check, ChevronDown, Copy, ExternalLink, Fingerprint, KeyRound, LogOut, Wallet } from "lucide-react";
import { useExportWallet } from "@privy-io/react-auth";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { CHAIN, EXPLORER, USDC, publicClient, GAS_SPONSORED } from "@/lib/config";
import { formatShortAddress } from "@/lib/format";
import { STEP_UP_USD, useStepUp } from "@/lib/market/stepUp";

/** Signed-in account chip: address, live balances, copy, explorer link, sign out. */
export function AccountMenu() {
  const { walletAddress, xHandle, logout, isEmbeddedWallet } = usePatchedAuth();
  const stepUp = useStepUp();
  const { exportWallet } = useExportWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usdc, setUsdc] = useState<string | null>(null);
  const [mon, setMon] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!walletAddress) return;
    let alive = true;
    const load = async () => {
      const [u, m] = await Promise.all([
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [walletAddress] }),
        publicClient.getBalance({ address: walletAddress }),
      ]).catch(() => [null, null] as const);
      if (!alive) return;
      if (u !== null) setUsdc(Number(formatUnits(u, 6)).toLocaleString("en-US", { maximumFractionDigits: 2 }));
      if (m !== null) setMon(Number(formatUnits(m, 18)).toLocaleString("en-US", { maximumFractionDigits: 3 }));
    };
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function copy() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is visible and selectable in the menu */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 border-2 border-[var(--line)] rounded-xl px-2.5 py-1.5 bg-[var(--card)] font-mono text-xs font-semibold shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)]"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
        {xHandle ? `@${xHandle}` : formatShortAddress(walletAddress)}
        {usdc !== null && <span className="text-[var(--muted)]">· {usdc} USDC</span>}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[300px] max-w-[calc(100vw-32px)] z-50 bg-[var(--card)] border-2 border-[var(--line)] rounded-2xl shadow-[4px_4px_0_var(--shadow)] p-4 flex flex-col gap-3">
          <div>
            <span className="eyebrow">Your wallet</span>
            <p className="font-mono text-[13px] break-all mt-1 select-all">{walletAddress}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={copy} className="btn-base btn-small">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
              <a className="btn-base btn-small btn-ghost" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer">
                Explorer <ExternalLink size={13} />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[var(--soft)] p-2.5">
              <span className="text-xs text-[var(--muted)]">USDC</span>
              <b className="block font-mono">{usdc ?? "…"}</b>
            </div>
            <div className="rounded-xl bg-[var(--soft)] p-2.5">
              <span className="text-xs text-[var(--muted)]">MON (gas)</span>
              <b className="block font-mono">{mon ?? "…"}</b>
            </div>
          </div>
          <p className="text-xs text-[var(--muted)] flex gap-1.5 items-start">
            <Wallet size={13} className="mt-px flex-none" />
            {isEmbeddedWallet
              ? GAS_SPONSORED
                ? `Patched wallet on ${CHAIN.name}. Gas is sponsored, so you don't need MON.`
                : `Patched wallet on ${CHAIN.name}. Send USDC to bid and a little MON for gas to this address.`
              : `External wallet on ${CHAIN.name}. You pay gas in MON for each transaction.`}
          </p>
          <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-[var(--soft)] p-2.5">
            <span className="flex gap-2 items-start text-xs">
              <Fingerprint size={16} className="flex-none text-[var(--accent-text)]" />
              <span>
                <b className="block text-sm">Passkey</b>
                {stepUp.hasPasskey
                  ? `On. Moves of $${STEP_UP_USD.toLocaleString("en-US")}+ ask for it.`
                  : `Needed for bids of $${STEP_UP_USD.toLocaleString("en-US")} or more.`}
              </span>
            </span>
            {!stepUp.hasPasskey && (
              <button onClick={() => { setOpen(false); stepUp.setUpPasskey(); }} className="btn-base btn-small flex-none">Set up</button>
            )}
          </div>
          {isEmbeddedWallet && walletAddress && (
            <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-[var(--soft)] p-2.5">
              <span className="flex gap-2 items-start text-xs">
                <KeyRound size={16} className="flex-none text-[var(--accent-text)]" />
                <span>
                  <b className="block text-sm">Your wallet is yours</b>
                  Export the private key to MetaMask or any wallet. Patched never sees it.
                </span>
              </span>
              <button
                onClick={() => { setOpen(false); exportWallet({ address: walletAddress }).catch(() => {}); }}
                className="btn-base btn-small flex-none"
              >
                Export
              </button>
            </div>
          )}
          <button onClick={() => { setOpen(false); logout(); }} className="btn-base btn-small btn-ghost self-start">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
