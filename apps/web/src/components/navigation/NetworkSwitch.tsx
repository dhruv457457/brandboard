"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, TriangleAlert } from "lucide-react";
import { DEPLOYMENTS } from "@patched/shared";
import { CHAIN_ID, NETWORK_SITES } from "@/lib/config";
import { cn } from "@/lib/utils";

/**
 * Where the same page lives on the other network's site. Listings, receipts and events have their own numbers
 * on each chain, so those pages fall back to the matching list.
 */
function samePageOn(path: string): string {
  if (/^\/e\//.test(path)) return "/events";
  if (/^\/(studio|share)\/\d+/.test(path) || /^\/[^/]+\/\d+\/?$/.test(path)) return "/explore";
  return path;
}

/**
 * Whether a network has a site to go to. Without NEXT_PUBLIC_*_URL set, a site points at localhost, which is only
 * useful when you are on localhost yourself: on the real site it would be a dead link.
 */
/**
 * One site, two chains: the switch sets a cookie and the middleware serves the other chain's build behind the same
 * address (see middleware.ts). On when NEXT_PUBLIC_CHAIN_COOKIE=true.
 */
const COOKIE_MODE = process.env.NEXT_PUBLIC_CHAIN_COOKIE === "true";

/** Remember the chosen chain for the whole site (creator subdomains too) and open the same place on it. */
export function switchChain(chain: 10143 | 143, path: string) {
  const host = window.location.hostname;
  const parent = host === "monad.patched.world" || host.endsWith(".monad.patched.world") ? "; domain=monad.patched.world" : "";
  document.cookie = chain === 143
    ? `patched-chain=143; path=/; max-age=31536000; samesite=lax${parent}`
    : `patched-chain=; path=/; max-age=0; samesite=lax${parent}`;
  window.location.assign(samePageOn(path));
}

export function networkAvailable(chain: 10143 | 143): boolean {
  if (COOKIE_MODE) return true;
  const url = NETWORK_SITES[chain].url;
  if (!/localhost|127\.0\.0\.1/.test(url)) return true;
  return typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

export function networkUrl(chain: 10143 | 143, path: string) {
  return `${NETWORK_SITES[chain].url.replace(/\/$/, "")}${samePageOn(path)}`;
}

const DOT = { 10143: "bg-[#F5B400]", 143: "bg-[var(--green)]" } as const;

/** The two networks as a list; used by the account menu and Settings. */
export function NetworkOptions({ onPick }: { onPick?: () => void }) {
  const pathname = usePathname();
  const [asking, setAsking] = useState(false);
  const notes = {
    10143: "Monad testnet with test USDC. Try everything for free.",
    143: DEPLOYMENTS[143]?.testToken ? "Monad mainnet, test run with the TestUSD token." : "Monad mainnet with real USDC.",
  } as const;
  return (
    <ul className="grid gap-1">
      {([10143, 143] as const).map((chain) => {
        const active = chain === CHAIN_ID;
        return (
          <li key={chain}>
            <a
              href={active ? undefined : networkUrl(chain, pathname)}
              onClick={(e) => {
                if (active) e.preventDefault();
                else if (COOKIE_MODE && chain === 10143) {
                  e.preventDefault();
                  switchChain(10143, pathname);
                  return;
                } else if (chain === 143) {
                  e.preventDefault();
                  setAsking(true);
                  return;
                }
                onPick?.();
              }}
              aria-current={active ? "true" : undefined}
              className={cn("flex gap-2.5 items-start rounded-lg px-2.5 py-2 no-underline", active ? "bg-[var(--soft)]" : "hover:bg-[var(--soft)]")}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full mt-1.5 flex-none", DOT[chain])} />
              <span className="grid min-w-0">
                <b className="text-sm flex items-center gap-1.5">{NETWORK_SITES[chain].label}{active && <Check size={13} />}</b>
                <span className="text-xs text-[var(--muted)]">{notes[chain]}</span>
              </span>
            </a>
          </li>
        );
      })}
      <li className="px-2.5 pt-1 pb-1 text-[11px] text-[var(--muted)]">Same account and wallet on both. You sign in once per network.</li>
      {asking && <li><MainnetNotice href={networkUrl(143, pathname)} onGo={COOKIE_MODE ? () => switchChain(143, pathname) : undefined} onClose={() => setAsking(false)} /></li>}
    </ul>
  );
}

/** The warning before a visitor moves to mainnet: real USDC, an MVP, so small amounts. */
export function MainnetNotice({ href, onGo, onClose }: { href: string; onGo?: () => void; onClose: () => void }) {
  const open = networkAvailable(143);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-[rgba(11,11,12,0.45)] backdrop-blur-xs" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="mainnet-title" onMouseDown={(e) => e.stopPropagation()}
        className="card-surface w-full max-w-[420px] p-6 grid gap-3">
        <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-text)]"><TriangleAlert size={20} /></span>
        <h2 id="mainnet-title" className="text-xl font-extrabold">{open ? "Mainnet uses real USDC" : "Mainnet opens soon"}</h2>
        <p className="text-sm text-[var(--muted)]">
          {open
            ? "Patched is an MVP and the contracts are unaudited, so use small amounts. Every bid, stake and payout here is real USDC on Monad mainnet. Testnet has free test money if you just want to try things."
            : "The contracts are live on Monad mainnet with real USDC, but this site isn't open there yet. Everything works on testnet with free test money, so try it there for now."}
        </p>
        <div className={open ? "grid gap-2 sm:grid-cols-2 mt-1" : "grid mt-1"}>
          <button type="button" onClick={onClose} className="btn-base btn-primary justify-center">{open ? "Stay on testnet" : "Got it"}</button>
          {open && (onGo
            ? <button type="button" onClick={onGo} className="btn-base justify-center">Go to mainnet</button>
            : <a href={href} className="btn-base justify-center no-underline">Go to mainnet</a>)}
        </div>
      </div>
    </div>
  );
}

