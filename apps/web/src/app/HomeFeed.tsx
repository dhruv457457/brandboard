"use client";

import { stageStyle } from "@/lib/market/page";
import { Road } from "@/components/surface/Road";
import { isPrintedStatus } from "@/lib/market/listingStatus";
import { useEffect, useMemo, useState } from "react";
import { publicUrl } from "@/lib/handles";
import { MonadLogo, PrivyLogo } from "@/components/brand/PartnerLogos";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Network, Rows3, Car, Clock, Gavel, Link2, MapPin, Plus, Search, Shirt, Sparkles, Users, Zap } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { OffersForYou } from "@/components/market/OffersForYou";
import { FundYourWallet } from "@/components/wallet/FundYourWallet";
import { EventCover } from "@/components/events/EventCover";
import type { PatchData } from "@/components/surface/Patch";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { formatCountdown, formatTimeAgo, formatUsdc } from "@/lib/format";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";
import type { FeedEvent, FeedItem } from "@/lib/market/feed";
import { cn } from "@/lib/utils";
import { useAuthedFetch } from "@/lib/authedFetch";
import { ReactionBar } from "@/components/social/SpottedWall";
import { Seg } from "@/components/ui/Seg";
import type { SpottedPost } from "@/lib/spotted";

// The graph (d3, canvas) only loads when someone switches to it, so the feed stays as light as before.
const Patchwork = dynamic(() => import("@/components/graph/Patchwork").then((m) => m.Patchwork), {
  ssr: false,
  loading: () => <div className="min-h-dvh grid place-items-center text-[var(--muted)] font-semibold">Loading the graph…</div>,
});

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const SURFACE_LABEL = { outfit: "Outfit", car: "Vehicle", hoodie: "Team hoodie" } as const;

export interface HomeFeedProps {
  cards: Wire<ListingCard[]>;
  items: FeedItem[];
  events: FeedEvent[];
}

