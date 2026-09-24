"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BadgeCheck, Car, Check, Clock, Flame, Link2, Shirt, Sparkles, Users, Zap } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData } from "@/components/surface/Patch";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatCountdown, formatTimeAgo, formatUsdc } from "@/lib/format";
import { fromWire, type SurfaceKind, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";
import { PAGE_ACCENTS } from "@/lib/market/page";
import { useIndexerSync } from "@/lib/market/useIndexerSync";

export interface FeedStats {
  bids: number;
  bids24h: number;
  last: { who: string; label: string; amount: number; time: number } | null;
}
export interface FeedActivity {
  who: string;
  verified: boolean;
  label: string;
  amount: number;
  time: number;
  title: string;
  href: string;
}

type Tab = "foryou" | "ending" | "hot" | "new";
type Surface = "all" | SurfaceKind;
const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const usd = (v: bigint | number) => formatUsdc(typeof v === "bigint" ? Number(v) / 1e6 : v);

export function ExploreFeed({ cards: wire, stats, activity }: { cards: Wire<ListingCard[]>; stats: Record<number, FeedStats>; activity: FeedActivity[] }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("foryou");
  const [surface, setSurface] = useState<Surface>("all");
  const [mounted, setMounted] = useState(false);
  useIndexerSync();
  useEffect(() => setMounted(true), []);

  // New bids anywhere: refresh the feed (at most every few seconds).
  const last = useRef(0);
  useEffect(() => {
    const channel = supabase()
      .channel(`explore:${CHAIN_ID}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `chain_id=eq.${CHAIN_ID}` }, () => {
        if (Date.now() - last.current < 4000) return;
        last.current = Date.now();
        router.refresh();
      })
      .subscribe();
    return () => {
      void supabase().removeChannel(channel);
    };
  }, [router]);

  const now = mounted ? Date.now() : 0;
  const live = (c: ListingCard) => c.status === 1 && c.biddingEndsAt > now;
  const feed = useMemo(() => {
    const list = cards.filter((c) => surface === "all" || c.surface === surface);
    const s = (c: ListingCard) => stats[c.id] ?? { bids: 0, bids24h: 0, last: null };
    switch (tab) {
      case "ending":
        return list.filter(live).sort((a, b) => a.biddingEndsAt - b.biddingEndsAt);
      case "hot":
        return [...list].sort((a, b) => s(b).bids24h - s(a).bids24h || s(b).bids - s(a).bids);
      case "new":
        return [...list].sort((a, b) => b.createdBlock - a.createdBlock);
      default:
        // Live first, most active first, then everything else newest first.
        return [...list].sort((a, b) => Number(live(b)) - Number(live(a)) || s(b).bids24h - s(a).bids24h || b.createdBlock - a.createdBlock);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, stats, tab, surface, now]);

  // One bubble per creator, live creators first.
  const creators = useMemo(() => {
    const seen = new Map<string, { card: ListingCard; live: boolean }>();
    for (const c of cards) {
      const key = c.creatorHandle ?? c.href.split("/")[1];
      const prev = seen.get(key);
      if (!prev || (!prev.live && live(c))) seen.set(key, { card: c, live: live(c) });
    }
    return [...seen.values()].sort((a, b) => Number(b.live) - Number(a.live)).slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, now]);

  return (
    <main className="wrap pt-6 pb-24 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="grid gap-6 min-w-0">
        {/* Creators, like stories */}
        {creators.length > 0 && (
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
            {creators.map(({ card, live: isLive }) => (
              <Link key={card.href} href={card.href} className="grid justify-items-center gap-1.5 w-[72px] flex-none text-center">
                <span className={cn("w-16 h-16 rounded-full p-[3px]", isLive ? "bg-[conic-gradient(var(--accent),#D9CCFF,#FFE58F,var(--accent))]" : "bg-[var(--soft)]")}>
                  <span className="w-full h-full rounded-full border-2 border-[var(--paper)] overflow-hidden bg-[var(--p5)] grid place-items-center font-extrabold text-lg text-[#0B0B0C]">
                    {card.creatorAvatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={card.creatorAvatar} alt="" className="w-full h-full object-cover" />
                    ) : card.canvasImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={card.canvasImage} alt="" className="w-full h-full object-cover object-top scale-[1.8] origin-top" />
                    ) : (
                      card.creatorLabel.replace("@", "").slice(0, 1).toUpperCase()
                    )}
                  </span>
                </span>
                <span className="text-xs font-semibold truncate w-full">{card.creatorLabel}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Seg
            options={[
              { value: "foryou", label: "For you" },
              { value: "ending", label: "Ending soon" },
              { value: "hot", label: "Hot" },
              { value: "new", label: "New" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          <div className="flex gap-1.5">
            {([
              ["all", "All", Sparkles],
              ["outfit", "Outfits", Shirt],
              ["car", "Cars", Car],
              ["hoodie", "Hoodies", Users],
            ] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setSurface(v)}
                aria-pressed={surface === v}
                className="text-xs font-semibold rounded-full px-3 py-1.5 border-[1.5px] border-[var(--line)] inline-flex items-center gap-1.5 bg-[var(--card)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        {feed.length === 0 ? (
          <div className="card-surface p-10 text-center grid justify-items-center gap-3">
            <h2 className="text-2xl font-extrabold">{tab === "ending" ? "Nothing is closing soon" : "Nothing here yet"}</h2>
            <p className="muted max-w-[42ch]">Be the first: put patches on your outfit, car or team hoodie and let brands bid in USDC.</p>
            <Link href="/studio" className="btn-base btn-primary">Get patched</Link>
          </div>
        ) : (
          feed.map((c, i) => <FeedCard key={c.id} card={c} stats={stats[c.id]} mounted={mounted} index={i} />)
        )}
      </div>

      {/* Right rail */}
      <aside className="hidden lg:grid gap-5 sticky top-20">
        <div className="card-surface">
          <div className="flex justify-between items-center px-4 pt-3.5 pb-1">
            <h3 className="text-lg font-bold">Live now</h3>
            <span className="dot live" />
          </div>
          <ul className="grid px-4 pb-3">
            {activity.length === 0 && <li className="py-3 text-sm muted">No bids yet. The first one shows up here.</li>}
            {activity.map((a, i) => (
              <li key={i} className="py-2.5 border-b border-dashed border-[var(--soft)] last:border-0 text-sm">
                <Link href={a.href} className="grid gap-0.5 hover:opacity-80">
                  <span className="flex items-center gap-1 min-w-0">
                    <b className="truncate">{a.who}</b>
                    {a.verified && <BadgeCheck size={13} className="text-[var(--green)] flex-none" />}
                    <span className="muted flex-none">bid</span>
                    <b className="font-mono flex-none">{usd(a.amount)}</b>
                  </span>
                  <span className="text-xs muted truncate">on {a.label} · {a.title}{mounted ? ` · ${formatTimeAgo(a.time)}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-surface p-5 grid gap-3 bg-[var(--accent-soft)]">
          <b className="text-lg">Your fit is ad space</b>
          <p className="text-sm">Put patches on your outfit, car or team hoodie. Brands bid in USDC and escrow pays you when you show up.</p>
          <Link href="/studio" className="btn-base btn-primary justify-self-start">Get patched</Link>
        </div>
      </aside>
    </main>
  );
}

function FeedCard({ card, stats, mounted, index }: { card: ListingCard; stats?: FeedStats; mounted: boolean; index: number }) {
  const accent = PAGE_ACCENTS[card.accent];
  const cd = formatCountdown(card.biddingEndsAt);
  const isLive = card.status === 1 && !cd.hasEnded;
  const open = card.patchCount - card.patchesWithBids;
  const figurePatches: PatchData[] = card.patches
    .filter((p) => p.side === card.viewId)
    .map((p) => ({
      id: p.id, name: p.label, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
      topBid: Number(p.topBid) / 1e6, brand: p.topBidder ? p.brandName ?? "Taken" : null, logo: p.logoUrl,
      c: PASTELS[p.id % PASTELS.length], bought: p.bought, number: p.id + 1,
    }));

  const copyLink = () =>
    navigator.clipboard.writeText(`${window.location.origin}${card.href}`).then(() => toast("Link copied.")).catch(() => {});

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index, 3) * 0.05, ease: [0.2, 0.8, 0.2, 1] }}
      className="card-surface overflow-hidden"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="w-10 h-10 rounded-full border-2 border-[var(--line)] overflow-hidden bg-[var(--p5)] grid place-items-center font-extrabold text-[#0B0B0C] flex-none">
          {card.creatorAvatar ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={card.creatorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            card.creatorLabel.replace("@", "").slice(0, 1).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <b className="flex items-center gap-1 truncate">
            {card.creatorLabel}
            {card.creatorVerified && <Check size={14} className="text-[var(--green)] flex-none" aria-label="X verified" />}
          </b>
          <span className="text-xs muted truncate block">
            {[card.creatorHandle && card.creatorLabel !== `@${card.creatorHandle}` ? `@${card.creatorHandle}` : null, card.eventName, card.surface === "car" ? "Car" : card.surface === "hoodie" ? "Team hoodie" : "Outfit"]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <span
          className={cn(
            "ml-auto text-xs font-semibold rounded-full px-2.5 py-1 border-[1.5px] inline-flex items-center gap-1.5 flex-none",
            isLive ? "border-[var(--line)] bg-[var(--card)]" : "border-[var(--soft)] muted",
          )}
        >
          {isLive ? <span className="dot live" /> : null}
          {!mounted ? "Live" : isLive ? `Live · ${cd.text.split(" ").slice(0, 2).join(" ")}` : card.status === 2 ? "Delivering" : "Closed"}
        </span>
      </header>

      <Link href={card.href} className="block px-4 pb-3">
        <h2 className="text-2xl sm:text-[28px] font-extrabold leading-tight tracking-tight">{card.headline ?? card.title}</h2>
      </Link>

      <Link href={card.href} className="block relative" style={{ background: accent.soft }}>
        <div className={cn("mx-auto py-5", card.surface === "car" ? "max-w-[560px] px-4" : "max-w-[300px]")}>
          <SurfaceFigure surface={card.surface} imageUrl={card.canvasImage} patches={figurePatches} mode="static" showPrices={false} />
        </div>
        <span className="absolute top-3 left-3 text-xs font-bold rounded-full px-2.5 py-1 bg-[var(--card)] border-[1.5px] border-[var(--line)]">
          {card.patchesWithBids}/{card.patchCount} taken
        </span>
        <span className="absolute bottom-3 right-3 font-mono text-sm font-bold rounded-xl px-3 py-1.5 border-2 border-[#0B0B0C]" style={{ background: accent.accent, color: accent.on }}>
          {usd(card.topBidsTotal)} in bids
        </span>
      </Link>

      {stats?.last && (
        <p className="px-4 pt-3 text-sm flex items-center gap-1.5 min-w-0">
          <Zap size={14} className="text-[var(--accent-text)] flex-none" />
          <span className="truncate">
            <b>{stats.last.who}</b> bid <b className="font-mono">{usd(stats.last.amount)}</b> on {stats.last.label}
          </span>
          <span className="muted text-xs flex-none">{mounted ? formatTimeAgo(stats.last.time) : ""}</span>
        </p>
      )}

      <footer className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <span className="text-sm muted flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Flame size={14} /> {stats?.bids ?? 0} {(stats?.bids ?? 0) === 1 ? "bid" : "bids"}</span>
          <span className="inline-flex items-center gap-1"><Clock size={14} /> {open} open</span>
        </span>
        <div className="ml-auto flex gap-2">
          <button onClick={copyLink} className="btn-base btn-small" aria-label="Copy link"><Link2 size={14} /></button>
          <Link href={isLive ? `${card.href}#spots` : card.href} className="btn-base btn-small btn-primary">{isLive ? "Bid on a spot" : "See it"}</Link>
        </div>
      </footer>
    </motion.article>
  );
}
