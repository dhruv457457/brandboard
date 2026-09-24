import "server-only";
import { hexToString } from "viem";
import { listingViews, patchedMarketAbi, type ListingMetadata } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { parseDisputeReason, type DisputeReason } from "./dispute";
import { supabase } from "@/lib/supabase";
import { slotFor } from "./layouts";
import { defaultTiers } from "./tiers";
import { sanitizePage, type PageAccent } from "./page";
import { SURFACES, type BidEvent, type ListingView, type LivePatch } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000";
const b32 = (v: `0x${string}`) => {
  try {
    return hexToString(v, { size: 32 }).replace(/\0+$/, "");
  } catch {
    return "";
  }
};

/**
 * Current state of one listing. Auction state comes straight from the contract (never stale);
 * presentation and history come from Supabase.
 */
/** Market-wide bid step settings; they change rarely, so cache them for a minute. */
let stepCache: { at: number; value: Promise<readonly [bigint, number]> } | null = null;
function bidStep() {
  if (!stepCache || Date.now() - stepCache.at > 60_000) {
    const client = serverClient();
    stepCache = {
      at: Date.now(),
      value: Promise.all([
        client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minIncrement" }),
        client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minIncrementBps" }),
      ]).catch((err) => {
        stepCache = null;
        throw err;
      }),
    };
  }
  return stepCache.value;
}

export async function fetchListingView(id: number): Promise<ListingView | null> {
  const client = serverClient();
  const db = supabase();
  // One parallel round: authoritative numbers from the chain, everything else from the indexed database.
  const [L, patches, [minIncrement, minIncrementBps], card, bids, logos, pageRow] = await Promise.all([
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getListing", args: [BigInt(id)] }),
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getPatches", args: [BigInt(id)] }),
    bidStep(),
    db.from("listing_cards").select("metadata, metadata_hash, creator_handle, creator_name, creator_verified, creator_avatar, creator_bio, event_name, event_starts_at, event_city")
      .eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle(),
    db.from("bids").select("tx_hash, log_index, patch_id, bidder, amount, prev_bidder, is_buy_now, block_time")
      .eq("chain_id", CHAIN_ID).eq("listing_id", id).order("block_number", { ascending: false }).limit(30),
    db.from("patch_brands").select("top_bidder, brand_name, brand_logo_url, brand_verified_domain").eq("chain_id", CHAIN_ID).eq("listing_id", id),
    db.from("listing_pages").select("page").eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle(),
  ]);
  if (L.creator === ZERO) return null;

  // Brand-new listing the indexer hasn't mirrored yet: fall back to a direct metadata lookup.
  let row = card.data;
  if (!row || row.metadata_hash !== L.metadataHash) {
    const meta = await db.from("listing_metadata").select("metadata").eq("metadata_hash", L.metadataHash).maybeSingle();
    row = {
      ...(row ?? { creator_handle: null, creator_name: null, creator_verified: false, creator_avatar: null, creator_bio: null, event_name: null, event_starts_at: null, event_city: null }),
      metadata: meta.data?.metadata ?? null,
      metadata_hash: L.metadataHash,
    };
  }
  const profile = { data: { handle: row.creator_handle, display_name: row.creator_name, x_verified: row.creator_verified } };
  const event = { data: row.event_name ? { name: row.event_name } : null };
  const meta = { data: { metadata: row.metadata } };

  const metadata = (meta.data?.metadata ?? null) as ListingMetadata | null;
  const views = listingViews(metadata);
  const surface = SURFACES[L.surface] ?? "outfit";

  const tiers = defaultTiers(patches.map((_, i) => {
    const m = metadata?.patches.find((x) => x.id === i);
    return m ? m.w * m.h : 0;
  }));
  const livePatches: LivePatch[] = patches.map((p, i) => {
    const label = b32(p.label);
    const pos = metadata?.patches.find((m) => m.id === i);
    const slot = slotFor(surface, i, label, pos ? { name: pos.name, x: pos.x, y: pos.y, w: pos.w, h: pos.h, r: pos.rotation } : null);
    const leader = p.topBidder === ZERO ? null : (p.topBidder.toLowerCase() as `0x${string}`);
    const brand = leader ? logos.data?.find((l) => l.top_bidder === leader) : undefined;
    return {
      id: i,
      label: pos?.name ?? label,
      floor: p.floor,
      buyNow: p.buyNow,
      topBid: p.topBid,
      topBidder: leader,
      bought: p.bought,
      side: pos?.side ?? views[0]?.id ?? "front",
      tier: pos?.tier ?? tiers[i],
      perks: pos?.perks ?? null,
      x: slot.x, y: slot.y, w: slot.w, h: slot.h, r: slot.r ?? 0,
      brandName: brand?.brand_name ?? null,
      logoUrl: brand?.brand_logo_url ?? null,
      brandVerified: brand?.brand_verified_domain ?? null,
    };
  });

  const bidEvents: BidEvent[] = (bids.data ?? []).map((b) => ({
    id: `${b.tx_hash}:${b.log_index}`,
    patchId: b.patch_id,
    bidder: b.bidder,
    amount: BigInt(b.amount),
    prevBidder: b.prev_bidder,
    isBuyNow: b.is_buy_now,
    time: new Date(b.block_time).getTime(),
  }));

  return {
    chainId: CHAIN_ID,
    id,
    creator: L.creator.toLowerCase() as `0x${string}`,
    creatorHandle: profile.data?.handle ?? null,
    creatorName: profile.data?.display_name ?? null,
    creatorVerified: Boolean(profile.data?.x_verified),
    creatorAvatar: row.creator_avatar ?? null,
    creatorBio: row.creator_bio ?? null,
    eventStartsAt: row.event_starts_at ? new Date(row.event_starts_at).getTime() : null,
    eventCity: row.event_city ?? null,
    surface,
    status: L.status,
    eventId: L.eventId,
    eventName: (event.data as { name?: string } | null)?.name ?? null,
    biddingEndsAt: L.biddingEndsAt * 1000,
    hardEndsAt: L.hardEndsAt * 1000,
    bond: L.bond,
    minIncrement,
    minIncrementBps,
    milestoneBps: L.milestoneBps.slice(0, L.milestoneCount),
    deadlines: L.deadlines.slice(0, L.milestoneCount).map((d) => d * 1000),
    title: metadata?.title ?? `${surface === "car" ? "Car" : surface === "hoodie" ? "Team hoodie" : "Outfit"} #${id}`,
    canvasImage: metadata?.canvasImage ?? null,
    canvasImageBack: metadata?.canvasImageBack ?? null,
    views,
    page: sanitizePage(pageRow.data?.page, patches.length),
    patches: livePatches,
    bids: bidEvents,
    metadata,
  };
}

