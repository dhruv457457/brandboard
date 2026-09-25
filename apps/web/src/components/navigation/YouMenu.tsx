"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, Check, Copy, ExternalLink, Gavel, LayoutDashboard, LogOut, Plus, Settings, Settings2, Share2, ShieldCheck,
  ShieldHalf, Tag, UserRound,
} from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { useBalances } from "@/lib/useBalances";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { CHAIN_ID, EXPLORER } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress } from "@/lib/format";
import { NetworkOptions } from "./NetworkSwitch";
import { SHAREABLE } from "@/lib/market/listingStatus";

interface MyListing {
  id: number;
  title: string;
  status: number;
  href: string;
}

/** Your latest listings, for quick access to each one's page, manage and share screens. */
function useMyListings(wallet?: string) {
  const [rows, setRows] = useState<MyListing[]>([]);
  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    supabase()
      .from("listing_cards")
      .select("listing_id, status, metadata, creator, creator_handle")
      .eq("chain_id", CHAIN_ID)
      .eq("creator", wallet.toLowerCase())
      .order("created_block", { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (!alive) return;
        setRows((data ?? []).map((r) => ({
          id: r.listing_id,
          title: (r.metadata as { title?: string } | null)?.title ?? `Listing #${r.listing_id}`,
          status: r.status,
          href: `/${r.creator_handle ?? r.creator}/${r.listing_id}`,
        })));
      });
    return () => {
      alive = false;
    };
  }, [wallet]);
  return rows;
}

const LINK = "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold bg-[var(--soft)] hover:bg-[var(--accent-soft)] no-underline";

/**
 * Everything that belongs to you, in one place: balances, your listings and their tools, your bids, account
 * pages, the network and admin. The desktop account menu and the phone "You" tab both show this.
 */
export function YouMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { walletAddress, xHandle, logout } = usePatchedAuth();
  const { profile } = useProfile();
  const { usdc, mon } = useBalances(walletAddress);
  const isAdmin = useIsAdmin(walletAddress);
  const listings = useMyListings(walletAddress);
  const [copied, setCopied] = useState(false);
  const me = profile?.handle ?? walletAddress?.toLowerCase() ?? "";
  const go = () => onNavigate?.();

  async function copy() {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the address is shown in full in Settings */
    }
  }

  return (
    <div className="grid gap-4">
      {/* Who you are and what you can spend */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="grid min-w-0">
            <b className="truncate">{profile?.display_name ?? (xHandle ? `@${xHandle}` : profile?.handle ? `@${profile.handle}` : "Your account")}</b>
            <span className="font-mono text-xs text-[var(--muted)]">{formatShortAddress(walletAddress)}</span>
          </span>
          <span className="flex gap-1.5 flex-none">
            <button onClick={copy} className="btn-base btn-small" aria-label="Copy wallet address">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <a className="btn-base btn-small btn-ghost" href={`${EXPLORER}/address/${walletAddress}`} target="_blank" rel="noopener noreferrer" aria-label="Open in explorer">
              <ExternalLink size={13} />
            </a>
          </span>
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
      </div>

      {/* Creator */}
      <section className="grid gap-1.5">
        <span className="eyebrow">As a creator</span>
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/dashboard" onClick={go} className={LINK}><LayoutDashboard size={15} /> Dashboard</Link>
          <Link href="/studio" onClick={go} className={LINK}><Plus size={15} /> New listing</Link>
        </div>
        {listings.length > 0 && (
          <ul className="grid gap-1">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center gap-1 rounded-lg border-[1.5px] border-[var(--soft)] pl-2.5 pr-1 py-1">
                <Link href={l.href} onClick={go} className="text-sm font-semibold truncate flex-1 no-underline">{l.title}</Link>
                <Link href={`/studio/${l.id}`} onClick={go} className="p-1.5 rounded-md hover:bg-[var(--soft)]" aria-label={`Manage ${l.title}`} title="Manage"><Settings2 size={15} /></Link>
                {SHAREABLE.has(l.status) && (
                  <Link href={`/share/${l.id}`} onClick={go} className="p-1.5 rounded-md hover:bg-[var(--soft)]" aria-label={`Share ${l.title}`} title="Share kit"><Share2 size={15} /></Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Brand */}
      <section className="grid gap-1.5">
        <span className="eyebrow">As a brand</span>
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/bids" onClick={go} className={LINK}><Gavel size={15} /> My bids</Link>
          <Link href="/settings?tab=brand" onClick={go} className={LINK}><Tag size={15} /> Brand profile</Link>
        </div>
      </section>

      {/* Account */}
      <section className="grid gap-1.5">
        <span className="eyebrow">Account</span>
        <div className="grid grid-cols-2 gap-1.5">
          <Link href={`/${me}`} onClick={go} className={LINK}><UserRound size={15} /> My page</Link>
          <Link href="/notifications" onClick={go} className={LINK}><Bell size={15} /> Notifications</Link>
          <Link href="/settings" onClick={go} className={LINK}><Settings size={15} /> Settings</Link>
          <Link href="/settings?tab=security" onClick={go} className={LINK}><ShieldCheck size={15} /> Security</Link>
          {isAdmin && <Link href="/admin" onClick={go} className={LINK}><ShieldHalf size={15} /> Admin</Link>}
        </div>
      </section>

      <section className="grid gap-1.5">
        <span className="eyebrow">Network</span>
        <NetworkOptions onPick={go} />
      </section>

      <button onClick={() => { go(); void logout(); }} className="btn-base btn-small btn-ghost justify-self-start">
        <LogOut size={13} /> Sign out
      </button>
    </div>
  );
}
