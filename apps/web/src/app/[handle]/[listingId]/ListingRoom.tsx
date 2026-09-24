"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Check, Clock, ExternalLink, Fuel, Link2, RotateCcw, ShieldCheck } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData, PatchHandle } from "@/components/surface/Patch";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { formatCountdown, formatShortAddress, formatTimeAgo, formatUsdc, parseUsdc } from "@/lib/format";
import { fromWire, type ListingView, type LivePatch, type Wire } from "@/lib/market/types";
import { useLiveListing } from "@/lib/market/useLiveListing";
import { useBid } from "@/lib/market/useBid";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { EXPLORER, GAS_SPONSORED, MARKET } from "@/lib/config";
import { encodeFunctionData } from "viem";
import { useRouter } from "next/navigation";
import { PATCH_TIERS, patchedMarketAbi } from "@patched/shared";
import { MilestoneList } from "@/components/market/MilestoneList";
import { DisputeSheet } from "@/components/market/DisputeSheet";
import { AutoBidPanel } from "@/components/market/AutoBidPanel";
import { SweepPanel } from "@/components/market/SweepPanel";
import { Burst, SpotBubble } from "@/components/market/SpotBubble";
import { AnimatePresence } from "motion/react";
import type { DeliveryView } from "@/lib/market/server";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { cn } from "@/lib/utils";

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const STATUS_LABEL: Record<number, string> = {
  0: "Waiting for approval", 1: "Bidding live", 2: "Bidding closed", 3: "Completed",
  4: "Creator missed a deadline", 5: "Cancelled", 6: "Rejected", 7: "Closed with no bids",
};
const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

/** Same rule as the contract's _minNext, capped at buy-now. */
function minNextFor(p: LivePatch, minIncrement: bigint, minIncrementBps: number): bigint {
  if (p.topBid === 0n) return p.floor;
  let inc = (p.topBid * BigInt(minIncrementBps)) / 10_000n;
  if (inc < minIncrement) inc = minIncrement;
  const next = p.topBid + inc;
  return next > p.buyNow ? p.buyNow : next;
}

