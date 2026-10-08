"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppHref } from "@/lib/appHref";
import { publicUrl } from "@/lib/handles";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Pause, Play, Check, Clock, Crown, ExternalLink, Link2, Lock, Plus, Repeat, ShieldCheck, Trophy } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { LogoMark } from "@/components/brand/Logo";
import { Avatar as WalletAvatar } from "@/components/ui/Avatar";
import { MonadMark } from "@/components/brand/PartnerLogos";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData, PatchHandle } from "@/components/surface/Patch";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { TokenCard } from "@/components/nft/TokenCard";
import { ReportButton } from "@/components/social/ReportButton";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { formatCountdown, formatShortAddress, formatTimeAgo, formatUsdc, parseUsdc } from "@/lib/format";
import { fromWire, type ListingView, type LivePatch, type Wire } from "@/lib/market/types";
import { useLiveListing } from "@/lib/market/useLiveListing";
import { useWatchers } from "@/lib/market/useWatchers";
import { spotHeat } from "@/lib/market/heat";
import { useBid } from "@/lib/market/useBid";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { DEPLOYMENT, EXPLORER, GAS_SPONSORED, MARKET } from "@/lib/config";
import { encodeFunctionData } from "viem";
import { useRouter } from "next/navigation";
import { PATCH_TIERS, patchedMarketAbi } from "@patched/shared";
import { MilestoneList } from "@/components/market/MilestoneList";
import { DisputeSheet } from "@/components/market/DisputeSheet";
import { AutoBidPanel } from "@/components/market/AutoBidPanel";
import { ExplorerLink } from "@/components/ui/ExplorerLink";
import { SpottedWall } from "@/components/social/SpottedWall";
import { Comments } from "@/components/social/Comments";
import { openAddMoney } from "@/components/wallet/AddMoney";
import { SweepPanel } from "@/components/market/SweepPanel";
import { Burst } from "@/components/market/SpotBubble";
import { ListingTools } from "@/components/market/ListingTools";
import { EditableText } from "@/components/market/EditableText";
import { isPrintedStatus } from "@/lib/market/listingStatus";
import { StagePicker } from "@/components/market/StagePicker";
import { PAGE_ACCENTS, PAGE_SECTIONS, stageStyle, type ListingPage, type PageAccent, type PageSection } from "@/lib/market/page";
import { useAuthedFetch } from "@/lib/authedFetch";
import { Eye, EyeOff, Pencil, RotateCcw as ResetIcon, Save } from "lucide-react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/ui/Reveal";
import { PoweredBy } from "@/components/brand/PoweredBy";
import type { DeliveryView } from "@/lib/market/server";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { cn } from "@/lib/utils";

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const STATUS_LABEL: Record<number, string> = {
  0: "Going live", 1: "Bidding live", 2: "Bidding closed", 3: "Completed",
  4: "Creator missed a deadline", 5: "Cancelled", 6: "Rejected", 7: "Closed with no bids",
};
const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);
const USD_FORMAT = { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 0 } as const;
/** Sections below the auction fade up the first time they scroll into view. */
const REVEAL = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.2, 0.8, 0.2, 1] },
} as const;
const MILESTONE_COLORS = ["var(--p3)", "var(--p4)", "var(--p2)", "var(--p1)"];

/** Same rule as the contract's _minNext, capped at buy-now. */
function minNextFor(p: LivePatch, minIncrement: bigint, minIncrementBps: number): bigint {
  if (p.topBid === 0n) return p.floor;
  let inc = (p.topBid * BigInt(minIncrementBps)) / 10_000n;
  if (inc < minIncrement) inc = minIncrement;
  const next = p.topBid + inc;
  return next > p.buyNow ? p.buyNow : next;
}

