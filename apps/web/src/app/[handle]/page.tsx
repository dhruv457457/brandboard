import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, serverClient } from "@/lib/config";
import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { supabase } from "@/lib/supabase";
import { CHAIN_ID } from "@/lib/config";
import { ProfileView, type PublicProfile, type SponsoredSpot } from "./ProfileView";

// Profiles are cached for 30s and rebuilt in the background; live bids still stream in over Realtime.
export const revalidate = 30;
/** No pages at build time: each one is rendered on its first visit, then cached. */
export async function generateStaticParams() {
  return [];
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();
  const db = supabase();
  const { data: profile } = isAddress(handle)
    ? await db.from("profiles").select("*").eq("wallet", handle).maybeSingle()
    : await db.from("profiles").select("*").eq("handle", handle).maybeSingle();

  const wallet = (profile?.wallet ?? (isAddress(handle) ? handle : null)) as `0x${string}` | null;
  if (!wallet) notFound();

  const [cards, rep, sponsoring] = await Promise.all([
    fetchListingCards({ creator: wallet, statuses: [1, 2, 3, 4] }),
    serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "reputation", args: [wallet] }),
    fetchSponsoring(wallet.toLowerCase()),
  ]);
  const [completed, failed, earned] = rep;

  const view: PublicProfile = {
    wallet,
    handle: profile?.handle ?? null,
    displayName: profile?.display_name ?? null,
    xHandle: profile?.x_handle ?? null,
    xVerified: Boolean(profile?.x_verified),
    xFollowers: profile?.x_followers ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    bio: profile?.bio ?? null,
    bannerColor: profile?.banner_color ?? "#FF5A1F",
    completed,
    failed,
    earned: earned.toString(),
    brandName: profile?.brand_name ?? null,
    brandLogo: profile?.brand_logo_url ?? null,
    brandVerified: profile?.brand_verified_domain ?? null,
  };
  return <ProfileView profile={view} cards={toWire(cards)} sponsoring={sponsoring} />;
}

/** Spots this wallet holds as a brand: won (it has the receipt) or leading a live auction. Public chain data. */
async function fetchSponsoring(wallet: string): Promise<SponsoredSpot[]> {
  const db = supabase();
  const [{ data: receipts }, { data: leading }] = await Promise.all([
    db.from("receipts").select("listing_id, patch_id").eq("chain_id", CHAIN_ID).eq("owner", wallet).limit(60),
    db.from("patches").select("listing_id, patch_id, top_bid").eq("chain_id", CHAIN_ID).eq("top_bidder", wallet).limit(60),
  ]);
  const ids = [...new Set([...(receipts ?? []), ...(leading ?? [])].map((r) => r.listing_id))];
  if (!ids.length) return [];
  const [{ data: cards }, { data: patches }] = await Promise.all([
    db.from("listing_cards").select("listing_id, status, bidding_ends_at, metadata, creator, creator_handle, creator_name, event_name").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    db.from("patches").select("listing_id, patch_id, label, top_bid").eq("chain_id", CHAIN_ID).in("listing_id", ids),
  ]);
  const won = new Set((receipts ?? []).map((r) => `${r.listing_id}:${r.patch_id}`));
  const keys = [...new Set([...(receipts ?? []), ...(leading ?? [])].map((r) => `${r.listing_id}:${r.patch_id}`))];
  return keys.flatMap((k) => {
    const [lid, pid] = k.split(":").map(Number);
    const card = cards?.find((c) => c.listing_id === lid);
    // A leading bid only counts while the auction is live; after that it's a receipt (won) or refunded.
    if (!card || (!won.has(k) && card.status !== 1)) return [];
    const meta = card.metadata as { title?: string; patches?: { id: number; name: string }[] } | null;
    const patch = patches?.find((p) => p.listing_id === lid && p.patch_id === pid);
    return [{
      listingId: lid,
      patchId: pid,
      label: meta?.patches?.find((m) => m.id === pid)?.name ?? patch?.label ?? `Spot ${pid + 1}`,
      title: meta?.title ?? card.event_name ?? `Listing #${lid}`,
      creator: card.creator_name ?? (card.creator_handle ? `@${card.creator_handle}` : `${card.creator.slice(0, 6)}…${card.creator.slice(-4)}`),
      event: card.event_name,
      href: `/${card.creator_handle ?? card.creator}/${lid}`,
      amount: Number(patch?.top_bid ?? 0) / 1e6,
      state: won.has(k) ? ("won" as const) : new Date(card.bidding_ends_at).getTime() < Date.now() ? ("winning" as const) : ("leading" as const),
    }];
  });
}
