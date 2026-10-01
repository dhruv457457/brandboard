"use client";

import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bell, Camera, CheckCircle2, CircleSlash, Gavel, Pause, Radio, RotateCcw, ShoppingBag, Timer, Trophy, Wallet, Zap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { formatTimeAgo } from "@/lib/format";
import { describe, useNotifications, type NotificationRow } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import PageLoading from "@/app/loading";

/** How each kind of event looks: an icon, a colour, and which filter it belongs to. */
const KINDS: Record<string, { icon: LucideIcon; tone: string; group: Filter }> = {
  outbid: { icon: RotateCcw, tone: "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]", group: "bids" },
  new_bid: { icon: Zap, tone: "bg-[var(--accent-soft)] text-[var(--accent-text)]", group: "bids" },
  auto_bid: { icon: Zap, tone: "bg-[var(--accent-soft)] text-[var(--accent-text)]", group: "bids" },
  auto_bid_paused: { icon: Pause, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "bids" },
  bid_forwarded: { icon: RotateCcw, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "bids" },
  won: { icon: Trophy, tone: "bg-[var(--green-soft)] text-[var(--green)]", group: "money" },
  paid: { icon: Wallet, tone: "bg-[var(--green-soft)] text-[var(--green)]", group: "money" },
  resale_sold: { icon: ShoppingBag, tone: "bg-[var(--green-soft)] text-[var(--green)]", group: "money" },
  listing_live: { icon: Radio, tone: "bg-[var(--accent-soft)] text-[var(--accent-text)]", group: "listings" },
  bidding_closed: { icon: Timer, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "listings" },
  proof_submitted: { icon: Camera, tone: "bg-[var(--accent-soft)] text-[var(--accent-text)]", group: "listings" },
  proof_approved: { icon: CheckCircle2, tone: "bg-[var(--green-soft)] text-[var(--green)]", group: "listings" },
  disputed: { icon: AlertTriangle, tone: "bg-[color-mix(in_srgb,var(--red)_14%,transparent)] text-[var(--red)]", group: "listings" },
  listing_rejected: { icon: CircleSlash, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "listings" },
  listing_failed: { icon: CircleSlash, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "listings" },
};
const DEFAULT_KIND = { icon: Gavel, tone: "bg-[var(--soft)] text-[var(--ink)]", group: "listings" as const };

type Filter = "all" | "bids" | "money" | "listings";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bids", label: "Bids" },
  { id: "money", label: "Wins and payouts" },
  { id: "listings", label: "Listings" },
];

/** Today, Yesterday, This week, Earlier: by the viewer's own calendar. */
function dayGroup(iso: string): string {
  const d = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= start.getTime()) return "Today";
  if (t >= start.getTime() - 86_400_000) return "Yesterday";
  if (t >= start.getTime() - 6 * 86_400_000) return "This week";
  return "Earlier";
}

const exactTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Every notification for the signed-in wallet, newest first, grouped by day. Opening the page marks them read. */
export default function NotificationsPage() {
  const { ready, authenticated } = usePatchedAuth();
  const { rows, labels, actors, loaded, markAllRead } = useNotifications(100);
  const [filter, setFilter] = useState<Filter>("all");
  // Re-render every 30s so "2m ago" keeps moving.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Mark read once they've been shown.
  useEffect(() => {
    if (loaded) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, bids: 0, money: 0, listings: 0 };
    for (const n of rows) c[(KINDS[n.kind] ?? DEFAULT_KIND).group]++;
    return c;
  }, [rows]);

  const groups = useMemo(() => {
    const out: { label: string; items: NotificationRow[] }[] = [];
    for (const n of rows) {
      if (filter !== "all" && (KINDS[n.kind] ?? DEFAULT_KIND).group !== filter) continue;
      const label = dayGroup(n.created_at);
      if (out.at(-1)?.label !== label) out.push({ label, items: [] });
      out.at(-1)!.items.push(n);
    }
    return out;
  }, [rows, filter]);

  if (!ready) return <PageLoading />;
  if (!authenticated) {
    return <SignInPrompt icon={Bell} title="Activity" text="Sign in to see your bids, wins and payouts as they happen." />;
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-5 max-w-3xl">
      <div>
        <h1 className="font-extrabold text-4xl tracking-tight">Activity</h1>
        <p className="text-[var(--muted)] mt-1">Bids, wins and payouts on your patches, live.</p>
      </div>

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "h-9 px-3.5 rounded-full text-sm font-semibold border-[1.5px] inline-flex items-center gap-1.5",
              filter === f.id ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "border-[var(--soft)] hover:border-[var(--line)]",
            )}
          >
            {f.label}
            {loaded && counts[f.id] > 0 && <span className={cn("text-xs tabular-nums", filter === f.id ? "opacity-70" : "text-[var(--muted)]")}>{counts[f.id]}</span>}
          </button>
        ))}
      </div>

      {!loaded ? (
        <div className="grid gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[72px]" />)}</div>
      ) : groups.length === 0 ? (
        <Card className="p-8 grid gap-3 justify-items-center text-center">
          <span className="w-12 h-12 rounded-2xl grid place-items-center bg-[var(--accent-soft)] text-[var(--accent-text)]"><Bell size={22} /></span>
          <p className="font-bold text-lg">{filter === "all" ? "Nothing here yet" : "Nothing in this filter yet"}</p>
          <p className="text-sm text-[var(--muted)] max-w-sm">Place a bid or list your outfit, car or team hoodie. Every bid, win and payout shows up here the moment it happens.</p>
          <Link href="/explore" className="btn-base btn-primary btn-small mt-1">Explore live listings</Link>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="grid gap-2">
            <h2 className="eyebrow">{g.label}</h2>
            <Card className="p-1.5">
              <ul className="grid">
                {g.items.map((n) => {
                  const { text, href, image, actor, amount } = describe(n, labels, actors);
                  const kind = KINDS[n.kind] ?? DEFAULT_KIND;
                  const Icon = kind.icon;
                  const unread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <Link
                        href={href}
                        className={cn("flex items-center gap-3 rounded-xl px-3 py-3 no-underline text-[var(--ink)] hover:bg-[var(--soft)]", unread && "bg-[var(--accent-soft)]")}
                      >
                        {/* The event's icon, with the person behind it on top when we know who. */}
                        <span className="relative flex-none">
                          <span className={cn("w-11 h-11 rounded-2xl grid place-items-center", kind.tone)}><Icon size={20} /></span>
                          {actor?.name && (
                            <Avatar src={actor.logo} name={actor.name} wallet={actor.wallet} size={22} className="!absolute -right-1.5 -bottom-1.5 ring-2 ring-[var(--card)] !rounded-md" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] leading-snug">{text}</span>
                          <span className="block text-xs text-[var(--muted)] mt-1" title={exactTime(n.created_at)}>
                            {formatTimeAgo(n.created_at)} · {exactTime(n.created_at)}
                          </span>
                        </span>
                        {amount && <span className="flex-none font-mono font-semibold text-sm tabular-nums">{amount}</span>}
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image} alt="" className="flex-none w-12 h-12 rounded-xl object-cover bg-[var(--soft)] border-[1.5px] border-[var(--soft)]" />
                        ) : null}
                        {unread && <span className="flex-none w-2 h-2 rounded-full bg-[var(--accent)]" aria-label="New" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}
    </main>
  );
}
