"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatTimeAgo, formatUsdc } from "@/lib/format";
import { useAuthedFetch } from "@/lib/authedFetch";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  kind: string;
  payload: { listingId?: string; patchId?: number; amount?: string; refunded?: string; milestone?: number; price?: string; totalEscrow?: string };
  read_at: string | null;
  created_at: string;
}

const usd = (v?: string) => formatUsdc(Number(v ?? 0) / 1e6);

/** One sentence per notification kind (written by the indexer from chain events). */
function message(n: Row, patch: string, title: string): string {
  const p = n.payload;
  switch (n.kind) {
    case "outbid": return `You were outbid on ${patch} (${title}). ${usd(p.refunded)} is back in your wallet.`;
    case "new_bid": return `New bid of ${usd(p.amount)} on ${patch} (${title}).`;
    case "auto_bid": return `Auto-bid kept you on top of ${patch} at ${usd(p.amount)}.`;
    case "won": return `You won ${patch} on ${title}. Your receipt NFT is in your wallet.`;
    case "listing_live": return `${title} is live. Share it so brands start bidding.`;
    case "listing_rejected": return `${title} wasn't approved. Your bond was returned.`;
    case "bidding_closed": return `Bidding closed on ${title} with ${usd(p.totalEscrow)} in escrow. Time to print.`;
    case "proof_submitted": return `The creator posted proof for ${patch}. You have 72 hours to review it.`;
    case "disputed": return `A brand disputed ${patch} on ${title}. That payment is on hold for review.`;
    case "paid": return `You got paid ${usd(p.amount)} for ${title}.`;
    case "listing_failed": return `${title} missed a deadline. Your money for ${patch} was refunded.`;
    case "resale_sold": return `Your ${patch} patch sold for ${usd(p.price)}.`;
    case "bid_forwarded": return `Your bid on ${patch} couldn't be placed, so the money went back to your wallet.`;
    default: return "Something happened on one of your patches.";
  }
}

/** Bell with unread count; opens the latest notifications and marks them read. Updates live. */
export function NotificationBell() {
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const wallet = walletAddress?.toLowerCase();
  const [rows, setRows] = useState<Row[]>([]);
  const [labels, setLabels] = useState<Record<string, { patch: Record<number, string>; title: string; href: string }>>({});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!wallet) return;
    const db = supabase();
    const { data } = await db.from("notifications").select("id, kind, payload, read_at, created_at")
      .eq("chain_id", CHAIN_ID).eq("wallet", wallet).order("created_at", { ascending: false }).limit(20);
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = [...new Set(list.map((n) => n.payload.listingId).filter(Boolean))] as string[];
    if (!ids.length) return;
    const [{ data: patches }, { data: cards }] = await Promise.all([
      db.from("patches").select("listing_id, patch_id, label").eq("chain_id", CHAIN_ID).in("listing_id", ids),
      db.from("listing_cards").select("listing_id, metadata, creator, creator_handle").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    ]);
    const next: typeof labels = {};
    for (const id of ids) {
      const card = cards?.find((c) => String(c.listing_id) === id);
      const meta = card?.metadata as { title?: string; patches?: { id: number; name: string }[] } | null;
      const patch: Record<number, string> = {};
      for (const p of patches?.filter((x) => String(x.listing_id) === id) ?? []) {
        patch[p.patch_id] = meta?.patches?.find((m) => m.id === p.patch_id)?.name ?? p.label;
      }
      // Link straight to the canonical listing URL, /<creator handle or wallet>/<id>.
      next[id] = { patch, title: meta?.title ?? `listing #${id}`, href: `/${card?.creator_handle ?? card?.creator ?? "listing"}/${id}` };
    }
    setLabels(next);
  }, [wallet]);

  useEffect(() => {
    if (!wallet) return;
    void load();
    const channel = supabase()
      .channel(`notifications:${CHAIN_ID}:${wallet}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `wallet=eq.${wallet}` }, () => void load())
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [wallet, load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!wallet) return null;
  const unread = rows.filter((n) => !n.read_at).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      setRows((r) => r.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      authedFetch("/api/notifications", { method: "POST", body: "{}" }).catch(() => {});
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-xl border-2 border-[var(--line)] bg-[var(--card)] grid place-items-center shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)]"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-bold grid place-items-center border-2 border-[var(--card)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-32px))] card-surface p-2 z-50">
          <p className="px-2 py-1.5 font-bold">Notifications</p>
          {rows.length === 0 ? (
            <p className="px-2 pb-3 text-sm text-[var(--muted)]">Nothing yet. Bids, wins and payouts show up here.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {rows.map((n) => {
                const l = n.payload.listingId ? labels[n.payload.listingId] : undefined;
                const patch = n.payload.patchId !== undefined ? (l?.patch[n.payload.patchId] ?? `patch ${n.payload.patchId + 1}`) : "your patch";
                const text = message(n, patch, l?.title ?? (n.payload.listingId ? `listing #${n.payload.listingId}` : "your listing"));
                return (
                  <li key={n.id}>
                    <Link
                      href={l?.href ?? (n.payload.listingId ? `/listing/${n.payload.listingId}` : "/bids")}
                      onClick={() => setOpen(false)}
                      className={cn("block rounded-lg px-2 py-2 text-sm hover:bg-[var(--soft)]", !n.read_at && "bg-[var(--accent-soft)]")}
                    >
                      {text}
                      <span className="block text-xs text-[var(--muted)] mt-0.5">{formatTimeAgo(n.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