export interface ListingCard {
  id: number;
  href: string;
  title: string;
  surface: (typeof SURFACES)[number];
  status: number;
  creatorLabel: string;
  eventName: string | null;
  biddingEndsAt: number;
  patchCount: number;
  patchesWithBids: number;
  topBidsTotal: bigint;
  canvasImage: string | null;
  /** Id of the view canvasImage shows; cards only draw that view's patches. */
  viewId: string;
  patches: LivePatch[];
  creatorHandle: string | null;
  creatorAvatar: string | null;
  creatorVerified: boolean;
  /** The creator's headline: page layer first, then the listing metadata. */
  headline: string | null;
  /** Page colour the creator picked (orange when never set). */
  accent: PageAccent;
  createdBlock: number;
}

/** Listings for Explore / profiles, from the indexed tables. Newest first. */
export async function fetchListingCards(opts: { creator?: string; limit?: number; statuses?: number[]; eventId?: number } = {}): Promise<ListingCard[]> {
  const db = supabase();
  let q = db
    .from("listing_cards")
    .select("listing_id, creator, creator_handle, creator_name, creator_avatar, creator_verified, surface, status, bidding_ends_at, patch_count, patches_with_bids, top_bids_total, metadata, event_name, created_block")
    .eq("chain_id", CHAIN_ID)
    .in("status", opts.statuses ?? [1, 2, 3])
    .order("created_block", { ascending: false })
    .limit(opts.limit ?? 60);
  if (opts.creator) q = q.eq("creator", opts.creator.toLowerCase());
  if (opts.eventId !== undefined) q = q.eq("event_id", opts.eventId);
  const { data: rows, error } = await q;
  if (error || !rows?.length) return [];

  // Patches with their leader's brand (patch_brands view), and each creator's page layer, in parallel.
  const ids = rows.map((r) => r.listing_id);
  const [{ data: patchRows }, { data: pages }] = await Promise.all([
    db
      .from("patch_brands")
      .select("listing_id, patch_id, label, floor, buy_now, top_bid, top_bidder, bought, brand_name, brand_logo_url, brand_verified_domain")
      .eq("chain_id", CHAIN_ID)
      .in("listing_id", ids)
      .order("patch_id"),
    db.from("listing_pages").select("listing_id, page").eq("chain_id", CHAIN_ID).in("listing_id", ids),
  ]);

  return rows.map((r) => {
    const surface = SURFACES[r.surface] ?? "outfit";
    const metadata = r.metadata as ListingMetadata | null;
    const patches: LivePatch[] = (patchRows ?? [])
      .filter((p) => p.listing_id === r.listing_id)
      .map((p) => {
        const pos = metadata?.patches.find((m) => m.id === p.patch_id);
        const tiers = defaultTiers((metadata?.patches ?? []).map((m) => m.w * m.h));
        const slot = slotFor(surface, p.patch_id, p.label, pos ? { name: pos.name, x: pos.x, y: pos.y, w: pos.w, h: pos.h, r: pos.rotation } : null);
        return {
          id: p.patch_id, label: pos?.name ?? p.label,
          floor: BigInt(p.floor), buyNow: BigInt(p.buy_now), topBid: BigInt(p.top_bid),
          topBidder: p.top_bidder, bought: p.bought, side: pos?.side ?? listingViews(metadata)[0]?.id ?? "front",
          tier: pos?.tier ?? tiers[p.patch_id] ?? "prime", perks: pos?.perks ?? null,
          x: slot.x, y: slot.y, w: slot.w, h: slot.h, r: slot.r ?? 0,
          brandName: p.brand_name ?? null,
          logoUrl: p.brand_logo_url ?? null,
          brandVerified: p.brand_verified_domain ?? null,
        };
      });
    const handle = r.creator_handle as string | null;
    const page = sanitizePage(pages?.find((x) => x.listing_id === r.listing_id)?.page, r.patch_count);
    return {
      id: r.listing_id,
      href: `/${handle ?? r.creator}/${r.listing_id}`,
      title: metadata?.title ?? r.event_name ?? `${surface === "car" ? "Car" : surface === "hoodie" ? "Team hoodie" : "Outfit"} #${r.listing_id}`,
      surface,
      status: r.status,
      creatorLabel: r.creator_name ?? (handle ? `@${handle}` : `${r.creator.slice(0, 6)}…${r.creator.slice(-4)}`),
      eventName: r.event_name,
      biddingEndsAt: new Date(r.bidding_ends_at).getTime(),
      patchCount: r.patch_count,
      patchesWithBids: Number(r.patches_with_bids),
      topBidsTotal: BigInt(r.top_bids_total),
      canvasImage: listingViews(metadata)[0]?.image ?? metadata?.canvasImage ?? null,
      viewId: listingViews(metadata)[0]?.id ?? "front",
      patches,
      creatorHandle: handle,
      creatorAvatar: (r.creator_avatar as string | null) ?? null,
      creatorVerified: Boolean(r.creator_verified),
      headline: page.headline ?? metadata?.headline ?? null,
      accent: page.accent ?? "orange",
      createdBlock: Number(r.created_block),
    };
  });
}

