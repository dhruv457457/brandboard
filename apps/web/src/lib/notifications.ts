"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { listingViews } from "@patched/shared";
import { useAuthedFetch } from "@/lib/authedFetch";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

export interface NotificationRow {
  id: string;
  kind: string;
  tx_hash?: string | null;
  payload: { listingId?: string; patchId?: number; amount?: string; refunded?: string; milestone?: number; price?: string; totalEscrow?: string; reason?: string; by?: string; photo?: string; caption?: string };
  read_at: string | null;
  created_at: string;
}

type Labels = Record<string, { patch: Record<number, string>; title: string; href: string; image?: string | null }>;
/** Who made the bid behind a notification (by its transaction): their brand or display name and logo. */
export type Actors = Record<string, { name: string | null; logo: string | null; wallet: string }>;

const usd = (v?: string) => formatUsdc(Number(v ?? 0) / 1e6);

/** One sentence per notification kind (written by the indexer and keeper from chain events). */
function message(n: NotificationRow, patch: string, title: string, actor?: string | null): string {
  const p = n.payload;
  switch (n.kind) {
    case "outbid": return `${actor ? `${actor} outbid you` : "You were outbid"} on ${patch} (${title}). ${usd(p.refunded)} is back in your wallet.`;
    case "new_bid": return `${actor ? `${actor} bid` : "New bid of"} ${usd(p.amount)} on ${patch} (${title}).`;
    case "auto_bid": return `Auto-bid kept you on top of ${patch} at ${usd(p.amount)}.`;
    case "auto_bid_paused": return `Auto-bid on ${patch} is paused: ${p.reason === "allowance" ? "top up its spending permission" : "add funds to your wallet"} to keep bidding.`;
    case "won": return `You won ${patch} on ${title}. Your patch NFT is live and updates as the creator delivers.`;
    case "listing_live": return `${title} is live. Share it so brands start bidding.`;
    case "listing_rejected": return `${title} wasn't approved. Your bond was returned.`;
    case "bidding_closed": return `Bidding closed on ${title} with ${usd(p.totalEscrow)} in escrow. Time to print.`;
    case "proof_submitted": return `The creator posted proof for ${patch}. Approve it, or dispute it before the review ends.`;
    case "proof_approved": return `A brand approved your proof for ${patch} on ${title}.`;
    case "disputed": return `A brand disputed ${patch} on ${title}. That payment is on hold for review.`;
    case "paid": return `You got paid ${usd(p.amount)} for ${title}.`;
    case "listing_failed": return `${title} missed a deadline. Your money for ${patch} was refunded.`;
    case "resale_sold": return `Your ${patch} patch sold for ${usd(p.price)}.`;
    case "spotted": return `${p.by ?? "Someone"} spotted you${title ? ` (${title})` : ""}${p.caption ? `: ${p.caption}` : "."}`;
    case "bid_forwarded": return `Your bid on ${patch} couldn't be placed, so the money went back to your wallet.`;
    default: return "Something happened on one of your patches.";
  }
}

/** The sentence and the page a notification links to. */
export function describe(n: NotificationRow, labels: Labels, actors: Actors = {}): { text: string; href: string; image: string | null; actor: Actors[string] | null; amount: string | null } {
  const l = n.payload.listingId ? labels[n.payload.listingId] : undefined;
  const patch = n.payload.patchId !== undefined ? (l?.patch[n.payload.patchId] ?? `patch ${n.payload.patchId + 1}`) : "your patch";
  const actor = n.tx_hash ? (actors[n.tx_hash] ?? null) : null;
  const text = message(n, patch, l?.title ?? (n.payload.listingId ? `listing #${n.payload.listingId}` : "your listing"), actor?.name);
  const p = n.payload;
  const raw = n.kind === "outbid" ? p.refunded : n.kind === "resale_sold" ? p.price : n.kind === "bidding_closed" ? p.totalEscrow : p.amount;
  // Winning, and a refund after a miss, are about the patch NFT: open its page. Everything else opens the listing.
  const nft = (n.kind === "won" || n.kind === "listing_failed") && p.listingId && p.patchId !== undefined ? `/patch/${(BigInt(p.listingId) << 8n) | BigInt(p.patchId)}` : null;
  return { text, href: nft ?? l?.href ?? (n.payload.listingId ? `/listing/${n.payload.listingId}` : "/bids"), image: (n.kind === "spotted" && p.photo ? p.photo : l?.image) ?? null, actor, amount: raw ? usd(raw) : null };
}