/** The signed-in home: one column of moments (listings, bids, proofs), with search, ending-soon and events alongside. */
export function HomeFeed({ cards: wire, items, events }: HomeFeedProps) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Feed or Patchwork. Kept in the URL (?view=patchwork&event=2) so a view can be shared and survives a refresh.
  const [view, setView] = useState<"feed" | "patchwork">("feed");
  const [graphEvent, setGraphEvent] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("view") !== "patchwork") return;
    setView("patchwork");
    const e = q.get("event");
    if (e !== null && /^\d{1,9}$/.test(e)) setGraphEvent(Number(e));
  }, []);
  const updateUrl = (change: (u: URL) => void) => {
    const u = new URL(window.location.href);
    change(u);
    window.history.replaceState(null, "", u);
  };
  const switchView = (v: "feed" | "patchwork") => {
    setView(v);
    updateUrl((u) => (v === "patchwork" ? u.searchParams.set("view", "patchwork") : (u.searchParams.delete("view"), u.searchParams.delete("event"))));
  };
  const viewSwitch = (
    <Seg
      ariaLabel="Home view"
      value={view}
      onChange={switchView}
      items={[
        { value: "feed", label: "Feed", icon: <Rows3 size={15} /> },
        { value: "patchwork", label: "Patchwork", icon: <Network size={15} /> },
      ]}
    />
  );

  // "Following": only moments from creators and events you follow.
  const { authenticated, ready } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [tab, setTab] = useState<"all" | "following">("all");
  const [follows, setFollows] = useState<{ profiles: Set<string>; events: Set<number> } | null>(null);
  useEffect(() => {
    if (!ready || !authenticated) return;
    let alive = true;
    authedFetch("/api/follows?mine=1")
      .then((r) => r.json())
      .then((j: { profiles: string[]; events: number[] }) => alive && setFollows({ profiles: new Set(j.profiles), events: new Set(j.events) }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, authenticated, authedFetch, tab]);
  const [reactions, setReactions] = useState<Record<string, SpottedPost["reactions"]>>({});
  const spottedIds = useMemo(() => items.flatMap((i) => (i.kind === "spotted" ? [i.postId] : [])), [items]);
  useEffect(() => {
    if (!ready || !spottedIds.length) return;
    let alive = true;
    authedFetch(`/api/reactions?ids=${spottedIds.join(",")}`)
      .then((r) => r.json())
      .then((j) => alive && setReactions(j))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, spottedIds, authenticated, authedFetch]);
  const shown = useMemo(() => {
    if (tab === "all") return items;
    return items.filter((it) => {
      const c = byId.get(it.listingId);
      return !!c && !!follows && (follows.profiles.has(c.creator.toLowerCase()) || follows.events.has(c.eventId));
    });
  }, [tab, items, byId, follows]);

  const ending = cards
    .filter((c) => c.status === 1 && c.biddingEndsAt > Date.now())
    .sort((a, b) => a.biddingEndsAt - b.biddingEndsAt)
    .slice(0, 4);

  if (view === "patchwork") {
    return (
      <Patchwork
        eventId={graphEvent}
        lead={viewSwitch}
        onEvent={(id) => {
          setGraphEvent(id);
          updateUrl((u) => u.searchParams.set("event", String(id)));
        }}
      />
    );
  }

  return (
    <div className="flex">
      <section className="flex-1 min-w-0 max-w-[640px] lg:border-r-[1.5px] lg:border-[var(--soft)] min-h-dvh">
        <header className="hidden md:flex sticky top-0 z-20 h-[56px] items-center px-5 bg-[var(--paper)]/90 backdrop-blur-md border-b-[1.5px] border-[var(--soft)]">
          <h1 className="text-xl font-extrabold">Home</h1>
          <div className="ml-auto">{viewSwitch}</div>
        </header>
        <div className="md:hidden flex justify-end px-5 pt-3">{viewSwitch}</div>

        <Composer />
        <FundYourWallet />
        <OffersForYou />
        {events.length > 0 && <EventsStrip events={events} />}

        <div className="flex gap-2 px-5 py-3 border-b-[1.5px] border-[var(--soft)]" role="tablist" aria-label="Feed">
          {([["all", "For you"], ["following", "Following"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn("h-9 px-4 rounded-full text-sm font-semibold border-[1.5px]", tab === id ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "border-[var(--soft)] hover:border-[var(--line)]")}>
              {label}
            </button>
          ))}
        </div>

        {tab === "following" && shown.length === 0 ? (
          <div className="px-6 py-16 text-center grid gap-3 justify-items-center">
            <h2 className="text-2xl font-extrabold">{follows && (follows.profiles.size || follows.events.size) ? "Nothing new from who you follow" : "Follow creators and events"}</h2>
            <p className="text-[var(--muted)] max-w-sm">Press Follow on a creator&apos;s page or an event, and their new listings, bids and proofs show up here.</p>
            <Link href="/events" className="btn-base btn-primary">Browse events</Link>
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center grid gap-3 justify-items-center">
            <h2 className="text-2xl font-extrabold">Nothing here yet</h2>
            <p className="text-[var(--muted)] max-w-sm">New listings, bids and proofs show up here as they happen.</p>
            <Link href="/studio" className="btn-base btn-primary"><Plus size={16} /> Create the first listing</Link>
          </div>
        ) : (
          <ol className="list-none m-0 p-0">
            {shown.map((it) => {
              const card = byId.get(it.listingId);
              if (!card) return null;
              return (
                <li key={it.key} className="border-b-[1.5px] border-[var(--soft)]">
                  {it.kind === "listing" && <ListingPost card={card} time={it.time} mounted={mounted} />}
                  {it.kind === "bid" && <BidPost item={it} card={card} mounted={mounted} />}
                  {it.kind === "proof" && <ProofPost item={it} card={card} mounted={mounted} />}
                  {it.kind === "spotted" && <SpottedPostCard item={it} card={card} mounted={mounted} reactions={reactions[it.postId]} />}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <aside className="hidden lg:flex flex-col gap-5 w-[340px] flex-none px-6 py-3 sticky top-0 h-dvh overflow-y-auto">
        <SearchBox />
        {ending.length > 0 && (
          <RailCard title="Ending soon">
            {ending.map((c) => (
              <Link key={c.id} href={c.href} className="flex items-center gap-3 px-4 py-2.5 no-underline text-[var(--ink)] hover:bg-[var(--soft)]">
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[15px]">{c.title}</b>
                  <span className="text-[13px] text-[var(--muted)] truncate">{c.creatorLabel} · {formatUsdc(Number(c.topBidsTotal) / 1e6)} bid</span>
                </span>
                <span className="font-mono text-xs font-semibold text-[var(--accent-text)] flex-none">
                  {mounted ? formatCountdown(c.biddingEndsAt).text.split(" ").slice(0, 2).join(" ") : ""}
                </span>
              </Link>
            ))}
          </RailCard>
        )}
        {events.length > 0 && (
          <RailCard title="Events" more={{ href: "/events", label: "All events" }}>
            {events.slice(0, 4).map((e) => (
              <Link key={e.id} href={e.href} className="grid px-4 py-2.5 no-underline text-[var(--ink)] hover:bg-[var(--soft)]">
                <b className="text-[15px]">{e.name}</b>
                <span className="text-[13px] text-[var(--muted)]">
                  {mounted ? eventWhen(e) : ""}{e.city ? ` · ${e.city}` : ""} · {e.going} going
                </span>
              </Link>
            ))}
          </RailCard>
        )}
        <p className="text-xs text-[var(--muted)] px-1 flex items-center gap-1.5 flex-wrap">Stablecoins on <MonadLogo height={11} className="text-[var(--ink)]" /> · wallets by <PrivyLogo height={11} className="text-[var(--ink)]" /></p>
      </aside>
    </div>
  );
}

/** "What are you patching next?": the fastest way to start a listing, with the four kinds of surface. */
function Composer() {
  const { walletAddress, authenticated, xHandle } = usePatchedAuth();
  const { profile } = useProfile();
  const kinds = [
    { label: "Outfit", icon: Sparkles },
    { label: "Vehicle", icon: Car },
    { label: "Team hoodie", icon: Shirt },
    { label: "Your own idea", icon: Zap },
  ];
  return (
    <div className="flex gap-3 px-4 sm:px-5 py-4 border-b-[1.5px] border-[var(--soft)]">
      {authenticated && <Avatar src={profile?.avatar_url} name={profile?.display_name ?? xHandle} wallet={walletAddress} size={44} />}
      <div className="flex-1 min-w-0 grid gap-3">
        <Link href="/studio" className="text-[19px] text-[var(--muted)] no-underline py-2 hover:text-[var(--ink)]">
          What are you patching next?
        </Link>
        <div className="flex items-center gap-1.5 flex-wrap">
          {kinds.map((k) => (
            <Link key={k.label} href="/studio" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border-[1.5px] border-[var(--line)] text-[13px] font-semibold no-underline text-[var(--ink)] hover:bg-[var(--soft)]">
              <k.icon size={14} /> {k.label}
            </Link>
          ))}
          <Link href="/studio" className="btn-base btn-small btn-primary ml-auto">Create</Link>
        </div>
      </div>
    </div>
  );
}

function eventWhen(e: FeedEvent) {
  const now = Date.now();
  if (e.startsAt <= now && e.endsAt >= now) return "Happening now";
  const days = Math.ceil((e.startsAt - now) / 86_400_000);
  return days <= 1 ? "Starts tomorrow" : `In ${days} days`;
}

/** Upcoming events as a row of covers: who's going is the reason to open the app. */
function EventsStrip({ events }: { events: FeedEvent[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="border-b-[1.5px] border-[var(--soft)] py-4">
      <div className="flex items-center justify-between px-4 sm:px-5 mb-3">
        <h2 className="text-lg font-extrabold">Coming up</h2>
        <Link href="/events" className="text-sm font-semibold no-underline text-[var(--accent-text)] hover:underline">All events</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-5 pb-1 snap-x">
        {events.map((e) => (
          <Link key={e.id} href={e.href} className="snap-start flex-none w-[240px] rounded-2xl border-2 border-[var(--line)] overflow-hidden no-underline text-[var(--ink)] bg-[var(--card)] hover:-translate-y-0.5 transition-transform">
            {/* The event's cover, or the designed patch pattern in its own pastels when it has none yet. */}
            <EventCover name={e.name} banner={e.banner} seed={e.id} variant="card" className="!border-b-0 !aspect-[2.6/1]">
              <span className="absolute left-2.5 bottom-2 inline-flex items-center gap-1.5 rounded-full bg-[#0B0B0C]/80 text-[#FAFAF7] px-2.5 py-1 text-[11px] font-semibold">
                <CalendarDays size={12} /> {mounted ? eventWhen(e) : "Upcoming"}
              </span>
            </EventCover>
            <span className="grid gap-0.5 p-3">
              <b className="truncate">{e.name}</b>
              <span className="text-[13px] text-[var(--muted)] flex items-center gap-2">
                {e.city && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {e.city}</span>}
                <span className="inline-flex items-center gap-1"><Users size={12} /> {e.going} going</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function figurePatches(card: ListingCard): PatchData[] {
  return card.patches.filter((p) => p.side === card.viewId).map((p) => ({
    id: p.id, name: p.label, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
    floor: Number(p.floor) / 1e6, topBid: Number(p.topBid) / 1e6,
    brand: p.topBidder ? (p.brandName ?? "Taken") : null, logo: p.logoUrl,
    c: PASTELS[p.id % PASTELS.length], bought: p.bought,
  }));
}

function PostHead({ card, time, mounted, verb }: { card: ListingCard; time: number; mounted: boolean; verb?: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0 text-[15px]">
      <b className="truncate">{card.creatorLabel}</b>
      {card.creatorVerified && <BadgeCheck size={15} className="text-[var(--accent-text)] flex-none" aria-label="Verified on X" />}
      {verb && <span className="text-[var(--muted)] truncate">{verb}</span>}
      <span className="text-[var(--muted)] flex-none">· {mounted ? formatTimeAgo(time) : ""}</span>
    </div>
  );
}

function copyLink(href: string) {
  navigator.clipboard.writeText(publicUrl(href)).then(() => toast("Link copied. Paste it anywhere.")).catch(() => {});
}

/** A new listing: the photo with its spots, the price to start, and Bid. */
function ListingPost({ card, time, mounted }: { card: ListingCard; time: number; mounted: boolean }) {
  const router = useRouter();
  const floors = card.patches.map((p) => Number(p.floor) / 1e6);
  const from = floors.length ? Math.min(...floors) : 0;
  const cd = formatCountdown(card.biddingEndsAt);
  const live = card.status === 1 && !cd.hasEnded;
  const open = card.patchCount - card.patchesWithBids;

  return (
    <article className="flex gap-3 px-4 sm:px-5 py-4 cursor-pointer hover:bg-[var(--soft)]/40" onClick={() => router.push(card.href)}>
      <Avatar src={card.creatorAvatar} name={card.creatorLabel} wallet={card.creator} size={44} />
      <div className="flex-1 min-w-0 grid gap-2.5">
        <div className="grid gap-0.5">
          <PostHead card={card} time={time} mounted={mounted} verb="listed spots" />
          <p className="text-[15px] leading-snug">
            {card.headline ?? card.title}
            {card.eventName && card.eventSlug && !(card.headline ?? card.title).includes(card.eventName) && (
              <> at <Link href={`/e/${card.eventSlug}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-[var(--accent-text)] no-underline hover:underline">{card.eventName}</Link></>
            )}
          </p>
        </div>
        <div className={cn("relative rounded-2xl border-2 border-[var(--line)] bg-[var(--stage)] h-[340px] p-5 flex items-center justify-center overflow-hidden", card.surface === "car" && "pb-12")} style={stageStyle(card.stage)}>
          {card.surface === "car" && <Road />}
          <SurfaceFigure surface={card.surface} imageUrl={card.canvasImage} lazy patches={figurePatches(card)} mode="static" showPrices={false} printed={isPrintedStatus(card.status, cd.hasEnded)}
            className={card.surface === "car" ? "w-full" : "h-full !w-auto max-w-full"} />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--card)] border-[1.5px] border-[var(--line)] px-2.5 py-1 text-xs font-semibold">
            {live ? <><span className="dot live" /> Live auction</> : card.status === 1 ? "Bidding ended" : "Sold, delivering"}
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-[var(--card)] border-[1.5px] border-[var(--line)] px-2.5 py-1 text-xs font-semibold">
            {SURFACE_LABEL[card.surface]}
          </span>
        </div>
        <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-[13px] text-[var(--muted)]">
          <span><b className="text-[var(--ink)]">{card.patchCount}</b> spots from <b className="text-[var(--ink)] font-mono">{formatUsdc(from)}</b></span>
          {card.patchesWithBids > 0 && <span><b className="text-[var(--ink)] font-mono">{formatUsdc(Number(card.topBidsTotal) / 1e6)}</b> bid so far</span>}
          {live && <span className="inline-flex items-center gap-1"><Clock size={13} /> {mounted ? `ends in ${cd.text}` : "live"}</span>}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Link href={card.href} className="btn-base btn-small btn-primary">
            <Gavel size={14} /> {live ? (open > 0 ? `Bid · ${open} open` : "Outbid") : "View"}
          </Link>
          <button className="btn-base btn-small btn-ghost" onClick={() => copyLink(card.href)}><Link2 size={14} /> Share</button>
        </div>
      </div>
    </article>
  );
}

/** A bid moment: "Nike took Chest on @dhruv · $120", with Outbid as the one action. */
function BidPost({ item, card, mounted }: { item: Extract<FeedItem, { kind: "bid" }>; card: ListingCard; mounted: boolean }) {
  const patch = card.patches.find((p) => p.id === item.patchId);
  const live = card.status === 1 && card.biddingEndsAt > Date.now();
  const stillLeads = patch && Number(patch.topBid) / 1e6 === item.amount;
  return (
    <article className="flex gap-3 px-4 sm:px-5 py-3.5 hover:bg-[var(--soft)]/40">
      <Avatar src={item.logo} name={item.who} wallet={item.wallet} size={44} className="!rounded-xl" />
      <div className="flex-1 min-w-0 grid gap-1.5">
        <p className="text-[15px] leading-snug">
          <b>{item.who}</b>
          {item.verified && <BadgeCheck size={14} className="inline -mt-0.5 ml-1 text-[var(--accent-text)]" aria-label="Verified brand" />}
          {" "}{item.unseated ? <><span className="font-semibold">unseated</span> <b>{item.unseated.who}</b> and </> : null}{item.buyNow ? "bought" : "took"}{" "}
          <span className="inline-block rounded-md px-1.5 font-semibold border-[1.5px] border-[var(--line)] text-[#0B0B0C]" style={{ background: `var(--${PASTELS[item.patchId % PASTELS.length]})` }}>{patch?.label ?? `Spot ${item.patchId + 1}`}</span>
          {" "}on <Link href={card.href} className="font-semibold no-underline text-[var(--ink)] hover:underline">{card.title}</Link>
          <span className="text-[var(--muted)]"> · {mounted ? formatTimeAgo(item.time) : ""}</span>
        </p>
        <div className="flex items-center gap-3">
          <b className="font-mono text-lg">{formatUsdc(item.amount)}</b>
          {!stillLeads && <span className="text-xs text-[var(--muted)]">since outbid</span>}
          {live && !item.buyNow && (
            <Link href={`${card.href}#spots`} className="btn-base btn-small ml-auto">
              <Zap size={14} /> Outbid
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/** Someone spotted a patch in the wild: their photo, who they saw, and a way to cheer. */
function SpottedPostCard({ item, card, mounted, reactions }: { item: Extract<FeedItem, { kind: "spotted" }>; card: ListingCard; mounted: boolean; reactions?: SpottedPost["reactions"] }) {
  const { login } = usePatchedAuth();
  return (
    <article className="flex gap-3 px-4 sm:px-5 py-4 hover:bg-[var(--soft)]/40">
      <Avatar src={card.creatorAvatar} name={card.creatorLabel} wallet={card.creator} size={44} />
      <div className="flex-1 min-w-0 grid gap-2.5">
        <p className="text-[15px] leading-snug">
          <b>{item.by}</b> <span className="text-[var(--muted)]">spotted</span> <b>{card.creatorLabel}</b>
          {card.eventName && <span className="text-[var(--muted)]"> at {card.eventName}</span>}
          <span className="text-[var(--muted)]"> · {mounted ? formatTimeAgo(item.time) : ""}</span>
        </p>
        {item.caption && <p className="text-[15px]">{item.caption}</p>}
        <Link href={card.href} className="block rounded-2xl overflow-hidden border-2 border-[var(--line)] bg-[var(--soft)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.photo} alt={item.caption ?? `${card.creatorLabel}, spotted`} loading="lazy" className="w-full max-h-[420px] object-cover" />
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <ReactionBar postId={item.postId} initial={reactions} onSignIn={login} />
          <Link href={card.href} className="btn-base btn-small ml-auto">See their spots</Link>
        </div>
      </div>
    </article>
  );
}

/** Proof posted: the photos, and a link to the deal. */
function ProofPost({ item, card, mounted }: { item: Extract<FeedItem, { kind: "proof" }>; card: ListingCard; mounted: boolean }) {
  return (
    <article className="flex gap-3 px-4 sm:px-5 py-4 hover:bg-[var(--soft)]/40">
      <Avatar src={card.creatorAvatar} name={card.creatorLabel} wallet={card.creator} size={44} />
      <div className="flex-1 min-w-0 grid gap-2.5">
        <div className="grid gap-0.5">
          <PostHead card={card} time={item.time} mounted={mounted} verb="posted proof" />
          <p className="text-[15px]"><b>{item.milestoneName}</b> for <Link href={card.href} className="font-semibold no-underline text-[var(--ink)] hover:underline">{card.title}</Link></p>
          {item.note && <p className="text-[15px] text-[var(--muted)]">&ldquo;{item.note}&rdquo;</p>}
        </div>
        {item.files.length > 0 && (
          <div className={cn("grid gap-1.5 rounded-2xl overflow-hidden border-2 border-[var(--line)]", item.files.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {item.files.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} src={f} alt={`Proof for ${card.title}`} loading="lazy" className="w-full h-[200px] object-cover bg-[var(--soft)]" />
            ))}
          </div>
        )}
        <Link href={card.href} className="btn-base btn-small justify-self-start">See the deal</Link>
      </div>
    </article>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : "/explore"); }}
      className="sticky top-0 pt-1 pb-1 bg-[var(--paper)] z-10">
      <label className="flex items-center gap-2.5 h-11 px-4 rounded-full bg-[var(--soft)] border-[1.5px] border-transparent focus-within:border-[var(--accent)] focus-within:bg-[var(--card)]">
        <Search size={17} className="text-[var(--muted)]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators, events, spots" aria-label="Search"
          className="flex-1 bg-transparent outline-none text-[15px]" />
      </label>
    </form>
  );
}

function RailCard({ title, more, children }: { title: string; more?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] overflow-hidden">
      <h2 className="text-lg font-extrabold px-4 pt-3 pb-1">{title}</h2>
      <div className="grid">{children}</div>
      {more && <Link href={more.href} className="block px-4 py-3 text-sm font-semibold text-[var(--accent-text)] no-underline hover:bg-[var(--soft)]">{more.label}</Link>}
    </section>
  );
}