export function ListingRoom({ initial, delivery: dw }: { initial: Wire<ListingView>; delivery: Wire<DeliveryView> | null }) {
  const appHref = useAppHref();
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
      const p = patchesRef.current.find((x) => x.id === bid.patchId);
      const next = p ? minNext({ ...p, topBid: bid.amount }) : 0n;
      toast(`You got outbid on ${bid.label}. Your USDC is back in your wallet.`, {
        action: p && next < p.buyNow
          ? { label: `Bid ${usd(next)}`, onClick: () => rebid(bid.patchId, next) }
          : { label: "Bid again", onClick: () => focusSpot(bid.patchId) },
      });
    }
  });
  const patchesRef = useRef(patches);
  patchesRef.current = patches;
  const watchers = useWatchers(listing.id);

  // Anti-snipe: tell everyone on the page when a late bid pushes the end time back.
  const lastEnd = useRef(endsAt);
  useEffect(() => {
    if (endsAt > lastEnd.current && lastEnd.current > 0) toast(`A late bid added time. Bidding now ends in ${formatCountdown(endsAt).text}.`);
    lastEnd.current = endsAt;
  }, [endsAt]);

  const [selectedId, setSelectedId] = useState<number>(() => (patches.find((p) => p.topBidder) ?? patches[0]).id);
  // The spot whose bid panel is open on the board.
  const [openId, setOpenId] = useState<number | null>(null);
  const reduce = useReducedMotion();
  // On arrival the photo turns once through its views (front, back, or every side of a car) and comes back to the
  // first, then stays put. Hovering the photo, opening a spot or choosing a view yourself cancels it.
  const [autoplay, setAutoplay] = useState(true);
  const [stageHover, setStageHover] = useState(false);
  // The spot under the pointer on the photo (mouse only): a small card shows its leader and the next bid.
  const [hoverId, setHoverId] = useState<number | null>(null);
  // Creator page editing: `saved` is what visitors see, `draft` is what the creator is changing.
  const authedFetch = useAuthedFetch();
  const [saved, setSaved] = useState<ListingPage>(() => listing.page);
  const [draft, setDraft] = useState<ListingPage>(() => listing.page);
  const [editing, setEditing] = useState(false);
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

  const turning = listing.views.length > 1 && autoplay && !reduce && !stageHover && openId === null && !editing;
  useEffect(() => {
    if (!turning) return;
    const ids = listing.views.map((v) => v.id);
    const hold = 2200;
    // After the drop-in: each other view in turn, then back to the first, then stop.
    const timers = [...ids.slice(1), ids[0]].map((id, i) => setTimeout(() => setViewSide(id), 1900 + hold * (i + 1) - 700));
    timers.push(setTimeout(() => setAutoplay(false), 1900 + hold * ids.length));
    return () => timers.forEach(clearTimeout);
  }, [turning, listing.views]);
  useEffect(() => {
    if (stageHover || openId !== null || editing) setAutoplay(false);
  }, [stageHover, openId, editing]);

  const selected = patches.find((p) => p.id === selectedId) ?? patches[0];
  const countdown = formatCountdown(endsAt);
  const ago = (t: number) => (mounted ? formatTimeAgo(t) : "");
  const biddingOpen = status === 1 && !countdown.hasEnded;
  // Time is up: the winning brands are printed on the photo like they will be on the real thing.
  const printed = isPrintedStatus(status, countdown.hasEnded);
  const escrow = patches.reduce((s, p) => s + p.topBid, 0n);
  const withBids = patches.filter((p) => p.topBidder).length;
  // The anti-snipe window: any bid now adds 5 minutes.
  const finalMinutes = mounted && biddingOpen && endsAt - Date.now() < 5 * 60_000;
  /** A bidder's display name: you, the brand name when they lead a spot, or the short address. */
  const bidderName = (w: string) => (w === me ? "You" : patches.find((p) => p.topBidder === w && p.brandName)?.brandName ?? formatShortAddress(w));

  /** Open a spot's bid panel on the board (from the photo, a row, a toast or the phone bar), at the minimum bid. */
  function focusSpot(patchId: number, { scroll = true }: { scroll?: boolean } = {}) {
    const p = patchesRef.current.find((x) => x.id === patchId);
    if (!p) return;
    setSelectedId(patchId);
    setViewSide(p.side);
    setAmountText(String(Number(minNext(p)) / 1e6));
    reset();
    setOpenId(patchId);
    if (scroll) {
      requestAnimationFrame(() => document.getElementById(`spot-${patchId}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }));
    }
  }

  /** Place a bid and celebrate on the photo when it lands. */
  async function quickBid(p: LivePatch, amount: bigint) {
    setSelectedId(p.id);
    const ok = await bid(listing.id, p.id, amount);
    if (!ok) return;
    const bought = amount >= p.buyNow;
    patchRefs.current[p.id]?.bump();
    if (bought) patchRefs.current[p.id]?.stamp();
    setBurst({ x: p.x + p.w / 2, y: p.y + p.h / 2, n: Date.now() });
    setTimeout(() => setBurst(null), 1000);
    toast(bought ? `${p.label} is yours. Your patch NFT is minted when bidding closes.` : `You lead ${p.label} · ${usd(amount)} locked in escrow`);
  }

  /**
   * One-tap rebid from the outbid toast, at the amount the button showed. If the price moved again since,
   * open the spot at the new minimum instead of bidding an amount that would fail.
   */
  function rebid(patchId: number, amount: bigint) {
    const p = patchesRef.current.find((x) => x.id === patchId);
    if (!p || p.bought) return;
    focusSpot(p.id);
    if (minNext(p) === amount) void quickBid(p, amount);
  }

  /** A brand accepts the proof for its own patch. When every holder has answered, the creator is paid without waiting out the review. */
  const [approving, setApproving] = useState<string | null>(null);
  async function approveProof(milestone: number, patchId: number, label: string, key: string) {
    setApproving(key);
    try {
      await send(MARKET, encodeFunctionData({ abi: patchedMarketAbi, functionName: "approveProof", args: [BigInt(listing.id), milestone, patchId] }));
      await fetch("/api/indexer/sync", { method: "POST" });
      toast(`You approved the proof for ${label}. The creator is paid as soon as every brand has answered.`);
      router.refresh();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
    } finally {
      setApproving(null);
    }
  }

  /** The bid from a spot's panel on the board, at the amount typed or picked. */
  async function placeBid(p: LivePatch) {
    const amount = parseUsdc(amountText);
    if (amount < minNext(p)) {
      toast(`Bid at least ${usd(minNext(p))} to take the lead.`);
      return;
    }
    await quickBid(p, amount > p.buyNow ? p.buyNow : amount);
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
  const meta = listing.metadata;
  const deal = meta?.deal;
  const surfaceWord = deal?.idea ? deal.idea.toLowerCase()
    : listing.surface === "car" ? (deal?.vehicle ?? "car") : listing.surface === "hoodie" ? "hoodie" : "outfit";
  const pg = editing ? draft : saved;
  const setPg = (change: Partial<ListingPage>) => setDraft((d) => ({ ...d, ...change }));
  const setTitle = (k: keyof NonNullable<ListingPage["titles"]>, v: string) => setDraft((d) => ({ ...d, titles: { ...d.titles, [k]: v } }));
  const shown = (sec: PageSection) => editing || !pg.hide?.includes(sec);
  const hidden = (sec: PageSection) => pg.hide?.includes(sec) ?? false;
  const toggleSection = (sec: PageSection) =>
    setDraft((d) => ({ ...d, hide: d.hide?.includes(sec) ? d.hide.filter((x) => x !== sec) : [...(d.hide ?? []), sec] }));
  const accent = PAGE_ACCENTS[pg.accent ?? "orange"];
  const defaultHeadline =
    meta?.headline ?? (listing.surface === "car" ? "Your logo on my car" : listing.surface === "hoodie" ? "Your logo on our team" : "Walking billboard for your brand");
  const goal = patches.reduce((sum, p) => sum + p.buyNow, 0n);
  const progress = goal > 0n ? Math.min(100, Number((escrow * 1000n) / goal) / 10) : 0;
  const leaders = patches.filter((p) => p.topBidder);
  const eventDate = listing.eventStartsAt
    ? new Date(listing.eventStartsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const creatorFaq = pg.faq ?? meta?.faq ?? [];
  const faq = [
    ...creatorFaq,
    { q: "What happens if I'm outbid?", a: "Your USDC goes straight back to your wallet in the same transaction. Bid again, or turn on auto-bid and Patched keeps you on top up to your limit." },
    { q: "When does the creator get paid?", a: "Winning bids sit in escrow on Monad. They're released in steps after the creator posts proof, and you get 72 hours to dispute each proof for your spot." },
    { q: "What if the creator doesn't show up?", a: "If a proof deadline is missed, the money that hasn't been released goes back to the spot holders, plus a share of the creator's bond." },
    { q: "What do I get?", a: "Your logo on the spot, a receipt NFT for it, and the proof photos. You can resell the spot while the listing is running." },
    { q: "Which logo format works?", a: "Add your logo on My bids: PNG, SVG or WebP, with a transparent background for the cleanest print." },
  ];
  const rec = listing.creatorRecord;
  // The board groups spots by view (front / back, or the sides of a car) in the order the views are shown.
  const groups = listing.views.length > 1
    ? listing.views.map((v) => ({ id: v.id, label: v.label, patches: patches.filter((p) => p.side === v.id) })).filter((g) => g.patches.length)
    : [{ id: "all", label: "", patches }];

  /**
   * Saving is queued, not awaited: the page shows the new version and the editor closes right away, and saves run
   * one after another in the background (so two quick saves can't land out of order). If one fails, the page goes
   * back to what's stored and the toast offers to retry with the edits kept.
   */
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  function persist(page: ListingPage, previous: ListingPage) {
    const id = toast.loading("Saving your page…");
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const res = await authedFetch(`/api/listings/${listing.id}/page`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(page),
        });
        const body = (await res.json()) as { page?: ListingPage; error?: string };
        if (!res.ok || !body.page) throw new Error(body.error ?? "Couldn't save your page.");
        setSaved(body.page);
        toast.success("Page saved. Everyone sees the new version now.", { id });
      } catch (err) {
        setSaved(previous);
        toast.error(err instanceof Error ? err.message : "Couldn't save your page.", {
          id,
          action: { label: "Try again", onClick: () => { setSaved(page); persist(page, previous); } },
        });
      }
    });
  }

  function savePage() {
    const page = draft;
    const previous = saved;
    setSaved(page);
    setEditing(false);
    persist(page, previous);
  }

  return (
    <MotionConfig reducedMotion="user">
    <main
      className="pb-28"
      style={{ "--accent": accent.accent, "--accent-soft": accent.soft, "--on-accent": accent.on, "--accent-text": accent.text } as React.CSSProperties}
    >
      <div className="wrap pt-5 flex items-center gap-3 flex-wrap">
        {/* The creator's own page: only a small mark says where it's hosted. */}
        <Link href={appHref("/")} className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--soft)] bg-[var(--card)] pl-1.5 pr-3 py-1 text-xs font-semibold no-underline text-[var(--ink)] hover:border-[var(--line)]">
          <LogoMark size={20} /> Made with Patched <span className="text-[var(--muted)] hidden sm:inline">· Open the app</span>
        </Link>
        <span className="ml-auto text-xs font-semibold text-[var(--muted)] hidden sm:inline-flex items-center gap-1.5">USDC on <MonadMark size={13} /> Monad</span>
        <button
          className="h-8 px-3 rounded-full border-[1.5px] border-[var(--soft)] bg-[var(--card)] text-xs font-semibold inline-flex items-center gap-1.5 hover:border-[var(--line)] ml-auto sm:ml-0"
          onClick={() => navigator.clipboard.writeText(publicUrl(`/${listing.creatorHandle ?? listing.creator}/${listing.id}`)).then(() => toast("Link copied. Paste it anywhere.")).catch(() => {})}
        >
          <Link2 size={13} /> Copy link
        </button>
        {!isCreator && <ReportButton kind="listing" id={listing.id} />}
      </div>
      {isCreator && (
        <div className="wrap mt-4">
          <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-semibold">
              {editing ? "Editing your page. Click any dashed text to change it; leave it empty to use the default." : "This is your sponsor page. Make it yours, then share it."}
            </span>
            <span className="flex gap-2">
              {!editing && (
                <button className="btn-base btn-small" onClick={() => { setDraft(saved); setEditing(true); setOpenId(null); }}>
                  <Pencil size={13} /> Edit page
                </button>
              )}
              <ListingTools listingId={listing.id} pageHref={`/${listing.creatorHandle ?? listing.creator}/${listing.id}`} status={status} active="page" />
            </span>
          </div>
        </div>
      )}

      {/* ── The auction room: the photo on one side, every spot's live price and leader on the other ── */}
      <section className="wrap mt-6 grid gap-8 lg:gap-12 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] items-start">
        <div id="stage" className="lg:sticky lg:top-6 grid gap-3 scroll-mt-6">
          <div className="rounded-[28px] bg-[var(--stage)] p-4 sm:p-6 grid gap-3" style={stageStyle(pg.stage)} onMouseEnter={() => setStageHover(true)} onMouseLeave={() => setStageHover(false)}>
            {listing.views.length > 1 && (
              <div className="flex justify-center items-center gap-2">
                <div className="grid gap-1 min-w-0">
                  <div className="overflow-x-auto">
                    <Seg options={listing.views.map((v) => ({ value: v.id, label: v.label }))} value={viewSide} onChange={(v) => { setViewSide(v); setAutoplay(false); }} size="small" />
                  </div>
                </div>
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={viewSide} initial={intro ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.32, ease: "easeInOut" }}
              className={cn("relative", listing.surface === "car" ? "w-full" : listing.surface === "hoodie" ? "max-w-[480px] mx-auto w-full" : "max-w-[460px] mx-auto w-full")}>
              <SurfaceFigure
                surface={listing.surface}
                imageUrl={listing.views.find((v) => v.id === viewSide)?.image ?? listing.canvasImage}
                patches={figurePatches}
                mode={biddingOpen ? "interactive" : "static"}
                selectedId={selectedId}
                onSelect={(id) => focusSpot(Number(id))}
                onHover={(id) => setHoverId(id === null ? null : Number(id))}
                patchRefs={patchRefs}
                animateDrop={intro}
                printed={printed}
              />
              <SpotHover open={biddingOpen} patch={hoverId === null ? null : figurePatches.find((x) => x.id === hoverId) ?? null} live={hoverId === null ? null : patches.find((x) => x.id === hoverId) ?? null} next={hoverId === null ? null : (() => { const lp = patches.find((x) => x.id === hoverId); return lp ? minNext(lp) : null; })()} />
              <Burst key={burst?.n} x={burst?.x ?? 50} y={burst?.y ?? 50} show={!!burst} />
            </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-4 justify-center flex-wrap text-[13px] text-[var(--muted)]">
            {printed ? <span>Bidding is over. The winning brands are printed on the {surfaceWord}.</span> : (
              <>
                <span className="inline-flex items-center gap-1.5"><i className="sw-legend filled" />Has a bid</span>
                <span className="inline-flex items-center gap-1.5"><i className="sw-legend open" />Open</span>
                {biddingOpen && <span>Tap a spot to bid</span>}
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 min-w-0">
          <header className="grid gap-2.5">
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Avatar creatorAvatar={listing.creatorAvatar} label={creatorLabel} />
              <b>{creatorLabel}</b>
              {listing.creatorVerified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--green)]"><BadgeCheck size={14} /> X verified</span>}
              {listing.eventName && (
                <Link href={`/e/${listing.eventId}`} className="no-underline text-xs font-semibold rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] px-2.5 py-1" title="See every listing at this event">
                  {listing.eventName}{eventDate ? ` · ${eventDate}` : ""}{listing.eventCity ? ` · ${listing.eventCity}` : ""}
                </Link>
              )}
            </div>
            <EditableText
              as="h1"
              editing={editing}
              value={pg.headline}
              fallback={defaultHeadline}
              maxLength={80}
              onChange={(v) => setPg({ headline: v })}
              className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.02]"
            />
            <EditableText
              editing={editing}
              value={pg.intro}
              fallback={`${listing.title}. ${patches.length} logo spots on my ${surfaceWord}, each its own live auction. Brands bid in stablecoins (USDC), and the money is held safely until I show up.`}
              maxLength={300}
              multiline
              onChange={(v) => setPg({ intro: v })}
              className={cn("text-base text-[var(--muted)] max-w-xl", !editing && "line-clamp-2")}
            />
          </header>

          {/* The auction at a glance */}
          <div className="grid gap-3">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div className="grid">
                <span className="eyebrow">In escrow</span>
                <span className="flex items-baseline gap-2">
                  <b className="font-mono text-4xl tabular-nums"><NumberFlow value={Number(escrow) / 1e6} format={USD_FORMAT} /></b>
                  <span className="text-sm text-[var(--muted)]">of {usd(goal)} if every spot sells</span>
                </span>
              </div>
              <div className="grid text-right">
                <span className="eyebrow inline-flex items-center gap-1.5 justify-end">
                  {biddingOpen && <span className="dot live" />}{biddingOpen ? "Ends in" : "Auction"}
                </span>
                <b className={cn("font-mono text-2xl tabular-nums", countdown.isUrgent && biddingOpen && "text-[var(--accent-text)]")}>
                  {!mounted ? " " : biddingOpen ? countdown.text : STATUS_LABEL[status] ?? "Closed"}
                </b>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--soft)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] transition-[width] duration-700" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-[var(--muted)] flex flex-wrap gap-x-4 gap-y-1">
              <span><b className="text-[var(--ink)]">{withBids}</b> of {patches.length} spots have a bid</span>
              <span><b className="text-[var(--ink)]">{bids.length}</b> bid{bids.length === 1 ? "" : "s"} so far</span>
              {watchers > 1 && <span className="inline-flex items-center gap-1"><Eye size={14} /> {watchers} watching</span>}
              {finalMinutes && <span className="font-semibold text-[var(--accent-text)]">Final minutes: any bid adds 5 minutes</span>}
            </p>
          </div>

          {/* ── The spot board ── */}
          <section id="spots" className="grid gap-3 scroll-mt-20">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="eyebrow">{patches.length} spots · each its own auction</span>
                <EditableText as="h2" editing={editing} value={pg.titles?.spots} fallback="Pick your spot" maxLength={60} onChange={(v) => setTitle("spots", v)} className="text-3xl font-extrabold mt-1" />
              </div>
              {biddingOpen && <p className="text-xs text-[var(--muted)] flex items-center gap-1.5"><Clock size={13} /> A bid in the last 5 minutes adds 5 minutes</p>}
            </div>

            <div className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] overflow-hidden">
              <div className="hidden sm:grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b-[1.5px] border-[var(--soft)]">
                <span>Spot</span><span>Leading</span><span className="text-right w-[92px]">{biddingOpen ? "Top bid" : "Price"}</span>
              </div>
              {groups.map((g) => (
                <div key={g.id}>
                  {groups.length > 1 && (
                    <div className="px-5 pt-3 pb-1 text-xs font-semibold text-[var(--muted)]">{g.label}</div>
                  )}
                  {g.patches.map((p) => {
                    const open = openId === p.id;
                    const mine = !!me && p.topBidder === me;
                    const tier = PATCH_TIERS[p.tier];
                    const heat = mounted && biddingOpen && !p.bought ? spotHeat(bids, p.id) : null;
                    const history = bids.filter((b) => b.patchId === p.id);
                    return (
                      <motion.div key={p.id} id={`spot-${p.id}`} className={cn("border-b-[1.5px] border-[var(--soft)] last:border-b-0 scroll-mt-24 transition-colors", open && "bg-[var(--paper)]")}
                        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + (p.id % 12) * 0.05, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => (open ? setOpenId(null) : focusSpot(p.id, { scroll: false }))}
                          onMouseEnter={() => setSelectedId(p.id)}
                          className="w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center px-5 py-3.5 text-left hover:bg-[var(--paper)]"
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className={cn("w-8 h-8 rounded-xl grid place-items-center font-mono text-xs font-bold flex-none border-[1.5px]",
                              p.topBidder ? "border-[#0B0B0C] text-[#0B0B0C]" : "border-dashed border-[var(--accent-text)] text-[var(--accent-text)]")}
                              style={p.topBidder ? { background: `var(--${PASTELS[p.id % PASTELS.length]})` } : undefined}>
                              {String(p.id + 1).padStart(2, "0")}
                            </span>
                            <span className="grid min-w-0">
                              <b className="truncate">{p.label}</b>
                              <span className={cn("text-xs truncate", p.tier === "mega" || p.tier === "prime" ? "text-[var(--accent-text)] font-semibold" : "text-[var(--muted)]")}>
                                {tier.label}{heat?.war ? " · bidding war" : heat && heat.recent > 0 ? ` · ${heat.recent} bid${heat.recent === 1 ? "" : "s"} in 15 min` : ""}
                              </span>
                            </span>
                          </span>
                          <span className="hidden sm:flex items-center gap-2 min-w-0 text-sm">
                            <Leader p={p} me={me} />
                          </span>
                          <span className="grid justify-items-end w-[92px]">
                            <b className="font-mono text-lg tabular-nums">
                              <NumberFlow value={Number(p.topBid > 0n ? p.topBid : p.floor) / 1e6} format={USD_FORMAT} />
                            </b>
                            <span className={cn("text-[11px]", mine ? "text-[var(--green)] font-semibold" : "text-[var(--muted)]")}>
                              {p.bought ? "bought" : mine ? "you lead" : p.topBid > 0n ? `${history.length} bid${history.length === 1 ? "" : "s"}` : "starts at"}
                            </span>
                          </span>
                          <span className="sm:hidden col-span-2 flex items-center gap-2 text-sm pl-11 min-w-0"><Leader p={p} me={me} /></span>
                        </button>
                        {editing && (
                          <div className="px-5 pb-3 pl-16">
                            <EditableText
                              editing
                              value={pg.perks?.[String(p.id)]}
                              fallback={p.perks ?? tier.blurb}
                              maxLength={120}
                              onChange={(v) => setDraft((d) => ({ ...d, perks: { ...d.perks, [String(p.id)]: v } }))}
                              className="text-sm text-[var(--muted)]"
                            />
                          </div>
                        )}
                        <AnimatePresence initial={false}>
                          {open && !editing && (
                            <motion.div
                              initial={reduce ? false : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_230px]">
                                <div className="grid gap-3 content-start min-w-0">
                                  <p className="text-sm text-[var(--muted)]">{pg.perks?.[String(p.id)] || p.perks || tier.blurb}</p>
                                  {!biddingOpen || p.bought ? (
                                    <p className="text-sm font-semibold">{p.bought ? "Bought at the buy-now price." : "Bidding is closed."}</p>
                                  ) : isCreator ? (
                                    <p className="rounded-xl bg-[var(--soft)] p-3 text-sm">
                                      This is your listing, so you can&apos;t bid on it.{" "}
                                      <Link href={`/share/${listing.id}`} className="font-semibold underline">Share it</Link> so brands see it.
                                    </p>
                                  ) : (
                                    <>
                                      <div className="amt !border-[1.5px]">
                                        <span>$</span>
                                        <input aria-label={`Your bid for ${p.label}`} inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} disabled={busy} />
                                        <span>USDC</span>
                                      </div>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {[
                                          { label: `Min ${usd(minNext(p))}`, value: minNext(p) },
                                          { label: "+$5", value: minNext(p) + 5_000_000n },
                                          { label: "+$10", value: minNext(p) + 10_000_000n },
                                          { label: `Buy now ${usd(p.buyNow)}`, value: p.buyNow },
                                        ].filter((c, i, all) => c.value <= p.buyNow && all.findIndex((x) => x.value === c.value) === i).map((c) => (
                                          <button key={c.label} type="button" disabled={busy} onClick={() => setAmountText(String(Number(c.value) / 1e6))}
                                            className={cn("h-8 px-3 rounded-full text-xs font-semibold border-[1.5px] transition-colors",
                                              parseUsdc(amountText) === c.value ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "border-[var(--soft)] hover:border-[var(--muted)]")}>
                                            {c.label}
                                          </button>
                                        ))}
                                      </div>
                                      {!authenticated ? (
                                        <Button variant="primary" className="h-12 justify-center text-base" onClick={login}>Sign in to bid</Button>
                                      ) : (
                                        <Button variant="primary" className="h-12 justify-center text-base" onClick={() => placeBid(p)} disabled={busy}>
                                          {txStatus === "signing" ? "Approving USDC…" : txStatus === "confirming" ? "Placing bid…" : parseUsdc(amountText) >= p.buyNow ? `Buy it for ${usd(p.buyNow)}` : `Bid ${amountText ? `$${amountText}` : ""}`}
                                        </Button>
                                      )}
                                      {error && (
                                        <p className="text-sm text-[var(--red)]" role="alert">
                                          {error}{/Not enough|needs a little more/i.test(error) && <> <button type="button" className="font-semibold underline" onClick={openAddMoney}>Add money</button></>}
                                        </p>
                                      )}
                                      <p className="text-xs text-[var(--muted)] leading-relaxed">
                                        Your USDC goes into escrow, not to the creator. Outbid? It comes back right away.
                                        {GAS_SPONSORED ? " No gas needed." : ""}
                                      </p>
                                      {hash && (
                                        <a className="text-xs text-[var(--muted)] inline-flex items-center gap-1" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
                                          View transaction <ExternalLink size={12} />
                                        </a>
                                      )}
                                      {authenticated && (
                                        <details className="group">
                                          <summary className="text-sm font-semibold cursor-pointer list-none inline-flex items-center gap-1.5">
                                            <Repeat size={14} /> Auto-bid: stay on top up to your limit
                                          </summary>
                                          <div className="mt-3">
                                            <AutoBidPanel listingId={listing.id} patchId={p.id} label={p.label} minNext={minNext(p)} buyNow={p.buyNow} disabled={busy} />
                                          </div>
                                        </details>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="grid gap-2 content-start">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Bids on this spot</span>
                                  {history.length ? (
                                    <ol className="grid list-none m-0 p-0">
                                      {history.slice(0, 6).map((b, i) => (
                                        <li key={b.id} className={cn("flex justify-between gap-2 py-1.5 text-sm border-b border-dashed border-[var(--soft)] last:border-b-0", i > 0 && "text-[var(--muted)]")}>
                                          <span className="truncate">{i === 0 && <Crown size={12} className="inline mr-1 -mt-0.5 text-[var(--accent-text)]" />}{bidderName(b.bidder)}</span>
                                          <span className="font-mono flex-none inline-flex items-center gap-1">{usd(b.amount)}<span className="text-[var(--muted)]">{mounted ? ` · ${ago(b.time)}` : ""}</span><ExplorerLink tx={b.tx} /></span>
                                        </li>
                                      ))}
                                    </ol>
                                  ) : (
                                    <p className="text-sm text-[var(--muted)]">No bids yet. The first bid at {usd(p.floor)} takes the lead.</p>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
            {biddingOpen && !isCreator && <SweepPanel listingId={listing.id} patches={patches} minNext={minNext} me={me} />}
          </section>

          {/* Everything that just happened, across all spots */}
          {shown("activity") && (
            <section id="activity" className={cn("grid gap-2 scroll-mt-20", hidden("activity") && "opacity-40")}>
              <span className="eyebrow inline-flex items-center gap-1.5"><span className="dot live" /> Latest bids</span>
              {bids.length ? (
                <ol className="grid list-none m-0 p-0">
                  {bids.slice(0, 6).map((b) => (
                    <li key={b.id} className="flex justify-between gap-3 py-2 text-sm border-b border-dashed border-[var(--soft)] last:border-b-0 [animation:feed-in_1.2s] motion-reduce:[animation:none]">
                      <span className="min-w-0 truncate"><b>{bidderName(b.bidder)}</b> bid on {patches.find((p) => p.id === b.patchId)?.label ?? `Spot ${b.patchId + 1}`}</span>
                      <span className="font-mono flex-none inline-flex items-center gap-1">{usd(b.amount)}<span className="text-[var(--muted)]">{mounted ? ` · ${ago(b.time)}` : ""}</span><ExplorerLink tx={b.tx} /></span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-[var(--muted)]">No bids yet. The first one shows up here the moment it lands.</p>
              )}
            </section>
          )}
        </div>
      </section>

      {delivery && (
        <motion.section {...REVEAL} className="wrap mt-20 grid gap-3">
          <div className="flex justify-between items-end gap-3 flex-wrap">
            <h2 className="font-extrabold text-3xl">Delivery</h2>
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
                    const bit = 1 << r.patchId;
                    const disputed = (m.disputedMask & bit) !== 0;
                    const approved = (m.approvedMask & bit) !== 0;
                    const key = `${m.idx}:${r.patchId}`;
                    const label = patches.find((p) => p.id === r.patchId)?.label ?? `Patch ${r.patchId}`;
                    if (disputed) return <Pill key={key} variant="out">You disputed {label}</Pill>;
                    if (approved) return <Pill key={key} variant="won">You approved {label}</Pill>;
                    return (
                      <span key={key} className="inline-flex gap-2">
                        {DEPLOYMENT.approvals && (
                          <Button size="small" variant="primary" disabled={approving === key} onClick={() => approveProof(m.idx, r.patchId, label, key)}>
                            {approving === key ? "Approving…" : `Approve ${label}`}
                          </Button>
                        )}
                        <Button size="small" variant="ghost"
                          onClick={() => setDisputeTarget({ milestone: m.idx, milestoneName: m.name, reviewEndsAt: m.reviewEndsAt, patchId: r.patchId, label })}>
                          Dispute {label}
                        </Button>
                      </span>
                    );
                  })}
                </div>
              );
            }}
          />
          {delivery.receipts.length > 0 && (
            <div className="grid gap-3 mt-8">
              <h3 className="font-extrabold text-2xl">Patch NFTs</h3>
              <p className="text-sm text-[var(--muted)] max-w-[70ch]">One per patch, held by the winning brand. Each updates as the creator proves a step: printed, seen, delivered.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {delivery.receipts.map((r) => <TokenCard key={r.patchId} tokenId={String((BigInt(listing.id) << 8n) | BigInt(r.patchId))} />)}
              </div>
            </div>
          )}
        </motion.section>
      )}

      {/* ── The deal and what protects the brand ── */}
      <motion.section {...REVEAL} id="deal" className="wrap mt-20 grid gap-12 lg:grid-cols-2 scroll-mt-20">
        <div className="grid gap-4 content-start">
          <div>
            <span className="eyebrow">The deal</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">What every brand gets</h2>
          </div>
          {!!deal?.deliverables?.length && (
            <ul className="grid gap-3 list-none m-0 p-0">
              {deal.deliverables.map((d) => (
                <li key={d} className="flex gap-3 items-start text-[17px]">
                  <span className="w-6 h-6 rounded-full bg-[var(--green-soft)] text-[var(--green)] grid place-items-center flex-none mt-0.5"><Check size={14} strokeWidth={3} /></span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[var(--muted)]">
            {[
              deal?.idea ? `It's ${deal.idea.toLowerCase()}.` : null,
              listing.surface === "car" && deal?.vehicle ? `A ${deal.vehicle}, ${deal.place === "loop" ? "looping the venue all day" : "parked right by the entrance"}.` : null,
              deal?.days ? `${deal.days} event day${deal.days > 1 ? "s" : ""}${listing.eventName ? ` at ${listing.eventName}` : ""}.` : null,
              "Your logo is printed on your spot, and you keep a receipt NFT for it.",
            ].filter(Boolean).join(" ")}
          </p>
        </div>

        {status !== 5 && status !== 6 && (
          <div id="protection" className="grid gap-4 content-start scroll-mt-20">
            <div>
              <span className="eyebrow">Your protection</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold mt-1">{creatorLabel} has money on the line</h2>
            </div>
            <dl className="grid m-0">
              <Fact icon={<ShieldCheck size={18} />} title={`${usd(listing.bond)} creator stake`}>
                {status === 3 ? `${creatorLabel} delivered, so the stake went back to them.`
                  : status === 4 ? `${creatorLabel} missed a deadline. The stake and unpaid escrow went to the spot holders.`
                  : `Miss a proof deadline and this stake, plus all unpaid escrow, goes to the spot holders.`}
              </Fact>
              <Fact icon={<Trophy size={18} />} title={rec.completed + rec.failed > 0 ? `${rec.completed} delivered` : "First listing"}>
                {rec.completed + rec.failed > 0
                  ? `${rec.failed === 0 ? "No missed deadlines" : `${rec.failed} missed ${rec.failed === 1 ? "deadline" : "deadlines"}`} · ${usd(rec.earned)} earned on Patched`
                  : "New creators have a spending cap until their first delivery, so the risk stays small."}
              </Fact>
              <Fact icon={<Lock size={18} />} title="Paid only on proof">
                Your USDC sits in the contract. Each payment needs proof first, and you get 72 hours to dispute it.
              </Fact>
            </dl>
            {listing.milestoneBps.length > 0 && (
              <div className="grid gap-2">
                <div className="flex h-2.5 rounded-full overflow-hidden gap-[3px]" aria-hidden="true">
                  {listing.milestoneBps.map((bps, i) => <span key={i} style={{ width: `${bps / 100}%`, background: MILESTONE_COLORS[i % MILESTONE_COLORS.length] }} />)}
                </div>
                <ol className="grid gap-1.5 list-none m-0 p-0 text-sm">
                  {listing.milestoneBps.map((bps, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-[3px] flex-none" style={{ background: MILESTONE_COLORS[i % MILESTONE_COLORS.length] }} />
                      <b className="font-mono w-10">{bps / 100}%</b>
                      <span className="flex-1 min-w-0 truncate">{meta?.milestones[i]?.name ?? `Milestone ${i + 1}`}</span>
                      <span className="text-[var(--muted)] flex-none">
                        {mounted && listing.deadlines[i] ? `proof by ${new Date(listing.deadlines[i]).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </motion.section>

      {/* ── Wall of logos ── */}
      {shown("sponsors") && (
        <motion.section {...REVEAL} className={cn("wrap mt-20 grid gap-4", hidden("sponsors") && "opacity-40")}>
          <div>
            <span className="eyebrow">Sponsors</span>
            <EditableText as="h2" editing={editing} value={pg.titles?.sponsors} fallback={`Already on the ${surfaceWord}`} maxLength={60} onChange={(v) => setTitle("sponsors", v)} className="text-3xl sm:text-4xl font-extrabold mt-1" />
          </div>
          {leaders.length ? (
            <div className="flex flex-wrap gap-2.5">
              {leaders.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2.5 rounded-full bg-[var(--card)] border-[1.5px] border-[var(--soft)] pl-1.5 pr-4 py-1.5">
                  <BrandMark p={p} size={30} />
                  <span className="grid leading-tight">
                    <b className="text-sm inline-flex items-center gap-1">
                      {p.topBidder === me ? "You" : p.brandName ?? formatShortAddress(p.topBidder!)}
                      {p.brandVerified && <BadgeCheck size={13} className="text-[var(--green)]" />}
                    </b>
                    <span className="text-xs text-[var(--muted)]">#{p.id + 1} {p.label}</span>
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[var(--muted)]">No logos yet. The first brand to bid gets the pick of the spots.</p>
          )}
        </motion.section>
      )}

      {/* ── Spotted: photos from people who saw the patches, and a way to post one ── */}
      <div className="wrap mt-20">
        <SpottedWall listingId={listing.id} choices={isCreator || status === 0 ? [] : [{ listingId: listing.id, label: creatorLabel }]} />
      </div>

      {/* ── Comments: free, one line each ── */}
      {status !== 0 && status !== 6 && (
        <div className="wrap mt-16 max-w-[720px]">
          <Comments listingId={listing.id} isCreator={isCreator} spots={patches.map((p) => ({ id: p.id, label: p.label }))} />
        </div>
      )}

      {/* ── How it works ── */}
      {shown("how") && (
        <motion.section {...REVEAL} className={cn("wrap mt-20 grid gap-6", hidden("how") && "opacity-40")}>
          <div>
            <span className="eyebrow">How it works</span>
            <EditableText as="h2" editing={editing} value={pg.titles?.how} fallback="Four steps, all on-chain" maxLength={60} onChange={(v) => setTitle("how", v)} className="text-3xl sm:text-4xl font-extrabold mt-1" />
          </div>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 list-none m-0 p-0">
            {[
              { t: "Pick a spot", d: "Every spot is its own auction. Bid, or buy it outright at the buy-now price." },
              { t: "Bid in USDC", d: "One signature. If someone outbids you, your USDC comes straight back." },
              { t: "Money waits in escrow", d: "Nothing goes to the creator until they post proof. You can dispute within 72 hours." },
              {
                t: deal?.idea ? "Get seen at the event" : listing.surface === "car" ? (deal?.place === "parked" ? "Get parked at the venue" : "Get driven around the venue") : "Get worn at the event",
                d: "Your logo gets printed, shown and photographed. You keep a receipt NFT for your spot.",
              },
            ].map((step, i) => (
              <motion.li key={step.t} className="grid gap-2 content-start border-t-[1.5px] border-[var(--ink)] pt-4"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}>
                <span className="font-mono text-sm text-[var(--accent-text)] font-bold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-bold">{step.t}</h3>
                <p className="text-sm text-[var(--muted)]">{step.d}</p>
              </motion.li>
            ))}
          </ol>
        </motion.section>
      )}

      {/* ── Creator story ── */}
      {shown("story") && (
        <motion.section {...REVEAL} className={cn("wrap mt-20", hidden("story") && "opacity-40")}>
          <div className="grid gap-4 max-w-3xl">
            <span className="eyebrow">About {creatorLabel}</span>
            <EditableText as="h2" editing={editing} value={pg.titles?.story} fallback="Why I'm doing this" maxLength={60} onChange={(v) => setTitle("story", v)} className="text-3xl sm:text-4xl font-extrabold" />
            <EditableText
              editing={editing}
              multiline
              value={pg.story}
              fallback={
                meta?.story ??
                listing.creatorBio ??
                `I'm putting ${patches.length} logo spots on my ${surfaceWord}${listing.eventName ? ` for ${listing.eventName}` : ""}. Every spot you take helps cover the costs, and your brand gets seen in person and in every photo.`
              }
              maxLength={1200}
              onChange={(v) => setPg({ story: v })}
              className="text-lg leading-relaxed"
            />
            {listing.creatorHandle && (
              <Link href={`/${listing.creatorHandle}`} className="justify-self-start inline-flex items-center gap-2 text-sm font-semibold no-underline text-[var(--ink)] hover:text-[var(--accent-text)]">
                <Avatar creatorAvatar={listing.creatorAvatar} label={creatorLabel} /> See {creatorLabel}&apos;s page <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </motion.section>
      )}

      {/* ── FAQ ── */}
      {shown("faq") && (
        <motion.section {...REVEAL} id="faq" className={cn("wrap mt-20 scroll-mt-20", hidden("faq") && "opacity-40")}>
          <div className="grid gap-3 max-w-3xl">
            <span className="eyebrow">Questions</span>
            <EditableText as="h2" editing={editing} value={pg.titles?.faq} fallback="Before you bid" maxLength={60} onChange={(v) => setTitle("faq", v)} className="text-3xl sm:text-4xl font-extrabold" />
            {editing && (
              <div className="grid gap-2">
                {(draft.faq ?? meta?.faq ?? []).map((f, i) => (
                  <div key={i} className="rounded-2xl border-[1.5px] border-[var(--soft)] p-3 grid gap-2">
                    <input className="font-bold bg-transparent outline-2 outline-dashed outline-[var(--accent)]/70 rounded-lg" value={f.q} placeholder="Question" maxLength={120} aria-label={`Question ${i + 1}`}
                      onChange={(e) => setDraft((d) => ({ ...d, faq: (d.faq ?? meta?.faq ?? []).map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) }))} />
                    <textarea className="text-sm bg-transparent outline-2 outline-dashed outline-[var(--accent)]/70 rounded-lg resize-y" rows={2} value={f.a} placeholder="Answer" maxLength={500} aria-label={`Answer ${i + 1}`}
                      onChange={(e) => setDraft((d) => ({ ...d, faq: (d.faq ?? meta?.faq ?? []).map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) }))} />
                    <button className="text-xs text-[var(--muted)] justify-self-start hover:text-[var(--ink)]"
                      onClick={() => setDraft((d) => ({ ...d, faq: (d.faq ?? meta?.faq ?? []).filter((_, j) => j !== i) }))}>Remove</button>
                  </div>
                ))}
                {(draft.faq ?? meta?.faq ?? []).length < 8 && (
                  <button className="btn-base btn-small justify-self-start" onClick={() => setDraft((d) => ({ ...d, faq: [...(d.faq ?? meta?.faq ?? []), { q: "", a: "" }] }))}>
                    Add your own question
                  </button>
                )}
                <p className="text-xs text-[var(--muted)]">Your questions show first. The standard ones below are always included.</p>
              </div>
            )}
            <div className="border-t-[1.5px] border-[var(--soft)]">
              {(editing ? faq.slice(creatorFaq.length) : faq).map((f) => (
                <details key={f.q} className="group border-b-[1.5px] border-[var(--soft)] py-4">
                  <summary className="font-bold cursor-pointer list-none flex justify-between gap-3">
                    {f.q}
                    <Plus size={18} className="text-[var(--muted)] flex-none transition-transform group-open:rotate-45" />
                  </summary>
                  <p className="text-[var(--muted)] mt-2 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Edit toolbar ── */}
      {editing && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(760px,calc(100vw-24px))] card-surface p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold mr-1">Colour</span>
            {(Object.keys(PAGE_ACCENTS) as PageAccent[]).map((k) => (
              <button
                key={k}
                aria-label={PAGE_ACCENTS[k].label}
                aria-pressed={(draft.accent ?? "orange") === k}
                onClick={() => setPg({ accent: k })}
                className={cn("w-7 h-7 rounded-lg border-2 border-[var(--line)]", (draft.accent ?? "orange") === k && "ring-4 ring-[var(--accent)]/40")}
                style={{ background: PAGE_ACCENTS[k].accent }}
              />
            ))}
          </div>
          <details className="relative">
            <summary className="btn-base btn-small cursor-pointer list-none">Background</summary>
            <div className="absolute bottom-full mb-2 left-0 w-[300px] card-surface p-3 z-10">
              <StagePicker value={draft.stage} onChange={(stage) => setDraft((d) => ({ ...d, stage }))} />
            </div>
          </details>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PAGE_SECTIONS.map((sec) => (
              <button key={sec} onClick={() => toggleSection(sec)}
                className={cn("text-xs font-semibold rounded-full px-2.5 py-1 border-[1.5px] inline-flex items-center gap-1", hidden(sec) ? "border-[var(--soft)] text-[var(--muted)]" : "border-[var(--line)]")}>
                {hidden(sec) ? <EyeOff size={12} /> : <Eye size={12} />}
                {{ sponsors: "Sponsors", how: "How it works", story: "Story", activity: "Activity", faq: "FAQ" }[sec]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            <button className="btn-base btn-small btn-ghost" onClick={() => setDraft({})} title="Back to the default text and colour"><ResetIcon size={13} /> Defaults</button>
            <button className="btn-base btn-small" onClick={() => { setDraft(saved); setEditing(false); }}>Cancel</button>
            <button className="btn-base btn-small btn-primary" onClick={savePage}><Save size={13} /> Save</button>
          </div>
        </div>
      )}

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

      {/* ── Phones: the selected spot and its bid button, always one tap away ── */}
      {biddingOpen && !isCreator && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t-[1.5px] border-[var(--soft)] bg-[var(--card)]/95 backdrop-blur-md px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3">
          <button className="min-w-0 flex-1 text-left" onClick={() => focusSpot(selected.id)} aria-label={`Open ${selected.label}`}>
            <span className="block font-mono text-[11px] text-[var(--muted)]">
              Spot {String(selected.id + 1).padStart(2, "0")}{mounted ? ` · ends in ${countdown.text}` : ""}
            </span>
            <b className="block truncate">{selected.label} · {usd(selected.topBid > 0n ? selected.topBid : selected.floor)}</b>
          </button>
          {selected.bought ? (
            <Pill variant="won">Bought</Pill>
          ) : me && selected.topBidder === me ? (
            <Pill variant="top">You lead</Pill>
          ) : (
            <Button variant="primary" onClick={() => focusSpot(selected.id)}>Bid {usd(minNext(selected))}</Button>
          )}
        </div>
      )}
      <section className="wrap mt-24 pt-10 border-t-[1.5px] border-[var(--soft)]">
        <Reveal className="grid gap-6 justify-items-center">
          <span className="eyebrow">Built with</span>
          <PoweredBy />
        </Reveal>
      </section>
    </main>
    </MotionConfig>
  );
}

/** Who leads a spot: their logo (or initial) and name, or that it's still open. */
function Leader({ p, me }: { p: LivePatch; me?: string }) {
  if (!p.topBidder) return <span className="text-[var(--muted)]">No bids yet</span>;
  return (
    <>
      <BrandMark p={p} size={22} />
      <span className="truncate font-semibold">{p.topBidder === me ? "You" : p.brandName ?? formatShortAddress(p.topBidder)}</span>
      {p.brandVerified && <BadgeCheck size={14} className="text-[var(--green)] flex-none" aria-label={`Verified brand · ${p.brandVerified}`} />}
    </>
  );
}

function BrandMark({ p, size }: { p: LivePatch; size: number }) {
  return p.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.logoUrl} alt="" width={size} height={size} className="object-contain rounded-md flex-none" style={{ width: size, height: size }} />
  ) : (
    <WalletAvatar name={p.brandName} wallet={p.topBidder} size={size} className="!border" />
  );
}

function Avatar({ creatorAvatar, label }: { creatorAvatar: string | null | undefined; label: string }) {
  return (
    <span className="w-8 h-8 rounded-full overflow-hidden grid place-items-center font-extrabold bg-[var(--p5)] text-[#0B0B0C] flex-none text-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {creatorAvatar ? <img src={creatorAvatar} alt="" className="w-full h-full object-cover" /> : label.replace("@", "").slice(0, 1).toUpperCase()}
    </span>
  );
}

function Fact({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5 py-3.5 border-b-[1.5px] border-[var(--soft)] first:pt-0 last:border-b-0">
      <span className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center flex-none">{icon}</span>
      <span className="grid gap-0.5">
        <dt className="font-bold">{title}</dt>
        <dd className="m-0 text-sm text-[var(--muted)]">{children}</dd>
      </span>
    </div>
  );
}

/**
 * What a spot shows when the pointer rests on it in the photo: which spot, who leads and the next bid. It sits above the
 * spot (below it near the top of the photo), never takes the pointer, and is not shown on touch screens.
 */
function SpotHover({ open, patch, live, next }: { open: boolean; patch: PatchData | null; live: LivePatch | null; next: bigint | null }) {
  if (!patch || !live || live.bought) return null;
  const below = patch.y < 22;
  const left = Math.min(Math.max(patch.x + patch.w / 2, 22), 78);
  return (
    <div
      role="status"
      className="absolute z-30 pointer-events-none w-max max-w-[220px] rounded-xl border-2 border-[var(--ink)] bg-[var(--paper)] px-3 py-2 text-left shadow-[3px_3px_0_var(--ink)]"
      style={{ left: `${left}%`, top: below ? `${patch.y + patch.h + 2}%` : `${patch.y - 2}%`, transform: below ? "translateX(-50%)" : "translate(-50%, -100%)" }}
    >
      <b className="block text-sm leading-tight">{live.label}</b>
      <span className="block text-xs text-[var(--muted)] mt-0.5">
        {live.topBidder ? <>Leading: <b className="text-[var(--ink)]">{patch.brand}</b> · {usd(live.topBid)}</> : <>No bids yet · from {usd(live.floor)}</>}
      </span>
      {open && next !== null && <span className="block text-xs font-bold text-[var(--accent-text)] mt-1">Click to bid {usd(next)}</span>}
    </div>
  );
}
