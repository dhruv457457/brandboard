"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { publicUrl } from "@/lib/handles";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AtSign, BadgeCheck, Check, Gavel, Link2, Pencil, Plus, Settings2, Share2, Trophy } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/ui/Toast";
import { ListingCardView } from "@/components/market/ListingCardView";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { DashboardView } from "@/app/dashboard/DashboardView";
import { BidsView } from "@/app/bids/BidsView";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { SHAREABLE } from "@/lib/market/listingStatus";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";
import { cn } from "@/lib/utils";
import { CHAIN_ID } from "@/lib/config";
import { FollowButton } from "@/components/ui/FollowButton";
import { SpottedWall } from "@/components/social/SpottedWall";
import { supabase } from "@/lib/supabase";

export interface PublicProfile {
  wallet: string;
  handle: string | null;
  displayName: string | null;
  xHandle: string | null;
  xVerified: boolean;
  /** From the linked X account, refreshed daily. */
  xFollowers: number | null;
  avatarUrl: string | null;
  bio: string | null;
  bannerColor: string;
  completed: number;
  failed: number;
  earned: string;
  brandName: string | null;
  brandLogo: string | null;
  brandVerified: string | null;
}

/** A spot this wallet holds as a brand: won (receipt in the wallet) or leading a live auction. */
export interface SponsoredSpot {
  listingId: number;
  patchId: number;
  label: string;
  title: string;
  creator: string;
  event: string | null;
  href: string;
  amount: number;
  /** won: receipt in the wallet · winning: bidding ended, waiting to close · leading: live auction. */
  state: "won" | "winning" | "leading";
}

type Tab = "listings" | "sponsoring" | "campaigns" | "earnings" | "bids";

/**
 * One page per person: what they sell (Listings), what they sponsor (Sponsoring), and, for the owner only, their
 * private Earnings and Bids. There is no separate dashboard to find.
 */
