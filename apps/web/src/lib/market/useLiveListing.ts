"use client";

import { useEffect, useRef, useState } from "react";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, publicClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import type { BidEvent, ListingView, LivePatch } from "./types";

export interface LiveBid extends BidEvent {
  label: string;
}

/**
 * Keeps a listing in sync with the chain: every BidPlaced / PatchBought / BiddingExtended /
 * BiddingClosed for this listing updates local state within ~2s while the tab is visible.
 * `onBid` fires for each new bid so the page can animate the patch.
 */
export function useLiveListing(initial: ListingView, onBid?: (bid: LiveBid, prevLeader: string | null) => void) {
  const [patches, setPatches] = useState<LivePatch[]>(initial.patches);
  const [bids, setBids] = useState<BidEvent[]>(initial.bids);
  const [endsAt, setEndsAt] = useState(initial.biddingEndsAt);
  const [status, setStatus] = useState(initial.status);
  const seen = useRef(new Set(initial.bids.map((b) => b.id)));
  const patchesRef = useRef(patches);
  patchesRef.current = patches;
  const onBidRef = useRef(onBid);
  onBidRef.current = onBid;

  useEffect(() => {
    const listingId = BigInt(initial.id);
    let unwatch: (() => void) | null = null;
    // Poll the chain only while the tab is visible: every open page polls the public RPC.
    const start = () => {
      unwatch ??= publicClient.watchContractEvent({
        address: MARKET,
        abi: patchedMarketAbi,
        poll: true,
        pollingInterval: 2000,
        onLogs: (logs) => {
          // Leaders as of this batch; several bids on one patch can arrive in the same poll.
          const leaders = new Map(patchesRef.current.map((p) => [p.id, p.topBidder]));
          for (const log of logs) {
            const args = log.args as Record<string, unknown>;
            if (args.listingId !== listingId) continue;
            const key = `${log.transactionHash}:${log.logIndex}`;

            if (log.eventName === "BidPlaced") {
              if (seen.current.has(key)) continue;
              seen.current.add(key);
              const patchId = Number(args.patchId);
              const current = patchesRef.current.find((p) => p.id === patchId);
              const prevLeader = leaders.get(patchId) ?? null;
              const bid: LiveBid = {
                id: key,
                patchId,
                bidder: (args.bidder as string).toLowerCase() as `0x${string}`,
                amount: args.amount as bigint,
                prevBidder: prevLeader,
                isBuyNow: false,
                time: Date.now(),
                label: current?.label ?? `Patch ${patchId}`,
              };
              setPatches((ps) =>
                ps.map((p) =>
                  p.id === patchId
                    ? { ...p, topBid: bid.amount, topBidder: bid.bidder, brandName: null, logoUrl: null, brandVerified: null }
                    : p,
                ),
              );
              setBids((bs) => [bid, ...bs].slice(0, 50));
              leaders.set(patchId, bid.bidder);
              onBidRef.current?.(bid, prevLeader);
              // Show the new leader's brand as soon as we know it.
              supabase().from("profiles").select("brand_name, brand_logo_url, brand_verified_domain").eq("wallet", bid.bidder).maybeSingle()
                .then(({ data }) => data && setBranding(patchId, data.brand_name, data.brand_logo_url, data.brand_verified_domain));
            } else if (log.eventName === "PatchBought") {
              const patchId = Number(args.patchId);
              setPatches((ps) => ps.map((p) => (p.id === patchId ? { ...p, bought: true } : p)));
              setBids((bs) => bs.map((b) => (b.id.startsWith(log.transactionHash!) ? { ...b, isBuyNow: true } : b)));
            } else if (log.eventName === "BiddingExtended") {
              setEndsAt(Number(args.newEndsAt) * 1000);
            } else if (log.eventName === "BiddingClosed") {
              setStatus(2);
            }
          }
        },
      });
    };
    const stop = () => {
      unwatch?.();
      unwatch = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [initial.id]);

  /** Apply brand name / logo for a patch after the leader saves it. */
  const setBranding = (patchId: number, brandName: string | null, logoUrl: string | null, brandVerified: string | null) =>
    setPatches((ps) => ps.map((p) => (p.id === patchId ? { ...p, brandName, logoUrl, brandVerified } : p)));

  return { patches, bids, endsAt, status, setBranding };
}
