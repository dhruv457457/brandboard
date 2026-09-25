"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { BadgeCheck, Car, Check, Clock, Flame, Link2, Search, Shirt, Sparkles, Users, X, Zap } from "lucide-react";
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

type Tab = "trending" | "ending" | "new" | "closed";
type Surface = "all" | SurfaceKind;
const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const usd = (v: bigint | number) => formatUsdc(typeof v === "bigint" ? Number(v) / 1e6 : v);
const EMPTY: FeedStats = { bids: 0, bids24h: 0, last: null };
const HOT_BIDS = 3;

/**
 * Explore as a board: a spotlight bento (hottest live auction + the two closing soonest), a live bid ticker,
 * creators as stitched badges, then search, filters and a dense grid of same-size tiles.
 */
export function ExploreFeed({ cards: wire, stats, activity }: { cards: Wire<ListingCard[]>; stats: Record<number, FeedStats>; activity: FeedActivity[] }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("trending");
  const [surface, setSurface] = useState<Surface>("all");
  const [event, setEvent] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(0);
  useIndexerSync();
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // New bids anywhere: refresh the board (at most every few seconds).
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

  const s = (c: ListingCard) => stats[c.id] ?? EMPTY;
  const isLive = (c: ListingCard) => c.status === 1 && (now === 0 || c.biddingEndsAt > now);
  const liveCards = cards.filter(isLive);
  const heat = (c: ListingCard) => s(c).bids24h * 3 + s(c).bids + c.patchesWithBids;

  const spotlight = [...liveCards].sort((a, b) => heat(b) - heat(a))[0] ?? null;
  const endingSoon = liveCards.filter((c) => c.id !== spotlight?.id).sort((a, b) => a.biddingEndsAt - b.biddingEndsAt).slice(0, 2);

  const events = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) if (c.eventName) m.set(c.eventName, (m.get(c.eventName) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const creators = useMemo(() => {
    const m = new Map<string, { card: ListingCard; live: number; raised: bigint }>();
    for (const c of cards) {
      const key = c.creatorHandle ?? c.href.split("/")[1];
      const e = m.get(key) ?? { card: c, live: 0, raised: 0n };
      if (isLive(c)) e.live += 1;
      e.raised += c.topBidsTotal;
      m.set(key, e);
    }
    return [...m.entries()].sort((a, b) => b[1].live - a[1].live || Number(b[1].raised - a[1].raised)).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, now]);

  const q = query.trim().toLowerCase();
  const grid = useMemo(() => {
    let list = cards.filter((c) => (surface === "all" || c.surface === surface) && (!event || c.eventName === event));
    if (q) list = list.filter((c) => [c.title, c.headline, c.creatorLabel, c.creatorHandle, c.eventName].some((v) => v?.toLowerCase().includes(q)));
    switch (tab) {
      case "ending":
        return list.filter(isLive).sort((a, b) => a.biddingEndsAt - b.biddingEndsAt);
      case "new":
        return list.filter(isLive).sort((a, b) => b.createdBlock - a.createdBlock);
      case "closed":
        return list.filter((c) => !isLive(c)).sort((a, b) => b.createdBlock - a.createdBlock);
      default:
        return [...list].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || heat(b) - heat(a));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, stats, tab, surface, event, q, now]);

  const filtering = !!q || !!event || surface !== "all" || tab !== "trending";

  return (
    <main className="wrap pt-6 pb-24 grid gap-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="eyebrow">Explore</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-1">Live on Patched</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-[var(--muted)] flex items-center gap-2">
            <span className="dot live" /> {liveCards.length} live auction{liveCards.length === 1 ? "" : "s"} · {cards.reduce((n, c) => n + c.patchCount - c.patchesWithBids, 0)} open spots
          </p>
          <Link href="/events" className="btn-base btn-small">Browse by event</Link>
        </div>
      </header>

      {/* ── Spotlight bento ── */}
      {spotlight && !filtering && (
        <section className="grid gap-4 lg:grid-cols-[1.45fr_1fr] items-stretch">
          <SpotlightTile card={spotlight} stats={s(spotlight)} now={now} />
          <div className="grid gap-4 content-start">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)] flex items-center gap-1.5"><Clock size={14} /> Ending soon</h2>
            {endingSoon.length ? (
              endingSoon.map((c) => <CompactTile key={c.id} card={c} stats={s(c)} now={now} />)
            ) : (
              <div className="card-surface p-5 text-sm text-[var(--muted)]">Nothing else is live right now. Be the next one.</div>
            )}
            <Link href="/studio" className="card-surface p-4 flex items-center justify-between gap-3 bg-[var(--accent-soft)] hover:-translate-y-0.5 transition-transform">
              <span>
                <b className="block">Your fit is ad space</b>
                <span className="text-sm">List your outfit, car or team hoodie in minutes.</span>
              </span>
              <span className="btn-base btn-small btn-primary flex-none">Get patched</span>
            </Link>
          </div>
        </section>
      )}

      {/* ── Live bid ticker ── */}
      {activity.length > 0 && !filtering && (
        <div className="card-surface !rounded-2xl overflow-hidden bg-[var(--ink)] text-[var(--paper)] py-2.5" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
          <div className="flex w-max animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex gap-8 pr-8 text-sm" aria-hidden={copy === 1}>
                {activity.map((a, i) => (
                  <Link key={i} href={a.href} className="inline-flex items-center gap-2 whitespace-nowrap hover:opacity-80">
                    <Zap size={13} className="text-[var(--accent)]" />
                    <b>{a.who}</b>
                    {a.verified && <BadgeCheck size={13} className="text-[#4ADE80]" />}
                    <span className="opacity-70">bid</span>
                    <b className="font-mono text-[var(--accent)]">{usd(a.amount)}</b>
                    <span className="opacity-70">on {a.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Creators as stitched badges ── */}
      {creators.length > 1 && !filtering && (
        <section className="grid gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">Creators</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {creators.map(([key, { card, live, raised }], i) => (
              <Link
                key={key}
                href={`/${key}`}
                className="relative flex-none flex items-center gap-2.5 rounded-2xl border-2 border-[var(--line)] bg-[var(--card)] pl-2 pr-4 py-2 shadow-[3px_3px_0_var(--shadow)] hover:-translate-y-0.5 transition-transform"
                style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i % 4]}deg` }}
              >
                <span className="absolute inset-[4px] rounded-xl border-[1.5px] border-dashed border-[var(--line)]/30 pointer-events-none" />
                <Avatar card={card} size={34} />
                <span className="grid leading-tight">
                  <b className="text-sm flex items-center gap-1">{card.creatorLabel}{card.creatorVerified && <Check size={12} className="text-[var(--green)]" />}</b>
                  <span className="text-xs text-[var(--muted)]">{live ? `${live} live` : "no live auction"} · {usd(raised)} bid</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Controls ── */}
      <section className="grid gap-3">
        <h2 className="text-2xl font-extrabold">All auctions</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators, events, listings"
              className="w-full border-2 border-[var(--line)] rounded-xl pl-9 pr-9 py-2 bg-[var(--card)] text-sm"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-md hover:bg-[var(--soft)]">
                <X size={14} />
              </button>
            )}
          </label>
          <Seg
            options={[
              { value: "trending", label: "Trending" },
              { value: "ending", label: "Ending soon" },
              { value: "new", label: "New" },
              { value: "closed", label: "Past" },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            ["all", "All", Sparkles],
            ["outfit", "Outfits", Shirt],
            ["car", "Cars", Car],
            ["hoodie", "Team hoodies", Users],
          ] as const).map(([v, label, Icon]) => (
            <Chip key={v} on={surface === v} onClick={() => setSurface(v)}><Icon size={13} /> {label}</Chip>
          ))}
          {events.length > 0 && <span className="w-px bg-[var(--soft)] mx-1" />}
          {events.map(([name, n]) => (
            <Chip key={name} on={event === name} onClick={() => setEvent(event === name ? null : name)}>{name} <span className="opacity-60">{n}</span></Chip>
          ))}
        </div>
      </section>

      {/* ── Grid ── */}
      {grid.length === 0 ? (
        <div className="card-surface p-10 text-center grid justify-items-center gap-3">
          <h2 className="text-2xl font-extrabold">{q ? `Nothing matches "${query.trim()}"` : tab === "closed" ? "No past auctions yet" : "Nothing here yet"}</h2>
          <p className="muted max-w-[42ch]">Put patches on your outfit, car or team hoodie and let brands bid in USDC.</p>
          <Link href="/studio" className="btn-base btn-primary">Get patched</Link>
        </div>
      ) : (
        <section className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {grid.map((c, i) => <Tile key={c.id} card={c} stats={s(c)} now={now} index={i} />)}
        </section>
      )}
    </main>
  );
}

// ─────────────────────────────── pieces ───────────────────────────────

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="text-xs font-semibold rounded-full px-3 py-1.5 border-[1.5px] border-[var(--line)] inline-flex items-center gap-1.5 bg-[var(--card)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
    >
      {children}
    </button>
  );
}

function Avatar({ card, size }: { card: ListingCard; size: number }) {
  return (
    <span
      className="rounded-xl border-2 border-[var(--line)] overflow-hidden bg-[var(--p5)] grid place-items-center font-extrabold text-[#0B0B0C] flex-none"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {card.creatorAvatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={card.creatorAvatar} alt="" className="w-full h-full object-cover" />
      ) : (
        card.creatorLabel.replace("@", "").slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** The cutout with its numbered spots, fitted inside a fixed box (height-driven for people, width-driven for cars). */
function Stage({ card, className, pad = "p-3" }: { card: ListingCard; className?: string; pad?: string }) {
  const accent = PAGE_ACCENTS[card.accent];
  const patches: PatchData[] = card.patches
    .filter((p) => p.side === card.viewId)
    .map((p) => ({
      id: p.id, name: p.label, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
      topBid: Number(p.topBid) / 1e6, brand: p.topBidder ? p.brandName ?? " " : null, logo: p.logoUrl,
      c: PASTELS[p.id % PASTELS.length], bought: p.bought,
    }));
  const wide = card.surface === "car";
  return (
    <div className={cn("relative overflow-hidden", className)} style={{ background: accent.soft }}>
      <div className={cn("absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.04]", pad)}>
        {wide ? (
          <div className="w-full">
            <SurfaceFigure surface={card.surface} imageUrl={card.canvasImage} patches={patches} mode="static" showPrices={false} lazy />
          </div>
        ) : (
          <SurfaceFigure surface={card.surface} imageUrl={card.canvasImage} patches={patches} mode="static" showPrices={false} lazy className="!w-auto h-full" />
        )}
      </div>
    </div>
  );
}

function Progress({ card }: { card: ListingCard }) {
  const pct = card.patchCount ? (card.patchesWithBids / card.patchCount) * 100 : 0;
  const accent = PAGE_ACCENTS[card.accent];
  return (
    <div className="h-2 rounded-full bg-[var(--soft)] overflow-hidden border border-[var(--line)]/20">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent.accent }} />
    </div>
  );
}

function StatusChip({ card, now }: { card: ListingCard; now: number }) {
  const cd = formatCountdown(card.biddingEndsAt);
  const live = card.status === 1 && !cd.hasEnded;
  return (
    <span
      className={cn(
        "text-[11px] font-bold rounded-full px-2 py-0.5 border-[1.5px] inline-flex items-center gap-1 bg-[var(--card)]",
        live ? "border-[var(--line)]" : "border-[var(--soft)] text-[var(--muted)]",
        live && cd.isUrgent && "bg-[var(--accent)] text-[var(--on-accent)]",
      )}
    >
      {live && <span className="dot live" />}
      {!now ? "Live" : live ? cd.text.split(" ").slice(0, 2).join(" ") : card.status === 2 ? "Delivering" : card.status === 3 ? "Completed" : "Closed"}
    </span>
  );
}

/** The grid tile: same size everywhere, image first, the numbers that matter underneath. */
function Tile({ card, stats, now, index }: { card: ListingCard; stats: FeedStats; now: number; index: number }) {
  const hot = stats.bids24h >= HOT_BIDS;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 11) * 0.04, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Link href={card.href} className="group card-surface !p-0 overflow-hidden grid hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--shadow)] transition-[transform,box-shadow] duration-200">
        <div className="relative">
          <Stage card={card} className="aspect-[4/5]" />
          <span className="absolute top-2 left-2"><StatusChip card={card} now={now} /></span>
          {hot && (
            <span className="absolute top-2 right-2 text-[11px] font-bold rounded-full px-2 py-0.5 bg-[var(--ink)] text-[var(--paper)] inline-flex items-center gap-1">
              <Flame size={11} /> Hot
            </span>
          )}
          <span className="absolute bottom-2 right-2 font-mono text-xs font-bold rounded-lg px-2 py-1 bg-[var(--card)] border-[1.5px] border-[var(--line)]">
            {usd(card.topBidsTotal)}
          </span>
        </div>
        <div className="p-3 grid gap-2 border-t-2 border-[var(--line)]">
          <span className="flex items-center gap-1.5 min-w-0 text-xs">
            <Avatar card={card} size={20} />
            <b className="truncate">{card.creatorLabel}</b>
            {card.creatorVerified && <Check size={12} className="text-[var(--green)] flex-none" />}
          </span>
          <b className="text-[15px] leading-snug line-clamp-2 min-h-[2.6em]">{card.headline ?? card.title}</b>
          <Progress card={card} />
          <span className="flex justify-between text-xs text-[var(--muted)]">
            <span>{card.patchesWithBids}/{card.patchCount} spots</span>
            <span>{stats.bids} {stats.bids === 1 ? "bid" : "bids"}</span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/** Ending-soon row: small image, big countdown. */
function CompactTile({ card, stats, now }: { card: ListingCard; stats: FeedStats; now: number }) {
  const cd = formatCountdown(card.biddingEndsAt);
  return (
    <Link href={card.href} className="group card-surface !p-0 overflow-hidden grid grid-cols-[112px_1fr] hover:-translate-y-0.5 transition-transform">
      <Stage card={card} className="h-full min-h-[128px] border-r-2 border-[var(--line)]" pad="p-2" />
      <div className="p-3 grid gap-1.5 content-center min-w-0">
        <span className="flex items-center gap-1.5 text-xs min-w-0"><Avatar card={card} size={18} /><b className="truncate">{card.creatorLabel}</b></span>
        <b className="leading-snug line-clamp-2">{card.headline ?? card.title}</b>
        <span className={cn("font-mono text-sm font-bold inline-flex items-center gap-1", cd.isUrgent && "text-[var(--accent-text)]")}>
          <Clock size={13} /> {now ? cd.text : ""}
        </span>
        <Progress card={card} />
        <span className="text-xs text-[var(--muted)]">{usd(card.topBidsTotal)} · {card.patchCount - card.patchesWithBids} open · {stats.bids} bids</span>
      </div>
    </Link>
  );
}

/** The big bento tile: the hottest live auction right now. */
function SpotlightTile({ card, stats, now }: { card: ListingCard; stats: FeedStats; now: number }) {
  const accent = PAGE_ACCENTS[card.accent];
  const copyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(`${window.location.origin}${card.href}`).then(() => toast("Link copied.")).catch(() => {});
  };
  return (
    <Link href={card.href} className="group card-surface !p-0 overflow-hidden grid sm:grid-cols-[1fr_1.05fr]">
      <div className="relative">
        <Stage card={card} className="aspect-[4/3] sm:aspect-auto sm:h-full min-h-[260px] sm:min-h-[320px]" pad="p-5" />
        <span className="absolute top-3 left-3"><StatusChip card={card} now={now} /></span>
      </div>
      <div className="p-5 sm:p-6 grid gap-4 content-between border-t-2 sm:border-t-0 sm:border-l-2 border-[var(--line)]">
        <div className="grid gap-3">
          <span className="text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 justify-self-start border-2 border-[#0B0B0C]" style={{ background: accent.accent, color: accent.on }}>
            <Flame size={12} /> Spotlight
          </span>
          <span className="flex items-center gap-2 min-w-0">
            <Avatar card={card} size={32} />
            <span className="grid leading-tight min-w-0">
              <b className="truncate flex items-center gap-1">{card.creatorLabel}{card.creatorVerified && <Check size={13} className="text-[var(--green)]" />}</b>
              <span className="text-xs text-[var(--muted)] truncate">{card.eventName ?? (card.surface === "car" ? "Car" : card.surface === "hoodie" ? "Team hoodie" : "Outfit")}</span>
            </span>
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.02]">{card.headline ?? card.title}</h2>
        </div>
        <div className="grid gap-3">
          <div className="flex items-end gap-6">
            <span><b className="font-mono text-3xl tabular-nums block">{usd(card.topBidsTotal)}</b><span className="text-xs text-[var(--muted)]">in bids</span></span>
            <span><b className="font-mono text-3xl tabular-nums block">{card.patchesWithBids}/{card.patchCount}</b><span className="text-xs text-[var(--muted)]">spots taken</span></span>
          </div>
          <Progress card={card} />
          {stats.last && (
            <p className="text-sm flex items-center gap-1.5 min-w-0">
              <Zap size={14} className="text-[var(--accent-text)] flex-none" />
              <span className="truncate"><b>{stats.last.who}</b> bid <b className="font-mono">{usd(stats.last.amount)}</b> on {stats.last.label}</span>
              <span className="text-xs text-[var(--muted)] flex-none">{now ? formatTimeAgo(stats.last.time) : ""}</span>
            </p>
          )}
          <div className="flex gap-2">
            <span className="btn-base btn-primary flex-1">Bid on a spot</span>
            <button onClick={copyLink} className="btn-base" aria-label="Copy link"><Link2 size={16} /></button>
          </div>
        </div>
      </div>
    </Link>
  );
}
