"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatUsdc } from "@/lib/format";
import { useAuthedFetch } from "@/lib/authedFetch";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

export interface NotificationRow {
  id: string;
  kind: string;
  payload: { listingId?: string; patchId?: number; amount?: string; refunded?: string; milestone?: number; price?: string; totalEscrow?: string; reason?: string };
  read_at: string | null;
  created_at: string;
}

type Labels = Record<string, { patch: Record<number, string>; title: string; href: string }>;

const usd = (v?: string) => formatUsdc(Number(v ?? 0) / 1e6);

/** One sentence per notification kind (written by the indexer and keeper from chain events). */
function message(n: NotificationRow, patch: string, title: string): string {
  const p = n.payload;
  switch (n.kind) {
    case "outbid": return `You were outbid on ${patch} (${title}). ${usd(p.refunded)} is back in your wallet.`;
    case "new_bid": return `New bid of ${usd(p.amount)} on ${patch} (${title}).`;
    case "auto_bid": return `Auto-bid kept you on top of ${patch} at ${usd(p.amount)}.`;
    case "auto_bid_paused": return `Auto-bid on ${patch} is paused: ${p.reason === "allowance" ? "top up its spending permission" : "add funds to your wallet"} to keep bidding.`;
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

/** The sentence and the page a notification links to. */
export function describe(n: NotificationRow, labels: Labels): { text: string; href: string } {
  const l = n.payload.listingId ? labels[n.payload.listingId] : undefined;
  const patch = n.payload.patchId !== undefined ? (l?.patch[n.payload.patchId] ?? `patch ${n.payload.patchId + 1}`) : "your patch";
  const text = message(n, patch, l?.title ?? (n.payload.listingId ? `listing #${n.payload.listingId}` : "your listing"));
  return { text, href: l?.href ?? (n.payload.listingId ? `/listing/${n.payload.listingId}` : "/bids") };
}

/** The signed-in wallet's latest notifications, updated live, with a way to mark them all read. */
export function useNotifications(limit: number) {
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const wallet = walletAddress?.toLowerCase();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [labels, setLabels] = useState<Labels>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) return;
    const db = supabase();
    const { data } = await db.from("notifications").select("id, kind, payload, read_at, created_at")
      .eq("chain_id", CHAIN_ID).eq("wallet", wallet).order("created_at", { ascending: false }).limit(limit);
    const list = (data ?? []) as NotificationRow[];
    setRows(list);
    setLoaded(true);
    const ids = [...new Set(list.map((n) => n.payload.listingId).filter(Boolean))] as string[];
    if (!ids.length) return;
    const [{ data: patches }, { data: cards }] = await Promise.all([
      db.from("patches").select("listing_id, patch_id, label").eq("chain_id", CHAIN_ID).in("listing_id", ids),
      db.from("listing_cards").select("listing_id, metadata, creator, creator_handle").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    ]);
    const next: Labels = {};
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
  }, [wallet, limit]);

  useEffect(() => {
    if (!wallet) return;
    void load();
    const channel = supabase()
      .channel(`notifications:${CHAIN_ID}:${wallet}:${limit}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `wallet=eq.${wallet}` }, () => void load())
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [wallet, load, limit]);

  const unread = rows.filter((n) => !n.read_at).length;
  const markAllRead = useCallback(() => {
    if (!rows.some((n) => !n.read_at)) return;
    setRows((r) => r.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    authedFetch("/api/notifications", { method: "POST", body: "{}" }).catch(() => {});
  }, [rows, authedFetch]);

  return { wallet, rows, labels, loaded, unread, markAllRead };
}
