"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { encodeFunctionData, erc20Abi } from "viem";
import { Activity, CalendarClock, CircleDollarSign, ExternalLink, Gavel, Loader2, Pause, Play, ShieldCheck, Square, Wallet } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ExplorerLink } from "@/components/ui/ExplorerLink";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { campaignRulesInWords } from "@/lib/market/campaignPolicy";
import { EXPLORER, USDC, publicClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress, formatTimeAgo, formatUsdc } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CampaignInfo {
  id: string;
  brand: string;
  brandName: string | null;
  brandLogo: string | null;
  eventId: number;
  eventName: string;
  eventHref: string;
  budget: number;
  maxPerSpot: number;
  goal: "most" | "prime";
  endsAt: number;
  walletAddress: string;
  policyId: string;
  /** The Privy aggregation that caps the total; null for campaigns from before it existed. */
  aggregationId: string | null;
  /** Unix seconds the campaign was created. */
  startsAt: number;
  status: "funding" | "active" | "paused" | "ending" | "ended";
}

export interface HeldSpot {
  key: string;
  label: string;
  title: string;
  who: string;
  href: string;
  amount: number;
}

interface ActionRow {
  id: number;
  kind: string;
  text: string;
  amount: number | null;
  tx_hash: string | null;
  created_at: string;
}

const STATUS = {
  funding: { label: "Waiting for funds", bg: "bg-[var(--p3)]" },
  active: { label: "Live", bg: "bg-[var(--green-soft)]" },
  paused: { label: "Paused", bg: "bg-[var(--soft)]" },
  ending: { label: "Ending", bg: "bg-[var(--soft)]" },
  ended: { label: "Ended", bg: "bg-[var(--soft)]" },
} as const;
const RULE_ICONS = [Gavel, CircleDollarSign, Activity, CalendarClock];