export function ProfileView({ profile: p, cards: wire, sponsoring }: { profile: PublicProfile; cards: Wire<ListingCard[]>; sponsoring: SponsoredSpot[] }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const { walletAddress } = usePatchedAuth();
  const isOwner = walletAddress?.toLowerCase() === p.wallet;
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("listings");

  useEffect(() => setMounted(true), []);
  function pick(t: Tab) {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "listings") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    window.history.replaceState(null, "", url);
  }

  const named = p.displayName || (p.handle ? `@${p.handle}` : p.xHandle ? `@${p.xHandle}` : null);
  const name = named ?? formatShortAddress(p.wallet);
  const pageHref = `/${p.handle ?? p.wallet}`;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "listings", label: "Listings", count: cards.length },
    { id: "sponsoring", label: "Sponsoring", count: sponsoring.length },
    ...(isOwner ? [{ id: "campaigns" as const, label: "Campaigns" }, { id: "earnings" as const, label: "Earnings" }, { id: "bids" as const, label: "Bids" }] : []),
  ];
  const current = !isOwner && (tab === "earnings" || tab === "bids" || tab === "campaigns") ? "listings" : tab;

  return (
    <div className="pb-24">
      {/* ?tab= picks the tab: the wallet panel links straight to Earnings and Bids. */}
      <Suspense fallback={null}><TabFromUrl onTab={setTab} /></Suspense>
      {/* Banner and avatar, like a social profile */}
      <div className="h-[150px] sm:h-[190px] relative overflow-hidden border-b-[1.5px] border-[var(--soft)]" style={{ background: p.bannerColor }}>
        <div className="absolute inset-3 border-2 border-dashed border-black/25 rounded-[14px]" />
        <span className="absolute right-5 -bottom-5 font-extrabold text-[110px] leading-none tracking-[-.06em] text-black/10 select-none" aria-hidden="true">patched</span>
      </div>
      <div className="px-4 sm:px-6">
        <div className="flex items-end justify-between gap-3 -mt-12 sm:-mt-14">
          <Avatar src={p.avatarUrl} name={named} wallet={p.wallet} size={112} className="relative z-10 !border-[3px] shadow-[3px_3px_0_var(--shadow)] ring-4 ring-[var(--paper)]" />
          <div className="flex gap-2 pb-1 flex-wrap justify-end">
            {isOwner ? <Link href="/settings" className="btn-base btn-small"><Pencil size={13} /> Edit profile</Link> : <FollowButton kind="profile" id={p.wallet} />}
            <button className="btn-base btn-small" onClick={() => navigator.clipboard.writeText(publicUrl(pageHref)).then(() => toast("Profile link copied.")).catch(() => {})}>
              <Link2 size={13} /> Share
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-1">
          <h1 className="font-extrabold text-3xl tracking-tight flex items-center gap-2">
            {name}
            {p.xVerified && <BadgeCheck size={22} className="text-[var(--accent-text)]" aria-label="X verified" />}
          </h1>
          <p className="text-[var(--muted)] text-[15px]">
            {p.handle ? `@${p.handle}` : named ? formatShortAddress(p.wallet) : "On Patched"}
            {p.xHandle && <> · <a className="hover:underline" href={`https://x.com/${p.xHandle}`} target="_blank" rel="noopener noreferrer">x.com/{p.xHandle}</a></>}
            {p.xHandle && p.xFollowers !== null && <> · <b className="text-[var(--ink)]">{new Intl.NumberFormat("en-US", { notation: "compact" }).format(p.xFollowers)}</b> followers on X</>}
          </p>
        </div>
        {p.bio && <p className="mt-3 max-w-[60ch] text-[15px]">{p.bio}</p>}
        {p.brandName && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm">
            <Avatar src={p.brandLogo} name={p.brandName} wallet={p.wallet} size={22} className="!rounded-md" />
            Sponsors as <b>{p.brandName}</b>
            {p.brandVerified && <Chip variant="green"><Check size={11} /> {p.brandVerified}</Chip>}
          </p>
        )}
        <div className="flex gap-x-5 gap-y-1 flex-wrap mt-3 text-[15px]">
          <span><b>{p.completed}</b> <span className="text-[var(--muted)]">{p.completed === 1 ? "delivery" : "deliveries"}</span></span>
          {p.failed > 0 && <span><b>{p.failed}</b> <span className="text-[var(--muted)]">missed</span></span>}
          <span><b className="font-mono">{formatUsdc(Number(p.earned) / 1e6)}</b> <span className="text-[var(--muted)]">earned</span></span>
          <span><b>{sponsoring.length}</b> <span className="text-[var(--muted)]">spots sponsored</span></span>
        </div>
      </div>

      <nav className="mt-5 flex border-b-[1.5px] border-[var(--soft)] overflow-x-auto sticky top-[54px] md:top-0 z-20 bg-[var(--paper)]/92 backdrop-blur-md" role="tablist" aria-label="Profile">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={current === t.id} onClick={() => pick(t.id)}
            className={cn("relative flex-1 min-w-[96px] h-[52px] px-4 text-[15px] hover:bg-[var(--soft)]", current === t.id ? "font-extrabold" : "font-medium text-[var(--muted)]")}>
            {t.label}{t.count !== undefined && t.count > 0 && <span className="ml-1.5 text-[var(--muted)] font-medium">{t.count}</span>}
            {current === t.id && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1 w-12 rounded-full bg-[var(--accent)]" />}
          </button>
        ))}
      </nav>

      <div className="px-4 sm:px-6 pt-6">
        {current === "listings" && (<div className="grid gap-8">
          {cards.length === 0 ? (
            <Empty text="No listings yet." action={isOwner ? { href: "/studio", label: "Create your first listing" } : undefined} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cards.map((c) => (
                <div key={c.id} className="grid gap-2">
                  <ListingCardView card={c} mounted={mounted} />
                  {isOwner && (
                    <div className="flex gap-2">
                      <Link href={`/studio/${c.id}`} className="btn-base btn-small"><Settings2 size={13} /> Manage</Link>
                      {SHAREABLE.has(c.status) && <Link href={`/share/${c.id}`} className="btn-base btn-small"><Share2 size={13} /> Share kit</Link>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <SpottedWall wallet={p.wallet.toLowerCase()} title={`Spotted wearing ${named ?? "Patched"}`} />
        </div>)}

        {current === "sponsoring" && (
          sponsoring.length === 0 ? (
            <Empty text={isOwner ? "You haven't sponsored anything yet. Bid on a spot and it shows up here." : "No sponsored spots yet."}
              action={isOwner ? { href: "/explore", label: "Find spots" } : undefined} />
          ) : (
            <ul className="grid gap-2 list-none m-0 p-0">
              {sponsoring.map((s) => (
                <li key={`${s.listingId}:${s.patchId}`}>
                  <Link href={s.href} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] px-4 py-3 no-underline text-[var(--ink)] hover:border-[var(--line)]">
                    <span className={cn("w-10 h-10 rounded-xl grid place-items-center flex-none border-[1.5px] border-[var(--line)]", s.state === "won" ? "bg-[var(--p1)]" : "bg-[var(--p3)]")}>
                      {s.state === "won" ? <Trophy size={18} className="text-[#0B0B0C]" /> : <Gavel size={18} className="text-[#0B0B0C]" />}
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <b className="truncate">{s.label} on {s.title}</b>
                      <span className="text-sm text-[var(--muted)] truncate">{s.creator}{s.event ? ` · ${s.event}` : ""}</span>
                    </span>
                    <span className="grid text-right flex-none">
                      <b className="font-mono">{formatUsdc(s.amount)}</b>
                      <span className={cn("text-xs font-semibold", s.state === "leading" ? "text-[var(--accent-text)]" : "text-[var(--green)]")}>{s.state === "won" ? "Won" : s.state === "winning" ? "Winning" : "Leading"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        )}

        {isOwner && current === "campaigns" && <CampaignsTab wallet={p.wallet} />}
        {isOwner && current === "earnings" && <DashboardView embedded />}
        {isOwner && current === "bids" && <BidsView embedded />}
      </div>
    </div>
  );
}

const TABS: Tab[] = ["listings", "sponsoring", "campaigns", "earnings", "bids"];
const CAMPAIGN_STATUS: Record<string, string> = { funding: "Waiting for funds", active: "Live", paused: "Paused", ending: "Ending", ended: "Ended" };

interface CampaignRowLite { id: string; event_id: number; budget: number; max_per_spot: number; status: string; ends_at: string; kind: string; target_x_handle: string | null }

/** Your campaigns, newest first, and a way to start one. */
function CampaignsTab({ wallet }: { wallet: string }) {
  const [rows, setRows] = useState<CampaignRowLite[] | null>(null);
  const [events, setEvents] = useState<Record<number, string>>({});
  useEffect(() => {
    let alive = true;
    const db = supabase();
    db.from("brand_campaigns").select("id, event_id, budget, max_per_spot, status, ends_at, kind, target_x_handle").eq("chain_id", CHAIN_ID).eq("brand", wallet)
      .order("created_at", { ascending: false }).limit(20)
      .then(async ({ data }) => {
        if (!alive) return;
        setRows((data ?? []) as CampaignRowLite[]);
        const ids = [...new Set((data ?? []).map((r) => r.event_id))];
        if (!ids.length) return;
        const { data: ev } = await db.from("patched_events").select("event_id, name").eq("chain_id", CHAIN_ID).in("event_id", ids);
        if (alive) setEvents(Object.fromEntries((ev ?? []).map((e) => [e.event_id, e.name])));
      });
    return () => {
      alive = false;
    };
  }, [wallet]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[var(--muted)] max-w-[52ch]">A budget that spreads your logo across an event. Each campaign runs on its own Privy wallet with rules you set.</p>
        <span className="flex gap-2 flex-wrap">
          <Link href="/offers/new" className="btn-base btn-small"><AtSign size={14} /> Patch someone on X</Link>
          <Link href="/campaigns/new" className="btn-base btn-small btn-primary"><Plus size={14} /> New campaign</Link>
        </span>
      </div>
      {rows === null ? null : rows.length === 0 ? (
        <Empty text="No campaigns yet." />
      ) : (
        <ul className="grid gap-2 list-none m-0 p-0">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={r.kind === "x_offer" ? `/offers/${r.id}` : `/campaigns/${r.id}`} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] px-4 py-3 no-underline text-[var(--ink)] hover:border-[var(--line)]">
                <span className="grid flex-1 min-w-0">
                  <b className="truncate">{r.kind === "x_offer" ? `Offer to @${r.target_x_handle}` : events[r.event_id] ?? `Event ${r.event_id}`}</b>
                  <span className="text-sm text-[var(--muted)]">
                    {r.kind === "x_offer"
                      ? `${formatUsdc(Number(r.budget) / 1e6)} for a spot at ${events[r.event_id] ?? `event ${r.event_id}`}`
                      : `${formatUsdc(Number(r.budget) / 1e6)} budget · up to ${formatUsdc(Number(r.max_per_spot) / 1e6)} a spot`}
                  </span>
                </span>
                <span className={cn("text-xs font-bold rounded-full px-2.5 py-1", r.status === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--soft)]")}>
                  {CAMPAIGN_STATUS[r.status] ?? r.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TabFromUrl({ onTab }: { onTab: (t: Tab) => void }) {
  const t = useSearchParams().get("tab") as Tab | null;
  useEffect(() => {
    onTab(t && TABS.includes(t) ? t : "listings");
  }, [t, onTab]);
  return null;
}

function Empty({ text, action }: { text: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border-[1.5px] border-dashed border-[var(--soft)] p-8 text-center grid gap-3 justify-items-center">
      <p className="text-[var(--muted)]">{text}</p>
      {action && <Link href={action.href} className="btn-base btn-small btn-primary"><Plus size={14} /> {action.label}</Link>}
    </div>
  );
}
