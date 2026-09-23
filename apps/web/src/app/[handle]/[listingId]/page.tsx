"use client";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Eye,
  Lock,
  Radio,
  Upload,
  Zap,
} from "lucide-react";
import { getListing } from "@/lib/data";
import { ListingRecord } from "@/lib/data/types";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { PatchData, PatchHandle } from "@/components/surface/Patch";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountInput } from "@/components/ui/AmountInput";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { formatCountdown, formatTimeAgo, formatUsdc, parseUsdc } from "@/lib/format";
import { useListingLive } from "@/lib/live/useListingLive";
import { auctionEventBus } from "@/lib/live/eventBus";
import { useBid, useBuyNow } from "@/lib/chain";
import { AuroraIntentModal } from "@/components/chain/AuroraIntentModal";

interface PageProps {
  params: Promise<{
    handle: string;
    listingId: string;
  }>;
}

function launchConfetti(el: HTMLElement | null) {
  if (!el || typeof window === "undefined") return;
  const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (isReduced) return;

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const cols = [
    "var(--p1)",
    "var(--p2)",
    "var(--p3)",
    "var(--p4)",
    "var(--p5)",
    "var(--accent)",
  ];

  for (let i = 0; i < 28; i++) {
    const c = document.createElement("div");
    c.style.position = "fixed";
    c.style.zIndex = "999";
    c.style.pointerEvents = "none";
    c.style.width = "14px";
    c.style.height = "10px";
    c.style.borderRadius = "3px";
    c.style.border = "1.5px solid #0B0B0C";
    c.style.background = cols[i % cols.length];
    c.style.left = `${cx}px`;
    c.style.top = `${cy}px`;
    document.body.appendChild(c);

    const a = Math.random() * Math.PI * 2;
    const d = 80 + Math.random() * 140;

    c.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)" },
        {
          transform: `translate(${Math.cos(a) * d}px, ${
            Math.sin(a) * d + 120
          }px) rotate(${Math.random() * 720 - 360}deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 1100 + Math.random() * 500,
        easing: "cubic-bezier(0.2, 0.7, 0.4, 1)",
      }
    ).onfinish = () => c.remove();
  }
}

export default function ListingAuctionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { listingId } = resolvedParams;

  const [listing, setListing] = useState<ListingRecord | null>(null);
  const [patches, setPatches] = useState<PatchData[]>([]);
  const [focusPatchId, setFocusPatchId] = useState<string | number>("neck");
  const [viewerCount, setViewerCount] = useState(7);
  const [totalEscrow, setTotalEscrow] = useState<bigint>(0n);
  const [biddingEndsAt, setBiddingEndsAt] = useState<number>(0);
  const [countdownText, setCountdownText] = useState("—");
  const [isAntiSnipeActive, setIsAntiSnipeActive] = useState(false);

  // Bid Sheet State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [auroraModalOpen, setAuroraModalOpen] = useState(false);
  const [brandName, setBrandName] = useState("Your Brand");
  const [bidAmount, setBidAmount] = useState("");
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);

  const patchRefs = useRef<Record<string | number, PatchHandle | null>>({});

  // Chain hooks
  const { execute: executeBid, isLoading: isBidding } = useBid();
  const { execute: executeBuyNow, isLoading: isBuyingNow } = useBuyNow();

  // Load listing
  useEffect(() => {
    async function load() {
      const data = (await getListing(listingId)) || (await getListing("mira"));
      if (data) {
        setListing(data);
        const mapped: PatchData[] = data.patches.map((p) => ({
          id: p.id,
          name: p.name,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          r: p.r,
          floor: p.floor,
          buyNow: p.buyNow,
          top: p.topBid,
          brand: p.brand,
          c: p.c,
          bought: p.bought,
          locked: p.locked,
        }));
        setPatches(mapped);
        setTotalEscrow(data.totalEscrow);
        setBiddingEndsAt(data.biddingEndsAt);

        // Find initial focus patch: first with bid or first open
        const initial =
          mapped.find((p) => p.brand && !p.locked) || mapped[0];
        if (initial) {
          setFocusPatchId(initial.id);
        }
      }
    }
    load();
  }, [listingId]);

  // Live real-time simulation
  const { recentBids } = useListingLive(listing?.id || "mira", {
    onBidPlaced: (event) => {
      // Trigger patch animation handle
      const handle = patchRefs.current[event.patchId];
      if (handle) {
        handle.ping();
        handle.bump();
      }

      setPatches((prev) =>
        prev.map((p) => {
          if (p.id === event.patchId) {
            return {
              ...p,
              top: event.amount,
              brand: event.brandName,
              c: event.color || "p5",
              bought: event.isBuyNow || p.bought,
              locked: event.isBuyNow || p.locked,
            };
          }
          return p;
        })
      );

      // Check anti-snipe: if less than 5 minutes left
      const now = Date.now();
      if (biddingEndsAt - now < 5 * 60 * 1000 && biddingEndsAt > now) {
        setBiddingEndsAt((prev) => prev + 5 * 60 * 1000);
        setIsAntiSnipeActive(true);
        toast("Anti-snipe triggered: +5:00 added to the clock", {
          description: "A bid was placed in the last 5 minutes.",
        });
      }

      setTotalEscrow((prev) =>
        prev + (event.prevAmount ? event.amount - event.prevAmount : event.amount)
      );
    },
    onOutbid: (event) => {
      const handle = patchRefs.current[event.patchId];
      if (handle) {
        handle.shake();
      }
      toast(`You got outbid on ${event.patchLabel}`, {
        description: `Outbid by ${event.outbidBy} · your USDC was refunded`,
        action: {
          label: `Bid ${formatUsdc(event.minNextBid)}`,
          onClick: () => {
            setFocusPatchId(event.patchId);
            setBidAmount((Number(event.minNextBid) / 1e6).toString());
            setSheetOpen(true);
          },
        },
      });
    },
  });

  // Countdown timer loop & viewer flipper
  useEffect(() => {
    const timer = setInterval(() => {
      if (biddingEndsAt) {
        const cd = formatCountdown(biddingEndsAt);
        setCountdownText(cd.text);
      }
      if (Math.random() < 0.2) {
        setViewerCount(5 + Math.floor(Math.random() * 12));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [biddingEndsAt]);

  if (!listing) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <div className="font-mono text-sm text-[var(--muted)]">Loading listing...</div>
      </div>
    );
  }

  const selectedPatch =
    patches.find((p) => p.id === focusPatchId) || patches[0];

  const minNextBidUsdc = selectedPatch.top
    ? BigInt(selectedPatch.top) + 10_000_000n
    : BigInt(selectedPatch.floor || 50_000_000n);

  const claimedCount = patches.filter((p) => Boolean(p.brand)).length;

  const handleOpenBidSheet = (presetAmount?: bigint) => {
    const amt = presetAmount || minNextBidUsdc;
    setBidAmount((Number(amt) / 1e6).toString());
    setSheetOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePlaceBid = async () => {
    const amtBig = parseUsdc(bidAmount);
    if (amtBig < minNextBidUsdc) {
      toast(`Bid at least ${formatUsdc(minNextBidUsdc)} to lead this patch.`);
      return;
    }

    const targetId = selectedPatch.id;
    const isBuyOut = amtBig >= BigInt(selectedPatch.buyNow || 0);

    const ok = await executeBid({
      listingId: listing.id,
      patchId: targetId,
      amount: amtBig,
      brandName: brandName || "Your Brand",
      logoUrl: previewLogo,
      color: "p5",
    });

    if (ok) {
      setSheetOpen(false);
      const targetEl = patchRefs.current[targetId]?.element;
      launchConfetti(targetEl || null);
      patchRefs.current[targetId]?.ping();
      patchRefs.current[targetId]?.bump();

      if (isBuyOut) {
        patchRefs.current[targetId]?.stamp();
        toast(`${selectedPatch.name} is yours. Receipt NFT minted.`);
      } else {
        toast(`You lead ${selectedPatch.name} · ${formatUsdc(amtBig)} locked in escrow.`);
      }
    }
  };

  const handleBuyNowDirect = async () => {
    const targetId = selectedPatch.id;
    const ok = await executeBuyNow({
      listingId: listing.id,
      patchId: targetId,
      brandName: brandName || "Your Brand",
      logoUrl: previewLogo,
      color: "p5",
    });

    if (ok) {
      const targetEl = patchRefs.current[targetId]?.element;
      launchConfetti(targetEl || null);
      patchRefs.current[targetId]?.stamp();
      toast(`${selectedPatch.name} bought now! Receipt NFT minted.`);
    }
  };

  const handleIntentSettled = ({
    amount,
    sourceChain,
    sourceToken,
    txHash,
  }: {
    amount: bigint;
    sourceChain: string;
    sourceToken: string;
    txHash: string;
  }) => {
    const targetId = selectedPatch.id;
    setPatches((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              top: amount,
              brand: brandName || "Your Brand",
              logo: previewLogo || undefined,
              c: "p2",
            }
          : p
      )
    );

    auctionEventBus.emit("BidPlaced", {
      listingId: listing?.id || "mira",
      patchId: targetId,
      patchLabel: selectedPatch.name,
      bidder: "user_wallet",
      brandName: brandName || "Your Brand",
      amount,
      isBuyNow: false,
      color: "p2",
      logo: previewLogo || undefined,
      timestamp: Date.now(),
    });

    const targetEl = patchRefs.current[targetId]?.element;
    launchConfetti(targetEl || null);
    patchRefs.current[targetId]?.ping();
    patchRefs.current[targetId]?.bump();

    toast(`You lead ${selectedPatch.name} · ${formatUsdc(amount)} locked in escrow.`, {
      description: `Settled via Aurora Intents from ${sourceChain} (${sourceToken}) · tx: ${txHash}`,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Breadcrumbs & Chain Chip */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/explore">
            <Button size="small" variant="ghost" className="gap-1 px-2.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Explore</span>
            </Button>
          </Link>
          <span className="text-[var(--muted)]">/</span>
          <span className="font-bold text-[var(--ink)]">
            {listing.eventName || listing.title}
          </span>
        </div>

        <Chip variant="monad">USDC · Monad</Chip>
      </div>

      {/* Main Grid: Left Figure + Right Inspector */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
        {/* Left Column: Surface Card */}
        <Card className="p-6 bg-[var(--card)] flex flex-col items-center">
          <div
            className="w-full mx-auto"
            style={{
              maxWidth:
                listing.surface === "car"
                  ? "100%"
                  : listing.surface === "hoodie"
                  ? "480px"
                  : "380px",
            }}
          >
            <SurfaceFigure
              surface={listing.surface}
              patches={patches.map((p) =>
                p.id === focusPatchId && sheetOpen
                  ? {
                      ...p,
                      brand: brandName,
                      logo: previewLogo,
                      top: parseUsdc(bidAmount) || p.top,
                    }
                  : p
              )}
              mode="interactive"
              selectedId={focusPatchId}
              previewId={sheetOpen ? focusPatchId : null}
              onSelect={(id) => {
                setFocusPatchId(id);
              }}
              patchRefs={patchRefs}
              animateDrop
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-5 flex-wrap text-xs text-[var(--muted)] mt-5 pt-4 border-t border-[var(--soft)] w-full">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-3 rounded-xs border border-[var(--ink)] bg-[var(--p2)]" />
              Leading bid
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-3 rounded-xs border border-dashed border-[var(--accent)] bg-transparent" />
              Open, no bids
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[var(--ink)] font-semibold">
              <Eye className="w-3.5 h-3.5 text-[var(--muted)]" />
              {viewerCount} watching
            </span>
          </div>
        </Card>

        {/* Right Column: Creator, KPIs, Panel, Feed */}
        <div className="space-y-4">
          {/* Creator Profile Card */}
          <Card className="flex items-center gap-3.5 p-4">
            <div
              className="w-14 h-14 rounded-2xl border-2 border-[var(--line)] grid place-items-center font-extrabold text-xl text-[#0B0B0C] select-none flex-none shadow-[2px_2px_0_var(--shadow)]"
              style={{
                background: "linear-gradient(135deg, var(--p5), var(--p2))",
                fontFamily: "var(--font-bricolage), sans-serif",
              }}
            >
              {listing.creatorAvatar || "M"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold truncate">{listing.creatorName}</h3>
              <p className="text-xs text-[var(--muted)] truncate">
                @{listing.creatorHandle} · {listing.surface}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Chip variant="green" className="text-[11px] py-0">
                  <Check className="w-3 h-3" />
                  X verified
                </Chip>
                <Chip className="text-[11px] py-0">
                  {listing.creatorDeliveries || "4 deliveries"}
                </Chip>
              </div>
            </div>
          </Card>

          {/* Auction KPIs */}
          <Card className="p-0 overflow-hidden">
            <div className="grid grid-cols-3 divide-x-2 divide-[var(--soft)] text-left">
              <div className="p-3.5 sm:p-4">
                <b
                  className={`block font-mono text-lg sm:text-xl font-bold tabular-nums ${
                    isAntiSnipeActive ? "text-[var(--accent-text)]" : ""
                  }`}
                >
                  {countdownText}
                </b>
                <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                  bidding ends
                  {isAntiSnipeActive && (
                    <span className="text-[10px] font-mono text-[var(--accent-text)] font-bold">
                      +5:00
                    </span>
                  )}
                </span>
              </div>
              <div className="p-3.5 sm:p-4">
                <b className="block font-mono text-lg sm:text-xl font-bold tabular-nums">
                  {formatUsdc(totalEscrow)}
                </b>
                <span className="text-xs text-[var(--muted)]">in escrow</span>
              </div>
              <div className="p-3.5 sm:p-4">
                <b className="block font-mono text-lg sm:text-xl font-bold tabular-nums">
                  {claimedCount}/{patches.length}
                </b>
                <span className="text-xs text-[var(--muted)] truncate">patches with bids</span>
              </div>
            </div>
          </Card>

          {/* Selected Patch Panel */}
          <Card className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
                  Patch · Live auction
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                  {selectedPatch.name}
                </h3>
              </div>
              {selectedPatch.locked ? (
                <Pill variant="won">Bought</Pill>
              ) : selectedPatch.brand ? (
                <Pill variant="top">Leading: {selectedPatch.brand}</Pill>
              ) : (
                <Pill variant="wait">No bids yet</Pill>
              )}
            </div>

            <div>
              <div className="font-mono text-4xl sm:text-5xl font-extrabold text-[var(--ink)] tabular-nums">
                {formatUsdc(selectedPatch.top || selectedPatch.floor)}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1 font-mono">
                {selectedPatch.top ? (
                  <>
                    top bid · next bid at least{" "}
                    <b className="text-[var(--ink)]">{formatUsdc(minNextBidUsdc)}</b> · buy
                    now {formatUsdc(selectedPatch.buyNow)}
                  </>
                ) : (
                  <>floor price · buy now {formatUsdc(selectedPatch.buyNow)}</>
                )}
              </div>
            </div>

            {/* Bid History Ladder */}
            <div className="border-t border-dashed border-[var(--soft)] pt-3">
              {(() => {
                const patchRecord = listing.patches.find((p) => p.id === selectedPatch.id);
                const history = patchRecord?.history || [];

                if (history.length === 0) {
                  return (
                    <div className="text-xs text-[var(--muted)] py-2">
                      Be the first to bid on this patch spot.
                    </div>
                  );
                }

                return (
                  <ul className="space-y-1.5 text-xs">
                    {history.slice(0, 4).map((h, idx) => (
                      <li
                        key={h.id}
                        className={`flex items-center justify-between py-1 border-b border-dashed border-[var(--soft)] last:border-0 ${
                          idx === 0 ? "font-bold text-[var(--ink)]" : "text-[var(--muted)]"
                        }`}
                      >
                        <span>{h.brandName}</span>
                        <span className="font-mono tabular-nums">
                          {formatUsdc(h.amount)} · {formatTimeAgo(h.timestamp)}
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <Button
                variant="primary"
                className="flex-1"
                disabled={selectedPatch.locked}
                onClick={() => handleOpenBidSheet()}
              >
                Bid {formatUsdc(minNextBidUsdc)}+
              </Button>
              <Button
                disabled={selectedPatch.locked || isBuyingNow}
                onClick={handleBuyNowDirect}
              >
                Buy now {formatUsdc(selectedPatch.buyNow)}
              </Button>
            </div>

            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 pt-1">
              <Clock className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
              <span>A bid in the last 5 minutes adds 5 minutes to the whole listing</span>
            </p>
          </Card>

          {/* Live Activity Feed */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base">Live Activity</h4>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--green)]">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Live
              </span>
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-2 divide-y divide-[var(--soft)] pr-1">
              {recentBids.length === 0 ? (
                <div className="text-xs text-[var(--muted)] py-4 text-center">
                  Live feed connected. Waiting for bids...
                </div>
              ) : (
                recentBids.slice(0, 10).map((bid) => (
                  <div
                    key={bid.timestamp + String(bid.patchId) + bid.brandName}
                    className="pt-2 first:pt-0 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 duration-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--ink)]">{bid.brandName}</span>
                      <span className="text-[var(--muted)]">bid on {bid.patchLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--accent-text)]">
                        {formatUsdc(bid.amount)}
                      </span>
                      <span className="text-[var(--muted)]">{formatTimeAgo(bid.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Bid Sheet Drawer */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={selectedPatch.name}
        description={`Top bid: ${formatUsdc(selectedPatch.top || selectedPatch.floor)} · next min bid: ${formatUsdc(
          minNextBidUsdc
        )}`}
      >
        <div className="space-y-4 py-2">
          {/* Brand Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Brand name
            </label>
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Nodeflux Labs"
            />
          </div>

          {/* Logo Upload with Live Preview */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Logo <span className="normal-case font-normal">· previews live on the patch</span>
            </label>
            <label className="flex items-center gap-3 border-2 border-dashed border-[var(--line)] rounded-xl p-3 cursor-pointer hover:border-[var(--accent)] bg-[var(--paper)] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[var(--soft)] grid place-items-center overflow-hidden flex-none border border-[var(--line)]">
                {previewLogo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewLogo} alt="Logo preview" className="w-full h-full object-contain" />
                ) : (
                  <Upload className="w-5 h-5 text-[var(--muted)]" />
                )}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <b className="block text-sm text-[var(--ink)]">Upload brand logo</b>
                <span className="text-[var(--muted)]">PNG or SVG, transparent works best</span>
              </div>
              <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
            </label>
          </div>

          {/* Bid Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Your bid
            </label>
            <AmountInput
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
          </div>

          {/* Quick Increment Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="small"
              onClick={() => {
                const cur = Number(bidAmount) || Number(minNextBidUsdc) / 1e6;
                setBidAmount((cur + 10).toString());
              }}
            >
              +10
            </Button>
            <Button
              size="small"
              onClick={() => {
                const cur = Number(bidAmount) || Number(minNextBidUsdc) / 1e6;
                setBidAmount((cur + 50).toString());
              }}
            >
              +50
            </Button>
            <Button
              size="small"
              onClick={() => {
                const cur = Number(bidAmount) || Number(minNextBidUsdc) / 1e6;
                setBidAmount((cur + 100).toString());
              }}
            >
              +100
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                setBidAmount((Number(selectedPatch.buyNow || 600_000_000n) / 1e6).toString());
              }}
            >
              Buy now
            </Button>
          </div>

          {/* Perks list */}
          <div className="bg-[var(--soft)] p-3.5 rounded-xl space-y-2 text-xs text-[var(--muted)]">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center flex-none">
                <Zap className="w-3 h-3" />
              </div>
              <span>Gasless: Patched sponsors all transaction fees on Monad</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center flex-none">
                <Check className="w-3 h-3" />
              </div>
              <span>Approve + bid combined in one confirmation</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center flex-none">
                <Lock className="w-3 h-3" />
              </div>
              <span>Outbid? Your USDC is instantly refunded to your wallet</span>
            </div>
          </div>

          {/* Foot Actions */}
          <div className="pt-3 flex flex-col gap-2">
            <Button
              variant="primary"
              disabled={isBidding}
              onClick={handlePlaceBid}
            >
              {isBidding ? "Signing · gasless..." : `Place bid ($${bidAmount || "0"} USDC)`}
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                toast("Privy fiat onramp", {
                  description: "Stripe card onramp to USDC on Monad testnet.",
                });
              }}
            >
              No USDC? Pay with card
            </Button>
            <Button
              size="small"
              variant="ghost"
              onClick={() => {
                setSheetOpen(false);
                setAuroraModalOpen(true);
              }}
            >
              Pay from another chain (Aurora Intents)
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Aurora Intents Cross-Chain Modal */}
      <AuroraIntentModal
        isOpen={auroraModalOpen}
        onClose={() => setAuroraModalOpen(false)}
        targetUsdcAmount={parseUsdc(bidAmount) >= minNextBidUsdc ? parseUsdc(bidAmount) : minNextBidUsdc}
        patchLabel={selectedPatch.name}
        brandName={brandName}
        onIntentSettled={handleIntentSettled}
      />
    </div>
  );
}