/** A campaign as its brand sees it: money spent, spots held, the Privy rules, and a live log of what it did. */
export function CampaignView({ campaign: c, held }: { campaign: CampaignInfo; held: HeldSpot[] }) {
  const router = useRouter();
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const isOwner = walletAddress?.toLowerCase() === c.brand;
  const [balance, setBalance] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [topUp, setTopUp] = useState(100);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const loadBalance = useCallback(() => {
    publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [c.walletAddress as `0x${string}`] })
      .then((b) => setBalance(Number(b) / 1e6)).catch(() => {});
  }, [c.walletAddress]);

  // The log, live: new actions arrive over Realtime and the balance follows them. Every action can also change the
  // status (funded, ended) and the spots held, which the server reads, so those are fetched again too.
  useEffect(() => {
    const db = supabase();
    const load = () => db.from("brand_campaign_actions").select("id, kind, text, amount, tx_hash, created_at").eq("campaign_id", c.id)
      .order("created_at", { ascending: false }).limit(40).then(({ data }) => setActions((data ?? []) as ActionRow[]));
    void load();
    loadBalance();
    const channel = db.channel(`campaign:${c.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "brand_campaign_actions", filter: `campaign_id=eq.${c.id}` }, () => { void load(); loadBalance(); router.refresh(); })
      .subscribe();
    const t = setInterval(loadBalance, 15_000);
    return () => {
      void db.removeChannel(channel);
      clearInterval(t);
    };
  }, [c.id, loadBalance, router]);

  async function control(body: Record<string, unknown>, done: string) {
    setBusy(JSON.stringify(body));
    try {
      const res = await authedFetch(`/api/campaigns/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That didn't work.");
      toast(done);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  async function fund(amount: number) {
    setBusy("fund");
    try {
      await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [c.walletAddress as `0x${string}`, BigInt(amount) * 1_000_000n] }));
      await control({ run: true }, `Added $${amount}. The campaign picks it up now.`);
      loadBalance();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "The transfer didn't"));
    } finally {
      setBusy(null);
    }
  }

  // Spent = what went into bids (each is in escrow now, or refunded to your own wallet if outbid).
  const spent = actions.filter((a) => a.kind === "bid").reduce((sum, a) => sum + Number(a.amount ?? 0) / 1e6, 0);
  const total = spent + (balance ?? 0);
  const bids = actions.filter((a) => a.kind === "bid").length;
  const blocked = actions.filter((a) => a.kind === "blocked").length;
  const words = campaignRulesInWords({ maxPerSpot: c.maxPerSpot, budget: c.budget, endsAt: c.endsAt, eventName: c.eventName, privyTotal: !!c.aggregationId, startsAt: c.startsAt });
  const s = STATUS[c.status];
  const name = c.brandName ?? formatShortAddress(c.brand);

  return (
    <div className="px-4 sm:px-6 py-7 grid gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={c.brandLogo} name={name} wallet={c.brand} size={52} className="!rounded-2xl" />
          <div className="grid min-w-0">
            <span className="eyebrow">Campaign</span>
            <h1 className="text-3xl font-extrabold tracking-tight truncate">{name} at <Link href={c.eventHref} className="hover:underline">{c.eventName}</Link></h1>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-2 h-8 px-3 rounded-full text-sm font-bold", s.bg)}>
          {c.status === "active" && <span className="dot live" />}{s.label}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="grid gap-5 min-w-0">
          <section className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-5 grid gap-4">
            <div className="flex items-end justify-between gap-3">
              <span className="grid">
                <b className="font-mono text-4xl tabular-nums">{formatUsdc(spent)}</b>
                <span className="text-sm text-[var(--muted)]">bid so far · budget {formatUsdc(c.budget)}</span>
              </span>
              <span className="text-right text-sm text-[var(--muted)]">
                <b className="font-mono text-[var(--ink)]">{balance === null ? "…" : formatUsdc(balance)}</b> left in the campaign wallet
              </span>
            </div>
            <span className="h-2.5 rounded-full bg-[var(--soft)] overflow-hidden">
              <span className="block h-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${total > 0 ? Math.min(100, (spent / total) * 100) : 0}%` }} />
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={held.length} label="spots held" tone="bg-[var(--green-soft)]" />
              <Stat n={bids} label="bids placed" tone="bg-[var(--p3)]/60" />
              <Stat n={blocked} label="Privy blocked" tone="bg-[var(--accent-soft)]" />
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-extrabold">Spots it holds</h2>
            {held.length === 0 ? (
              <p className="text-[var(--muted)] rounded-2xl border-[1.5px] border-dashed border-[var(--soft)] p-5">
                {c.status === "funding" ? "It starts bidding once the wallet is funded." : "None yet. It bids on the next keeper pass, about once a minute."}
              </p>
            ) : (
              <ul className="grid gap-2 list-none m-0 p-0">
                {held.map((h) => (
                  <li key={h.key}>
                    <Link href={h.href} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] px-4 py-3 no-underline text-[var(--ink)] hover:border-[var(--line)]">
                      <span className="grid flex-1 min-w-0"><b className="truncate">{h.label} on {h.title}</b><span className="text-sm text-[var(--muted)] truncate">{h.who}</span></span>
                      <b className="font-mono">{formatUsdc(h.amount)}</b>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-extrabold">What it did</h2>
            {actions.length === 0 ? (
              <p className="text-[var(--muted)]">Nothing yet.</p>
            ) : (
              <ol className="grid gap-1 list-none m-0 p-0">
                {actions.map((a) => (
                  <li key={a.id} className={cn("flex gap-3 px-3 py-2.5 rounded-xl text-[15px]", a.kind === "blocked" && "bg-[var(--accent-soft)]")}>
                    <span className="font-mono text-xs text-[var(--muted)] w-16 flex-none pt-0.5">{mounted ? formatTimeAgo(a.created_at) : ""}</span>
                    <span className="flex-1">{a.kind === "blocked" && <b>Privy blocked · </b>}{a.text}</span>
                    <ExplorerLink tx={a.tx_hash} />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-4">
          {isOwner && c.status !== "ended" && (
            <section className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-5 grid gap-3">
              {c.status === "funding" && (
                <button className="btn-base btn-primary justify-center" disabled={!!busy} onClick={() => fund(c.budget)}>
                  {busy === "fund" ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />} Fund ${c.budget} to start
                </button>
              )}
              {c.status === "active" && (
                <button className="btn-base justify-center" disabled={!!busy} onClick={() => control({ status: "paused" }, "Paused. No new bids until you resume.")}><Pause size={15} /> Pause</button>
              )}
              {c.status === "paused" && (
                <button className="btn-base btn-primary justify-center" disabled={!!busy} onClick={() => control({ status: "active", run: true }, "Resumed.")}><Play size={15} /> Resume</button>
              )}
              {(c.status === "active" || c.status === "paused") && (
                <div className="flex gap-2 items-center">
                  <span className="flex items-center h-10 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] px-3 flex-1">
                    $<input inputMode="numeric" value={topUp} onChange={(e) => setTopUp(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Top up amount" className="w-full bg-transparent outline-none font-mono ml-1" />
                  </span>
                  <button className="btn-base btn-small" disabled={!!busy || topUp < 1} onClick={() => fund(topUp)}>Top up</button>
                </div>
              )}
              <button className="btn-base btn-ghost btn-small justify-center" disabled={!!busy} onClick={() => control({ status: "ending" }, "Ending. What's left comes back to your wallet.")}>
                <Square size={13} /> End now and return the rest
              </button>
            </section>
          )}

          <section className="rounded-3xl bg-[#0B0B0C] text-[#FAFAF7] p-5 grid gap-3">
            <span className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-[var(--accent)] grid place-items-center"><ShieldCheck size={17} className="text-[#0B0B0C]" /></span>
              <b>Privy guards this wallet</b>
            </span>
            {words.map((r, i) => {
              const Icon = RULE_ICONS[i];
              return (
                <div key={r.title} className="flex gap-2.5 text-sm leading-snug">
                  <Icon size={16} className="text-[var(--accent)] flex-none mt-0.5" />
                  <span><b>{r.title}</b><br /><span className="text-[#C9C7BF]">{r.body}</span></span>
                </div>
              );
            })}
            <a href={`${EXPLORER}/address/${c.walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#A8A69E] hover:text-white inline-flex items-center gap-1 mt-1">
              Campaign wallet {formatShortAddress(c.walletAddress)} <ExternalLink size={11} />
            </a>
            <span className="text-[11px] text-[#76746C] font-mono break-all">Policy {c.policyId}</span>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <span className={cn("rounded-xl py-2.5", tone)}>
      <b className="block font-mono text-xl">{n}</b>
      <span className="text-xs">{label}</span>
    </span>
  );
}
