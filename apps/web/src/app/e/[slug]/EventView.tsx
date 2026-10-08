"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Flame, Globe, Megaphone, Network, Plus, Swords, Trophy, Users, Zap } from "lucide-react";
import { EventHeader } from "@/components/events/EventHeader";
import { ListingCardView } from "@/components/market/ListingCardView";
import { Avatar } from "@/components/ui/Avatar";
import { formatTimeAgo, formatUsdc } from "@/lib/format";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";
import { cn } from "@/lib/utils";
import { FollowButton } from "@/components/ui/FollowButton";
import { SpottedWall } from "@/components/social/SpottedWall";
import { CHAIN_ID } from "@/lib/config";
import { CONTEST_EVENT_SLUG, DEADLINE } from "@/lib/contest";

export interface EventInfo {
  id: number;
  slug: string | null;
  name: string;
  startsAt: number;
  endsAt: number;
  city: string | null;
  venue: string | null;
  description: string | null;
  banner: string | null;
  website: string | null;
  x: string | null;
  active: boolean;
}

export interface Leaderboards {
  mostSponsored: { title: string; who: string; href: string; amount: number } | null;
  topBrand: { name: string; logo: string | null; spots: number } | null;
  biggestWar: { label: string; title: string; href: string; bids: number } | null;
}

export interface EventBid {
  key: string;
  who: string;
  wallet: string;
  logo: string | null;
  label: string;
  title: string;
  href: string;
  amount: number;
  buyNow: boolean;
  time: number;
}

const SURFACE_WORD = { outfit: "outfit", car: "vehicle", hoodie: "team" } as const;
const X_PATH = "M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zM16.7 19.2h1.7L7.3 4.7H5.5z";

/**
 * The event page, the centre of V2: the cover and links, who's going (creators, vehicles and teams with spots),
 * leaderboards, the open spots, and a live wall of bids.
 */