export function ListingRoom({ initial, delivery: dw }: { initial: Wire<ListingView>; delivery: Wire<DeliveryView> | null }) {
  const listing = useMemo(() => fromWire<ListingView>(initial), [initial]);
  const delivery = useMemo(() => (dw ? fromWire<DeliveryView>(dw) : null), [dw]);
  const router = useRouter();
  const send = useTx();
  const [disputeTarget, setDisputeTarget] = useState<{ milestone: number; milestoneName: string; reviewEndsAt: number | null; patchId: number; label: string } | null>(null);
  const { walletAddress, authenticated, login } = usePatchedAuth();
  const me = walletAddress?.toLowerCase();
  // The market rejects bids from a listing's own creator, so they get no bid controls.
  const isCreator = !!me && me === listing.creator.toLowerCase();
  const minNext = (p: LivePatch) => minNextFor(p, listing.minIncrement, listing.minIncrementBps);
  const patchRefs = useRef<Record<string | number, PatchHandle | null>>({});

  const { patches, bids, endsAt, status } = useLiveListing(listing, (bid, prevLeader) => {
    const ref = patchRefs.current[bid.patchId];
    ref?.ping();
    ref?.bump();
    if (prevLeader && prevLeader === me && bid.bidder !== me) {
      ref?.shake();
      toast(`You got outbid on ${bid.label}. Your USDC is back in your wallet.`, {
        action: { label: "Bid again", onClick: () => openSheet(bid.patchId) },
      });
    }
  });

  const [selectedId, setSelectedId] = useState<number>(() => (patches.find((p) => p.topBidder) ?? patches[0]).id);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The bid bubble on the stage, and the confetti burst when you take the lead.
  const [bubbleId, setBubbleId] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; n: number } | null>(null);
  const [viewSide, setViewSide] = useState<string>(() => listing.views[0]?.id ?? "front");
  const [amountText, setAmountText] = useState("");
  // Time-based text (countdown, "2m ago") differs between server and browser, so render it after mount.
  const [mounted, setMounted] = useState(false);
  // The patch drop-in animation plays once on load; later bids only ping/bump.
  const [intro, setIntro] = useState(true);
  const [, tick] = useState(0);
  const { bid, status: txStatus, error, hash, reset } = useBid();

  useEffect(() => {
    setMounted(true);
    const introTimer = setTimeout(() => setIntro(false), 1600);
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(t);
      clearTimeout(introTimer);
    };
  }, []);

  const selected = patches.find((p) => p.id === selectedId) ?? patches[0];
  const countdown = formatCountdown(endsAt);
  const ago = (t: number) => (mounted ? formatTimeAgo(t) : "");
  const biddingOpen = status === 1 && !countdown.hasEnded;
  const escrow = patches.reduce((s, p) => s + p.topBid, 0n);
  const withBids = patches.filter((p) => p.topBidder).length;

  function openSheet(patchId: number) {
    const p = patches.find((x) => x.id === patchId);
    if (!p) return;
    setSelectedId(patchId);
    setViewSide(p.side);
    setAmountText(String(Number(minNext(p)) / 1e6));
    reset();
    setSheetOpen(true);
  }

  /** One-tap bid from the bubble. */
  async function quickBid(p: LivePatch, amount: bigint) {
    setSelectedId(p.id);
    const ok = await bid(listing.id, p.id, amount);
    if (!ok) return;
    const bought = amount >= p.buyNow;
    patchRefs.current[p.id]?.bump();
    if (bought) patchRefs.current[p.id]?.stamp();
    setBurst({ x: p.x + p.w / 2, y: p.y + p.h / 2, n: Date.now() });
    setTimeout(() => setBurst(null), 1000);
    toast(bought ? `${p.label} is yours. Receipt NFT comes when bidding closes.` : `You lead ${p.label} · ${usd(amount)} locked in escrow`);
  }

  /** Open the bubble for a spot (from a card or the stage), switching to its view. */
  function openBubble(p: LivePatch) {
    setSelectedId(p.id);
    setViewSide(p.side);
    reset();
    setBubbleId(p.id);
    document.getElementById("stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function placeBid() {
    const amount = parseUsdc(amountText);
    if (amount < minNext(selected)) {
      toast(`Bid at least ${usd(minNext(selected))} to take the lead.`);
      return;
    }
    const ok = await bid(listing.id, selected.id, amount);
    if (ok) {
      setSheetOpen(false);
      const bought = amount >= selected.buyNow;
      toast(bought ? `${selected.label} is yours. Receipt NFT comes when bidding closes.` : `You lead ${selected.label} · ${usd(amount)} locked in escrow`);
      if (bought) patchRefs.current[selected.id]?.stamp();
    }
  }

  const figurePatches: PatchData[] = patches.filter((p) => listing.views.length < 2 || p.side === viewSide).map((p) => ({
    id: p.id,
    name: p.label,
    x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
    floor: Number(p.floor) / 1e6,
    buyNow: Number(p.buyNow) / 1e6,
    topBid: Number(p.topBid) / 1e6,
    brand: p.topBidder ? (p.brandName ?? (p.topBidder === me ? "You" : formatShortAddress(p.topBidder))) : null,
    logo: p.logoUrl,
    c: PASTELS[p.id % PASTELS.length],
    bought: p.bought,
    mine: Boolean(me && p.topBidder === me),
    number: p.id + 1,
  }));

  const creatorLabel = listing.creatorName ?? (listing.creatorHandle ? `@${listing.creatorHandle}` : formatShortAddress(listing.creator));
  const busy = txStatus === "signing" || txStatus === "confirming";
  const bubble = bubbleId === null ? null : patches.find((p) => p.id === bubbleId) ?? null;
  const meta = listing.metadata;
  const surfaceWord = listing.surface === "car" ? "car" : listing.surface === "hoodie" ? "hoodie" : "outfit";
  const headline =
    meta?.headline ?? (listing.surface === "car" ? "Your logo on my car" : listing.surface === "hoodie" ? "Your logo on our team" : "Walking billboard for your brand");
  const goal = patches.reduce((sum, p) => sum + p.buyNow, 0n);
  const progress = goal > 0n ? Math.min(100, Number((escrow * 1000n) / goal) / 10) : 0;
  const leaders = patches.filter((p) => p.topBidder);
  const eventDate = listing.eventStartsAt
    ? new Date(listing.eventStartsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const faq = [
    ...(meta?.faq ?? []),
    { q: "What happens if I'm outbid?", a: "Your USDC goes straight back to your wallet in the same transaction. Bid again, or turn on auto-bid and Patched keeps you on top up to your limit." },
    { q: "When does the creator get paid?", a: "Winning bids sit in escrow on Monad. They're released in steps after the creator posts proof, and you get 72 hours to dispute each proof for your spot." },
    { q: "What if the creator doesn't show up?", a: "If a proof deadline is missed, the money that hasn't been released goes back to the spot holders, plus a share of the creator's bond." },
    { q: "What do I get?", a: "Your logo on the spot, a receipt NFT for it, and the proof photos. You can resell the spot while the listing is running." },
    { q: "Which logo format works?", a: "Add your logo on My bids: PNG, SVG or WebP, with a transparent background for the cleanest print." },
  ];
  const pickSpot = (p: LivePatch) => {
    setSelectedId(p.id);
    setViewSide(p.side);
    document.getElementById("stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="pb-24">
      <div className="wrap pt-5 flex items-center gap-3 flex-wrap">
        <Link href="/explore" className="btn-base btn-ghost btn-small"><ArrowLeft size={14} /> Explore</Link>
        <Chip variant="monad" className="ml-auto">USDC · Monad</Chip>
        <button
          className="btn-base btn-small"
          onClick={() => navigator.clipboard.writeText(window.location.href).then(() => toast("Link copied. Paste it anywhere.")).catch(() => {})}
        >
          <Link2 size={13} /> Copy link
        </button>
      </div>
      {isCreator && (
        <div className="wrap mt-4">
          <div className="card-surface bg-[var(--accent-soft)] p-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold">This is your sponsor page. Share it to get brands bidding, and post proof after bidding closes.</span>
            <span className="flex gap-2">
              <Link href={`/studio/${listing.id}`} className="btn-base btn-small">Manage</Link>
              <Link href={`/share/${listing.id}`} className="btn-base btn-small btn-primary">Share kit</Link>
            </span>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <section className="wrap mt-6 grid gap-8 lg:grid-cols-2 items-center">
        <div className="grid gap-5 content-center">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="w-9 h-9 rounded-xl border-2 border-[var(--line)] overflow-hidden grid place-items-center font-extrabold bg-[var(--p5)] text-[#0B0B0C] flex-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {listing.creatorAvatar ? <img src={listing.creatorAvatar} alt="" className="w-full h-full object-cover" /> : creatorLabel.replace("@", "").slice(0, 1).toUpperCase()}
            </span>
            <b>{creatorLabel}</b>
            {listing.creatorVerified && <Chip variant="green"><Check size={12} /> X verified</Chip>}
            {listing.eventName && (
              <Chip variant="orange">
                {listing.eventName}
                {eventDate ? ` · ${eventDate}` : ""}
                {listing.eventCity ? ` · ${listing.eventCity}` : ""}
              </Chip>
            )}
          </div>
          <h1 className="text-[2.6rem] sm:text-6xl font-extrabold tracking-tight leading-[0.98]">{headline}</h1>
          <p className="text-lg text-[var(--muted)] max-w-xl">
            {listing.title}. {patches.length} logo spots on my {surfaceWord}, each its own live auction. Brands bid in USDC, and the
            money sits in escrow until I show up.
          </p>

          <Card className="p-4 grid gap-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <b className="font-mono text-3xl tabular-nums">{usd(escrow)}</b>
                <span className="text-sm text-[var(--muted)]"> bid of {usd(goal)} if every spot sells at buy-now</span>
              </div>
              <span className="text-sm font-semibold">{withBids} of {patches.length} spots taken</span>
            </div>
            <div className="h-3 rounded-full bg-[var(--soft)] overflow-hidden border-[1.5px] border-[var(--line)]">
              <div className="h-full bg-[var(--accent)] transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
              <span className={cn("font-semibold inline-flex items-center gap-1.5", countdown.isUrgent && "text-[var(--accent-text)]")}>
                <Clock size={14} />
                {!mounted ? " " : biddingOpen ? `Bidding ends in ${countdown.text}` : STATUS_LABEL[status] ?? "Closed"}
              </span>
              {biddingOpen && !isCreator && <a href="#spots" className="btn-base btn-primary btn-small">Pick a spot</a>}
            </div>
          </Card>
        </div>

        <Card className="p-4 sm:p-5" id="stage">
          {listing.views.length > 1 && (
            <div className="flex justify-center mb-3 overflow-x-auto">
              <Seg options={listing.views.map((v) => ({ value: v.id, label: v.label }))} value={viewSide} onChange={setViewSide} />
            </div>
          )}
          <div
            className={cn("relative", listing.surface === "car" ? "w-full" : listing.surface === "hoodie" ? "max-w-[440px] mx-auto" : "max-w-[380px] mx-auto")}
            onClick={(e) => { if (!(e.target as HTMLElement).closest(".patch")) setBubbleId(null); }}
          >
            <SurfaceFigure
              surface={listing.surface}
              imageUrl={listing.views.find((v) => v.id === viewSide)?.image ?? listing.canvasImage}
              patches={figurePatches}
              mode={biddingOpen ? "interactive" : "static"}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(Number(id));
                reset();
                setBubbleId(Number(id));
              }}
              patchRefs={patchRefs}
              animateDrop={intro}
            />
            <AnimatePresence>
              {bubble && (listing.views.length < 2 || bubble.side === viewSide) && (
                <SpotBubble
                  patch={bubble}
                  minNext={minNext(bubble)}
                  me={me}
                  isCreator={isCreator}
                  authenticated={authenticated}
                  biddingOpen={biddingOpen}
                  busy={busy}
                  error={txStatus === "error" ? error : null}
                  onLogin={login}
                  onBid={(amount) => quickBid(bubble, amount)}
                  onMore={(amount) => { openSheet(bubble.id); setAmountText(String(Number(amount) / 1e6)); setBubbleId(null); }}
                  onClose={() => setBubbleId(null)}
                />
              )}
            </AnimatePresence>
            <Burst key={burst?.n} x={burst?.x ?? 50} y={burst?.y ?? 50} show={!!burst} />
          </div>
          <div className="flex gap-4 justify-center flex-wrap text-[13px] muted mt-3">
            <span className="inline-flex items-center gap-1.5"><i className="sw-legend filled" />Taken</span>
            <span className="inline-flex items-center gap-1.5"><i className="sw-legend open" />Open</span>
            <span>Tap a spot to bid</span>
          </div>
        </Card>
      </section>

      {/* ── Spots ── */}
      <section id="spots" className="wrap mt-14 grid gap-4 scroll-mt-20">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span className="eyebrow">{patches.length} spots</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">Pick your spot</h2>
          </div>
          <p className="text-sm text-[var(--muted)] flex items-center gap-1.5"><Clock size={14} /> A bid in the last 5 minutes adds 5 minutes to the clock</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patches.map((p) => {
            const mine = !!me && p.topBidder === me;
            const tier = PATCH_TIERS[p.tier];
            const viewName = listing.views.length > 1 ? listing.views.find((v) => v.id === p.side)?.label : null;
            return (
              <div
                key={p.id}
                id={`spot-${p.id}`}
                className={cn("card-surface p-4 grid gap-3 content-start", p.id === selectedId && "ring-4 ring-[var(--accent)]/40")}
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => pickSpot(p)} className="text-left">
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {String(p.id + 1).padStart(2, "0")}
                      {viewName ? ` · ${viewName}` : ""}
                    </span>
                    <h3 className="text-xl font-extrabold leading-tight">{p.label}</h3>
                  </button>
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border-[1.5px] flex-none",
                      p.tier === "mega"
                        ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--line)]"
                        : p.tier === "prime"
                          ? "bg-[var(--p3)] text-[#0B0B0C] border-[#0B0B0C]"
                          : "bg-[var(--card)] border-[var(--soft)]",
                    )}
                  >
                    {tier.label}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">{p.perks ?? tier.blurb}</p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <b className="font-mono text-2xl tabular-nums">{usd(p.topBid > 0n ? p.topBid : p.floor)}</b>
                    <span className="block text-xs text-[var(--muted)]">
                      {p.bought ? "bought" : p.topBid > 0n ? `top bid · buy now ${usd(p.buyNow)}` : `starting bid · buy now ${usd(p.buyNow)}`}
                    </span>
                  </div>
                  {p.bought ? <Pill variant="won">Bought</Pill> : mine ? <Pill variant="top">You lead</Pill> : p.topBidder ? <Pill variant="top">Taken</Pill> : <Pill variant="wait">Open</Pill>}
                </div>
                {p.topBidder && (
                  <p className="text-sm flex items-center gap-1.5 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.logoUrl && <img src={p.logoUrl} alt="" className="w-5 h-5 object-contain flex-none" />}
                    <span className="truncate">Leading: <b>{mine ? "You" : p.brandName ?? formatShortAddress(p.topBidder)}</b></span>
                    {p.brandVerified && <BadgeCheck size={14} className="text-[var(--green)] flex-none" aria-label={`Verified brand · ${p.brandVerified}`} />}
                  </p>
                )}
                {biddingOpen && !p.bought && !isCreator && (
                  <div className="flex gap-2">
                    <Button variant="primary" size="small" onClick={() => openBubble(p)}>Bid {usd(minNext(p))}</Button>
                    <Button size="small" onClick={() => { openSheet(p.id); setAmountText(String(Number(p.buyNow) / 1e6)); }}>Buy {usd(p.buyNow)}</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {biddingOpen && !isCreator && <SweepPanel listingId={listing.id} patches={patches} minNext={minNext} me={me} />}
      </section>

      {delivery && (
        <section className="wrap mt-14 grid gap-3">
          <div className="flex justify-between items-end gap-3 flex-wrap">
            <h2 className="font-extrabold text-2xl">Delivery</h2>
            {isCreator && <Link href={`/studio/${listing.id}`} className="btn-base btn-small">Manage your listing</Link>}
          </div>
          <p className="text-sm text-[var(--muted)] max-w-[70ch]">
            The winning bids sit in escrow. The creator gets paid in steps after posting proof, and each patch holder
            has 72 hours to dispute a proof for their own patch.
          </p>
          <MilestoneList
            milestones={delivery.milestones}
            nextMilestone={delivery.nextMilestone}
            listingStatus={status}
            mounted={mounted}
            renderAction={(m) => {
              const inReview = m.status === 1 && m.reviewEndsAt && mounted && Date.now() < m.reviewEndsAt;
              const mine = delivery.receipts.filter((r) => me && r.owner === me);
              if (!inReview || !mine.length) return null;
              return (
                <div className="flex gap-2 flex-wrap mt-3">
                  {mine.map((r) => {
                    const disputed = (m.disputedMask & (1 << r.patchId)) !== 0;
                    const key = `${m.idx}:${r.patchId}`;
                    const label = patches.find((p) => p.id === r.patchId)?.label ?? `Patch ${r.patchId}`;
                    return disputed ? (
                      <Pill key={key} variant="out">You disputed {label}</Pill>
                    ) : (
                      <Button key={key} size="small" variant="ghost"
                        onClick={() => setDisputeTarget({ milestone: m.idx, milestoneName: m.name, reviewEndsAt: m.reviewEndsAt, patchId: r.patchId, label })}>
                        Dispute {label}
                      </Button>
                    );
                  })}
                </div>
              );
            }}
          />
        </section>
      )}

      {/* ── Wall of logos ── */}
      <section className="wrap mt-16 grid gap-4">
        <div>
          <span className="eyebrow">Sponsors</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">Already on the {surfaceWord}</h2>
        </div>
        {leaders.length ? (
          <div className="flex flex-wrap gap-3">
            {leaders.map((p) => (
              <div key={p.id} className="card-surface px-4 py-3 flex items-center gap-3">
                {p.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.logoUrl} alt="" className="w-9 h-9 object-contain" />
                ) : (
                  <span className="w-9 h-9 rounded-lg bg-[var(--p2)] text-[#0B0B0C] border-[1.5px] border-[#0B0B0C] grid place-items-center font-extrabold">
                    {(p.brandName ?? p.topBidder!.slice(2)).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="grid">
                  <b className="flex items-center gap-1">
                    {p.topBidder === me ? "You" : p.brandName ?? formatShortAddress(p.topBidder!)}
                    {p.brandVerified && <BadgeCheck size={14} className="text-[var(--green)]" />}
                  </b>
                  <span className="text-xs text-[var(--muted)]">{p.label} · {usd(p.topBid)}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-5"><p className="text-[var(--muted)]">No logos yet. The first brand to bid gets the pick of the spots.</p></Card>
        )}
      </section>

      {/* ── How it works ── */}
      <section className="wrap mt-16 grid gap-4">
        <div>
          <span className="eyebrow">How it works</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">Four steps, all on-chain</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Pick a spot", d: "Every spot is its own auction. Bid, or buy it outright at the buy-now price." },
            { t: "Bid in USDC", d: "One signature. If someone outbids you, your USDC comes straight back." },
            { t: "Money waits in escrow", d: "Nothing goes to the creator until they post proof. You can dispute within 72 hours." },
            {
              t: listing.surface === "car" ? "Get driven around" : "Get worn at the event",
              d: "Your logo gets printed, shown and photographed. You keep a receipt NFT for your spot.",
            },
          ].map((step, i) => (
            <Card key={step.t} className="p-5 grid gap-2 content-start">
              <span className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] border-2 border-[var(--line)] grid place-items-center font-mono font-bold">
                {i + 1}
              </span>
              <h3 className="text-lg font-bold">{step.t}</h3>
              <p className="text-sm text-[var(--muted)]">{step.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Creator story + activity ── */}
      <section className="wrap mt-16 grid gap-6 lg:grid-cols-[1.2fr_.8fr] items-start">
        <Card className="p-6 grid gap-3">
          <span className="eyebrow">About {creatorLabel}</span>
          <h2 className="text-3xl font-extrabold">Why I&apos;m doing this</h2>
          <p className="whitespace-pre-line leading-relaxed">
            {meta?.story ??
              listing.creatorBio ??
              `I'm putting ${patches.length} logo spots on my ${surfaceWord}${listing.eventName ? ` for ${listing.eventName}` : ""}. Every spot you take helps cover the costs, and your brand gets seen in person and in every photo.`}
          </p>
          {listing.creatorHandle && (
            <Link href={`/${listing.creatorHandle}`} className="btn-base btn-small justify-self-start">See {creatorLabel}&apos;s page</Link>
          )}
        </Card>
        <Card>
          <div className="flex justify-between items-center px-4 pt-3.5 pb-1">
            <h3 className="text-lg font-bold">Live activity</h3>
            <span className="dot live" />
          </div>
          <ul className="feed">
            {bids.slice(0, 10).map((b) => {
              const label = patches.find((p) => p.id === b.patchId)?.label ?? `Patch ${b.patchId}`;
              return (
                <li key={b.id}>
                  <span><b>{b.bidder === me ? "You" : formatShortAddress(b.bidder)}</b> bid on {label}</span>
                  <span className="font-mono">{usd(b.amount)} · {ago(b.time)}</span>
                </li>
              );
            })}
            {bids.length === 0 && <li><span className="muted">No bids yet. The first bid shows up here instantly.</span></li>}
          </ul>
        </Card>
      </section>

      {/* ── FAQ ── */}
      <section className="wrap mt-16">
        <div className="grid gap-3 max-w-3xl">
        <span className="eyebrow">Questions</span>
        <h2 className="text-3xl font-extrabold">Before you bid</h2>
        {faq.map((f) => (
          <details key={f.q} className="card-surface p-4 group">
            <summary className="font-bold cursor-pointer list-none flex justify-between gap-3">
              {f.q}
              <span className="text-[var(--muted)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="text-sm text-[var(--muted)] mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
        </div>
      </section>

      {disputeTarget && (
        <DisputeSheet
          open
          onClose={() => setDisputeTarget(null)}
          label={disputeTarget.label}
          milestoneName={disputeTarget.milestoneName}
          reviewEndsAt={disputeTarget.reviewEndsAt}
          onSubmit={async (reasonURI) => {
            try {
              await send(MARKET, encodeFunctionData({
                abi: patchedMarketAbi, functionName: "dispute",
                args: [BigInt(listing.id), disputeTarget.milestone, disputeTarget.patchId, reasonURI],
              }));
            } catch (err) {
              throw new Error(friendlyError(err).replace("The bid didn't", "That didn't"));
            }
            await fetch("/api/indexer/sync", { method: "POST" });
            toast(`Dispute opened for ${disputeTarget.label}. That payment is on hold until an admin decides.`);
            router.refresh();
          }}
        />
      )}

      <Sheet open={sheetOpen} onClose={() => !busy && setSheetOpen(false)} title={selected.label} description={
        selected.topBid > 0n ? `Top bid ${usd(selected.topBid)} · next bid at least ${usd(minNext(selected))}` : `No bids yet · floor ${usd(selected.floor)}`
      }>
        <div className="flex flex-col gap-4">
          {!isCreator && (
            <>
              <label className="field-label" htmlFor="bid-amount">Your bid</label>
              <div className="amt">
                <span>$</span>
                <input id="bid-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} disabled={busy} />
                <span>USDC</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[1, 5, 10].map((n) => (
                  <Button key={n} size="small" disabled={busy} onClick={() => setAmountText((v) => String((parseFloat(v) || 0) + n))}>+{n}</Button>
                ))}
                <Button size="small" variant="ghost" disabled={busy} onClick={() => setAmountText(String(Number(selected.buyNow) / 1e6))}>
                  Buy now {usd(selected.buyNow)}
                </Button>
              </div>
              <div className="perks">
                <div><span className="pi"><Fuel size={12} /></span>{GAS_SPONSORED ? "No gas needed. Patched pays the network fee." : "You pay a tiny network fee in MON."}</div>
                <div><span className="pi"><ShieldCheck size={12} /></span>Your USDC goes into escrow, not to the creator.</div>
                <div><span className="pi"><RotateCcw size={12} /></span>Outbid? Your USDC comes back instantly.</div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}
          {isCreator ? (
            <p className="rounded-xl bg-[var(--soft)] p-3 text-sm">
              This is your listing, so you can&apos;t bid on it. Share it so brands see it:{" "}
              <Link href={`/share/${listing.id}`} className="font-semibold underline">open the share kit</Link>.
            </p>
          ) : !authenticated ? (
            <Button variant="primary" onClick={login}>Sign in to bid</Button>
          ) : (
            <Button variant="primary" onClick={placeBid} disabled={busy}>
              {txStatus === "signing" ? "Approving USDC…" : txStatus === "confirming" ? "Placing bid…" : "Place bid"}
            </Button>
          )}
          {hash && (
            <a className="text-xs muted inline-flex items-center gap-1" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              View transaction <ExternalLink size={12} />
            </a>
          )}
          {authenticated && !isCreator && !selected.bought && biddingOpen && (
            <AutoBidPanel
              listingId={listing.id}
              patchId={selected.id}
              label={selected.label}
              minNext={minNext(selected)}
              buyNow={selected.buyNow}
              disabled={busy}
            />
          )}
        </div>
      </Sheet>
    </main>
  );
}