/** The signed-in wallet's latest notifications, updated live, with a way to mark them all read. */
export function useNotifications(limit: number) {
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const wallet = walletAddress?.toLowerCase();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [labels, setLabels] = useState<Labels>({});
  const [actors, setActors] = useState<Actors>({});
  const [loaded, setLoaded] = useState(false);
  // Several components can use this at once (the sidebar and the phone tab bar). Supabase hands back the same
  // channel for the same name, and a channel that's already subscribed can't take another listener, so each
  // caller gets its own channel.
  const instance = useId();

  const load = useCallback(async () => {
    if (!wallet) return;
    const db = supabase();
    const { data } = await db.from("notifications").select("id, kind, payload, read_at, created_at, tx_hash")
      .eq("chain_id", CHAIN_ID).eq("wallet", wallet).order("created_at", { ascending: false }).limit(limit);
    const list = (data ?? []) as NotificationRow[];
    setRows(list);
    setLoaded(true);
    const ids = [...new Set(list.map((n) => n.payload.listingId).filter(Boolean))] as string[];
    // The bidder behind bid notifications, so a row can say "Alice outbid you" with Alice's logo.
    const hashes = [...new Set(list.filter((n) => (n.kind === "outbid" || n.kind === "new_bid") && n.tx_hash).map((n) => n.tx_hash!))];
    if (hashes.length) {
      void (async () => {
        const { data: bids } = await db.from("bids").select("tx_hash, bidder").eq("chain_id", CHAIN_ID).in("tx_hash", hashes);
        const wallets = [...new Set((bids ?? []).map((b) => b.bidder))];
        const { data: people } = wallets.length
          ? await db.from("profiles").select("wallet, brand_name, display_name, handle, brand_logo_url, avatar_url").in("wallet", wallets)
          : { data: [] };
        const next: Actors = {};
        for (const b of bids ?? []) {
          const who = people?.find((x) => x.wallet === b.bidder);
          // No profile yet: the short wallet address, so the row still says who it was.
          next[b.tx_hash] = { name: who?.brand_name ?? who?.display_name ?? (who?.handle ? `@${who.handle}` : formatShortAddress(b.bidder)), logo: who?.brand_logo_url ?? who?.avatar_url ?? null, wallet: b.bidder };
        }
        setActors(next);
      })();
    }
    if (!ids.length) return;
    const [{ data: patches }, { data: cards }] = await Promise.all([
      db.from("patches").select("listing_id, patch_id, label").eq("chain_id", CHAIN_ID).in("listing_id", ids),
      db.from("listing_cards").select("listing_id, metadata, creator, creator_handle").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    ]);
    const next: Labels = {};
    for (const id of ids) {
      const card = cards?.find((c) => String(c.listing_id) === id);
      const meta = card?.metadata as ({ title?: string; patches?: { id: number; name: string }[] } & Parameters<typeof listingViews>[0]) | null;
      const patch: Record<number, string> = {};
      for (const p of patches?.filter((x) => String(x.listing_id) === id) ?? []) {
        patch[p.patch_id] = meta?.patches?.find((m) => m.id === p.patch_id)?.name ?? p.label;
      }
      // Link straight to the canonical listing URL, /<creator handle or wallet>/<id>.
      next[id] = { patch, title: meta?.title ?? `listing #${id}`, href: `/${card?.creator_handle ?? card?.creator ?? "listing"}/${id}`, image: listingViews(meta)[0]?.image ?? null };
    }
    setLabels(next);
  }, [wallet, limit]);

  useEffect(() => {
    if (!wallet) return;
    void load();
    const channel = supabase()
      .channel(`notifications:${CHAIN_ID}:${wallet}:${limit}:${instance}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `wallet=eq.${wallet}` }, () => void load())
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [wallet, load, limit, instance]);

  const unread = rows.filter((n) => !n.read_at).length;
  const markAllRead = useCallback(() => {
    if (!rows.some((n) => !n.read_at)) return;
    setRows((r) => r.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    authedFetch("/api/notifications", { method: "POST", body: "{}" }).catch(() => {});
  }, [rows, authedFetch]);

  return { wallet, rows, labels, actors, loaded, unread, markAllRead };
}