export interface MilestoneView {
  idx: number;
  name: string;
  bps: number;
  deadline: number;
  status: number; // 0 open, 1 submitted, 2 released
  reviewEndsAt: number | null;
  disputedMask: number;
  resolvedMask: number;
  proof: { files: string[]; note: string | null } | null;
}

export interface DeliveryView {
  nextMilestone: number;
  totalEscrow: bigint;
  milestones: MilestoneView[];
  payouts: { kind: string; milestone: number | null; amount: bigint; fee: bigint; time: number; tx: string }[];
  receipts: { patchId: number; owner: string; amount: bigint }[];
  disputes: { milestone: number; patchId: number; holder: string; reason: string; resolved: boolean; toCreator: bigint | null; toHolder: bigint | null }[];
}

/** Everything about the post-bidding phase of a listing (milestones, proofs, payouts, winners, disputes). */
export async function fetchDelivery(id: number, metadata: ListingMetadata | null): Promise<DeliveryView> {
  const db = supabase();
  const [listing, ms, proofs, payouts, receipts, patches, disputes] = await Promise.all([
    db.from("listings").select("next_milestone, total_escrow").eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle(),
    db.from("milestones").select("*").eq("chain_id", CHAIN_ID).eq("listing_id", id).order("idx"),
    db.from("proof_files").select("milestone, files, note").eq("chain_id", CHAIN_ID).eq("listing_id", id),
    db.from("payouts").select("kind, milestone, amount, fee, block_time, tx_hash").eq("chain_id", CHAIN_ID).eq("listing_id", id).order("block_time"),
    db.from("receipts").select("patch_id, owner").eq("chain_id", CHAIN_ID).eq("listing_id", id),
    db.from("patches").select("patch_id, top_bid").eq("chain_id", CHAIN_ID).eq("listing_id", id),
    db.from("disputes").select("*").eq("chain_id", CHAIN_ID).eq("listing_id", id),
  ]);
  return {
    nextMilestone: listing.data?.next_milestone ?? 0,
    totalEscrow: BigInt(listing.data?.total_escrow ?? 0),
    milestones: (ms.data ?? []).map((m) => {
      const p = proofs.data?.find((x) => x.milestone === m.idx);
      return {
        idx: m.idx,
        name: metadata?.milestones[m.idx]?.name ?? `Milestone ${m.idx + 1}`,
        bps: m.bps,
        deadline: new Date(m.deadline).getTime(),
        status: m.status,
        reviewEndsAt: m.review_ends_at ? new Date(m.review_ends_at).getTime() : null,
        disputedMask: m.disputed_mask,
        resolvedMask: m.resolved_mask,
        proof: p ? { files: p.files as string[], note: p.note } : null,
      };
    }),
    payouts: (payouts.data ?? []).map((p) => ({
      kind: p.kind, milestone: p.milestone, amount: BigInt(p.amount), fee: BigInt(p.fee), time: new Date(p.block_time).getTime(), tx: p.tx_hash,
    })),
    receipts: (receipts.data ?? []).map((r) => ({
      patchId: r.patch_id, owner: r.owner, amount: BigInt(patches.data?.find((p) => p.patch_id === r.patch_id)?.top_bid ?? 0),
    })),
    disputes: (disputes.data ?? []).map((d) => ({
      milestone: d.milestone, patchId: d.patch_id, holder: d.holder, reason: d.reason_uri ?? "", resolved: d.resolved,
      toCreator: d.to_creator === null ? null : BigInt(d.to_creator), toHolder: d.to_holder === null ? null : BigInt(d.to_holder),
    })),
  };
}