/**
 * A small switch for the sidebar: testnet is on the left, mainnet on the right. Moving to mainnet asks first;
 * moving back to testnet goes straight there.
 */
export function NetworkToggle({ compact }: { compact?: boolean }) {
  const pathname = usePathname();
  const [asking, setAsking] = useState(false);
  const onMainnet = CHAIN_ID === 143;
  const target = onMainnet ? 10143 : 143;
  const href = networkUrl(target, pathname);
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={onMainnet}
        aria-label={onMainnet ? "On mainnet. Switch to testnet" : "On testnet. Switch to mainnet"}
        title={onMainnet ? "Mainnet (real USDC). Switch to testnet" : "Testnet. Switch to mainnet"}
        onClick={() => (onMainnet ? (COOKIE_MODE ? switchChain(10143, pathname) : window.location.assign(href)) : setAsking(true))}
        className={cn("flex items-center gap-2 rounded-full hover:bg-[var(--soft)] px-2 h-10 w-full", compact ? "justify-center" : "xl:px-3 justify-center xl:justify-start")}
      >
        <span className={cn("relative w-9 h-5 flex-none rounded-full border-[1.5px] border-[var(--line)] transition-colors", onMainnet ? "bg-[var(--green)]" : "bg-[#F5B400]")}>
          <span className={cn("absolute top-[2px] w-3.5 h-3.5 rounded-full bg-[var(--paper)] border border-[var(--line)] transition-all", onMainnet ? "left-[18px]" : "left-[2px]")} />
        </span>
        <span className="hidden xl:inline text-sm font-semibold">{onMainnet ? "Mainnet" : "Testnet"}</span>
      </button>
      {asking && <MainnetNotice href={href} onGo={COOKIE_MODE ? () => switchChain(143, pathname) : undefined} onClose={() => setAsking(false)} />}
    </>
  );
}