export function EventView({ event, cards: wire, leaderboards, wall }: { event: EventInfo; cards: Wire<ListingCard[]>; leaderboards: Leaderboards; wall: EventBid[] }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = cards.reduce((s, c) => s + c.topBidsTotal, 0n);
  const spots = cards.reduce((s, c) => s + c.patchCount, 0);
  const open = cards.filter((c) => c.status === 1).reduce((s, c) => s + (c.patchCount - c.patchesWithBids), 0);
  const going = [...new Map(cards.map((c) => [c.creator, c])).values()];
  const now = Date.now();
  const live = event.startsAt <= now && event.endsAt >= now;
  const past = event.endsAt < now;
  const days = Math.ceil((event.startsAt - now) / 86_400_000);
  const badge = past ? "Ended" : live ? "Happening now" : days <= 1 ? "Starts tomorrow" : `In ${days} days`;

  return (
    <div className="pb-24">
      <EventHeader
        id={event.id} name={event.name} banner={event.banner} startsAt={event.startsAt} endsAt={event.endsAt} city={event.city} venue={event.venue}
        badge={
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
            live ? "bg-[var(--accent)] text-[var(--on-accent)] border-2 border-[#0B0B0C]" : "bg-[#0B0B0C]/80 text-[#FAFAF7]")}>
            {live && <span className="dot live" />}{mounted ? badge : "Event"}
          </span>
        }
        actions={<>
          {event.website && <a href={event.website} target="_blank" rel="noopener noreferrer" className="btn-base btn-small"><Globe size={14} /> Website <ExternalLink size={12} /></a>}
          {event.x && <a href={event.x} target="_blank" rel="noopener noreferrer" className="btn-base btn-small"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={X_PATH} /></svg> On X</a>}
          {event.slug === CONTEST_EVENT_SLUG && Date.now() < DEADLINE && <Link href="/contest" className="btn-base btn-small btn-primary"><Trophy size={14} /> Contest rules and entry</Link>}
          <Link href={`/e/${event.id}/patchwork`} className="btn-base btn-small"><Network size={14} /> Patchwork</Link>
          <FollowButton kind="event" id={`${CHAIN_ID}:${event.id}`} />
          {event.active && !past && <Link href={`/campaigns/new?event=${event.id}`} className="btn-base btn-small"><Megaphone size={14} /> Sponsor everyone here</Link>}
          {event.active && !past && <Link href="/studio" className="btn-base btn-small btn-primary"><Plus size={14} /> Get patched here</Link>}
        </>}
      />

      <div className="px-4 sm:px-6 pt-5 grid gap-5">
        {event.description && <p className="max-w-[70ch] text-[15px] leading-relaxed">{event.description}</p>}
        <p className="text-xs text-[var(--muted)]">Run by its organisers. Patched lists who&apos;s going and their spots; it doesn&apos;t sell tickets.</p>

        <div className="grid grid-cols-3 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] overflow-hidden">
          <Stat value={String(going.length)} label={going.length === 1 ? "creator going" : "creators going"} />
          <Stat value={String(open)} label={`open of ${spots} spots`} />
          <Stat value={formatUsdc(Number(total) / 1e6)} label="bid so far" />
        </div>

        {/* Who's going */}
        {going.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-xl font-extrabold flex items-center gap-2"><Users size={19} /> Going</h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {going.map((c) => (
                <Link key={c.creator} href={c.href} className="flex-none w-[128px] grid justify-items-center gap-1.5 text-center rounded-2xl p-3 border-[1.5px] border-[var(--soft)] bg-[var(--card)] no-underline text-[var(--ink)] hover:border-[var(--line)]">
                  <Avatar src={c.creatorAvatar} name={c.creatorLabel} wallet={c.creator} size={52} />
                  <b className="text-sm truncate w-full">{c.creatorLabel}</b>
                  <span className="text-xs text-[var(--muted)]">{SURFACE_WORD[c.surface]} · {c.patchCount} spots</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Leaderboards */}
        {(leaderboards.mostSponsored || leaderboards.topBrand || leaderboards.biggestWar) && (
          <section className="grid gap-3 sm:grid-cols-3">
            {leaderboards.mostSponsored && (
              <Board icon={Trophy} title="Most sponsored" href={leaderboards.mostSponsored.href}>
                <b className="truncate">{leaderboards.mostSponsored.who}</b>
                <span className="text-sm text-[var(--muted)] truncate">{leaderboards.mostSponsored.title}</span>
                <b className="font-mono text-lg">{formatUsdc(leaderboards.mostSponsored.amount)}</b>
              </Board>
            )}
            {leaderboards.topBrand && (
              <Board icon={Flame} title="Brand on the most spots">
                <span className="flex items-center gap-2 min-w-0">
                  <Avatar src={leaderboards.topBrand.logo} name={leaderboards.topBrand.name} size={26} className="!rounded-lg" />
                  <b className="truncate">{leaderboards.topBrand.name}</b>
                </span>
                <b className="font-mono text-lg">{leaderboards.topBrand.spots} spot{leaderboards.topBrand.spots === 1 ? "" : "s"}</b>
              </Board>
            )}
            {leaderboards.biggestWar && (
              <Board icon={Swords} title="Biggest bidding war" href={leaderboards.biggestWar.href}>
                <b className="truncate">{leaderboards.biggestWar.label}</b>
                <span className="text-sm text-[var(--muted)] truncate">{leaderboards.biggestWar.title}</span>
                <b className="font-mono text-lg">{leaderboards.biggestWar.bids} bids</b>
              </Board>
            )}
          </section>
        )}

        <SpottedWall
          eventId={event.id}
          title={`Spotted at ${event.name}`}
          choices={cards.filter((c) => c.status === 1 || c.status === 2).map((c) => ({ listingId: c.id, label: `${c.creatorLabel}: ${c.title}` }))}
        />

        <div className={cn("grid gap-6 items-start", wall.length > 0 && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
          <section className="grid gap-4 min-w-0">
            <h2 className="text-xl font-extrabold">Spots at {event.name}</h2>
            {cards.length === 0 ? (
              <div className="rounded-2xl border-[1.5px] border-dashed border-[var(--soft)] p-8 text-center grid gap-3 justify-items-center">
                <h3 className="text-xl font-extrabold">No one is getting patched here yet</h3>
                <p className="text-[var(--muted)]">Going to {event.name}? List your outfit, vehicle or team hoodie and let brands bid.</p>
                {event.active && <Link href="/studio" className="btn-base btn-primary"><Plus size={15} /> Get patched</Link>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {cards.map((c) => <ListingCardView key={c.id} card={c} mounted={mounted} />)}
              </div>
            )}
          </section>

          {wall.length > 0 && (
            <aside className="grid grid-cols-[minmax(0,1fr)] gap-3 min-w-0 lg:sticky lg:top-4">
              <h2 className="text-xl font-extrabold flex items-center gap-2"><Zap size={18} /> Live wall</h2>
              <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 list-none m-0 p-0">
                {wall.map((b) => (
                  <li key={b.key}>
                    <Link href={b.href} className="flex gap-2.5 items-start rounded-xl p-2.5 no-underline text-[var(--ink)] hover:bg-[var(--soft)]">
                      <Avatar src={b.logo} name={b.who} wallet={b.wallet} size={32} className="!rounded-lg" />
                      <span className="text-sm leading-snug min-w-0 flex-1">
                        <b>{b.who}</b> {b.buyNow ? "bought" : "bid"} <b className="font-mono">{formatUsdc(b.amount)}</b> on {b.label}
                        <span className="block text-xs text-[var(--muted)] truncate">{b.title} · {mounted ? formatTimeAgo(b.time) : ""}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-3.5 border-r-[1.5px] border-[var(--soft)] last:border-r-0">
      <b className="block font-display text-2xl font-extrabold tabular-nums">{value}</b>
      <span className="text-xs text-[var(--muted)]">{label}</span>
    </div>
  );
}

function Board({ icon: Icon, title, href, children }: { icon: typeof Trophy; title: string; href?: string; children: React.ReactNode }) {
  const body = (
    <>
      <span className="eyebrow flex items-center gap-1.5"><Icon size={13} /> {title}</span>
      {children}
    </>
  );
  const cls = "grid gap-1 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-4 min-w-0 no-underline text-[var(--ink)]";
  return href ? <Link href={href} className={cn(cls, "hover:border-[var(--line)]")}>{body}</Link> : <div className={cls}>{body}</div>;
}