export interface AdminReviewItem {
  listingId: number;
  title: string;
  milestone: number;
  milestoneName: string;
  reviewEndsAt: number | null;
  proof: { files: string[]; note: string | null } | null;
  disputes: { patchId: number; label: string; holder: string; reason: DisputeReason }[];
}

/** Proofs under review and unresolved disputes, for the admin console. */
export async function fetchAdminReview(): Promise<AdminReviewItem[]> {
  const db = supabase();
  const [{ data: submitted }, { data: open }] = await Promise.all([
    db.from("milestones").select("listing_id, idx, review_ends_at").eq("chain_id", CHAIN_ID).eq("status", 1),
    db.from("disputes").select("listing_id, milestone, patch_id, holder, reason_uri").eq("chain_id", CHAIN_ID).eq("resolved", false),
  ]);
  const keys = new Map<string, { listingId: number; milestone: number; reviewEndsAt: string | null }>();
  for (const m of submitted ?? []) keys.set(`${m.listing_id}:${m.idx}`, { listingId: m.listing_id, milestone: m.idx, reviewEndsAt: m.review_ends_at });
  for (const d of open ?? []) {
    const k = `${d.listing_id}:${d.milestone}`;
    if (!keys.has(k)) keys.set(k, { listingId: d.listing_id, milestone: d.milestone, reviewEndsAt: null });
  }
  if (!keys.size) return [];

  const ids = [...new Set([...keys.values()].map((k) => k.listingId))];
  const [{ data: cards }, { data: proofs }, { data: patches }] = await Promise.all([
    db.from("listing_cards").select("listing_id, metadata").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    db.from("proof_files").select("listing_id, milestone, files, note").eq("chain_id", CHAIN_ID).in("listing_id", ids),
    db.from("patches").select("listing_id, patch_id, label").eq("chain_id", CHAIN_ID).in("listing_id", ids),
  ]);
  return [...keys.values()].map((k) => {
    const meta = cards?.find((c) => c.listing_id === k.listingId)?.metadata as ListingMetadata | null;
    const proof = proofs?.find((p) => p.listing_id === k.listingId && p.milestone === k.milestone);
    return {
      listingId: k.listingId,
      title: meta?.title ?? `Listing #${k.listingId}`,
      milestone: k.milestone,
      milestoneName: meta?.milestones[k.milestone]?.name ?? `Milestone ${k.milestone + 1}`,
      reviewEndsAt: k.reviewEndsAt ? new Date(k.reviewEndsAt).getTime() : null,
      proof: proof ? { files: proof.files as string[], note: proof.note } : null,
      disputes: (open ?? [])
        .filter((d) => d.listing_id === k.listingId && d.milestone === k.milestone)
        .map((d) => ({
          patchId: d.patch_id,
          label:
            meta?.patches.find((p) => p.id === d.patch_id)?.name ??
            patches?.find((p) => p.listing_id === k.listingId && p.patch_id === d.patch_id)?.label ??
            `Patch ${d.patch_id}`,
          holder: d.holder,
          reason: parseDisputeReason(d.reason_uri),
        })),
    };
  });
}
