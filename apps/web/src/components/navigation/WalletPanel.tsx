"use client";

import Link from "next/link";
import { Bot, ExternalLink, Gavel, LayoutDashboard, LogOut, Megaphone, Moon, Plus, Settings, ShieldHalf, Stamp, Sun } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useBalances } from "@/lib/useBalances";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useProfile } from "@/lib/profile";
import { useTheme } from "@/lib/theme";
import { CHAIN, EXPLORER, GAS_SPONSORED, OPEN_ADMIN } from "@/lib/config";
import { openAddMoney } from "@/components/wallet/AddMoney";
import { NetworkOptions } from "./NetworkSwitch";

const ROW = "flex items-center gap-3 h-10 px-2.5 rounded-xl text-[15px] font-semibold no-underline text-[var(--ink)] hover:bg-[var(--soft)] w-full text-left";

/**
 * The wallet, as a small panel: balance in dollars, how to add money, and the account places (bids, dashboard,
 * settings, theme, network, sign out). Opened from your name in the sidebar or the avatar on phones.
 */
export function WalletPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { walletAddress, logout } = usePatchedAuth();
  const { profile } = useProfile();
  const me = `/${profile?.handle ?? walletAddress?.toLowerCase() ?? ""}`;
  const { usdc, mon } = useBalances(walletAddress);
  const isAdmin = useIsAdmin(walletAddress);
  const { theme, toggleTheme } = useTheme();
  const go = () => onNavigate?.();

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <span className="text-xs font-semibold text-[var(--muted)]">Balance</span>
        <b className="font-mono text-3xl tabular-nums leading-none">{usdc === null ? "…" : `$${usdc}`}</b>
        <span className="text-xs text-[var(--muted)]">
          USDC on {CHAIN.name}
          {!GAS_SPONSORED && mon !== null ? ` · ${mon} MON for gas` : ""}
        </span>
      </div>

      <div className="grid gap-1.5">
        <button onClick={() => { onNavigate?.(); openAddMoney(); }} className="btn-base btn-small btn-primary w-full justify-center">
          <Plus size={14} /> Add money
        </button>
        <p className="text-xs text-[var(--muted)]">{`Your address as a QR code, and how to send USDC on ${CHAIN.name} to it.`}</p>
      </div>

      <div className="grid gap-0.5 border-t-[1.5px] border-[var(--soft)] pt-2">
        <Link href={`${me}?tab=bids`} onClick={go} className={ROW}><Gavel size={17} /> My bids</Link>
        <Link href={`${me}?tab=sponsoring`} onClick={go} className={ROW}><Stamp size={17} /> Patch NFTs</Link>
        <Link href="/automate" onClick={go} className={`${ROW} md:hidden`}><Bot size={17} /> Automate</Link>
        <Link href={`${me}?tab=campaigns`} onClick={go} className={`${ROW} md:hidden`}><Megaphone size={17} /> Campaigns</Link>
        <Link href={`${me}?tab=earnings`} onClick={go} className={`${ROW} md:hidden`}><LayoutDashboard size={17} /> Earnings</Link>
        <Link href="/settings" onClick={go} className={ROW}><Settings size={17} /> Settings</Link>
        {(isAdmin || OPEN_ADMIN) && <Link href="/admin" onClick={go} className={ROW}><ShieldHalf size={17} /> Admin</Link>}
        <button onClick={toggleTheme} className={ROW}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <a href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" className={ROW}>
          <ExternalLink size={17} /> Wallet on explorer
        </a>
      </div>

      <div className="grid gap-1.5 border-t-[1.5px] border-[var(--soft)] pt-2">
        <span className="eyebrow px-1">Network</span>
        <NetworkOptions onPick={go} />
      </div>

      <button onClick={() => { go(); void logout(); }} className={`${ROW} text-[var(--muted)]`}>
        <LogOut size={17} /> Sign out
      </button>
    </div>
  );
}
