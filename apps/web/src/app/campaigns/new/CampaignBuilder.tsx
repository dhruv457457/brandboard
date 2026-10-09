"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { encodeFunctionData, erc20Abi } from "viem";
import Link from "next/link";
import { Activity, AtSign, CalendarClock, CircleDollarSign, Gavel, Loader2, Minus, Plus, ShieldCheck } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { requireFunds } from "@/lib/market/funds";
import { useStepUp } from "@/lib/market/stepUp";
import { campaignAggregation, campaignRules, campaignRulesInWords } from "@/lib/market/campaignPolicy";
import { CHAIN_ID, MARKET, USDC } from "@/lib/config";
import { cn } from "@/lib/utils";

export interface BuilderEvent {
  id: number;
  name: string;
  startsAt: number;
  endsAt: number;
  /** Rough price of the next bid on every open spot at the event, in dollars. */
  prices: number[];
}

type Token = "budget" | "event" | "cap" | "goal" | "until";
type Goal = "most" | "prime";
type Until = "end" | "day1" | "24h";
const RULE_ICONS = [Gavel, CircleDollarSign, Activity, CalendarClock];

/**
 * "I have $300 and want my logo everywhere at Token2049": one sentence with tappable words, the Privy rules that
 * guard the campaign wallet (in plain words and as the real policy), and one button to fund and start.
 */
export function CampaignBuilder({ events }: { events: BuilderEvent[] }) {
  const router = useRouter();
  const { authenticated, login, walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const stepUp = useStepUp();

  const [eventId, setEventId] = useState(events[0]?.id ?? 0);
  const [budget, setBudget] = useState(300);
  const [cap, setCap] = useState(40);
  const [goal, setGoal] = useState<Goal>("most");
  const [until, setUntil] = useState<Until>("end");
  const [editing, setEditing] = useState<Token>("budget");
  const [showPolicy, setShowPolicy] = useState(false);
  const [busy, setBusy] = useState<null | string>(null);

  useEffect(() => {
    const e = Number(new URLSearchParams(window.location.search).get("event"));
    if (e && events.some((x) => x.id === e)) setEventId(e);
  }, [events]);

  const event = events.find((e) => e.id === eventId);
  const endsAt = useMemo(() => {
    if (!event) return 0;
    const now = Date.now();
    const t = until === "24h" ? now + 86_400_000 : until === "day1" ? Math.min(event.startsAt + 86_400_000, event.endsAt) : event.endsAt;
    return Math.floor(Math.max(t, now + 3_600_000) / 1000);
  }, [event, until]);
  const untilLabel = (u: Until) => {
    if (!event) return "";
    if (u === "24h") return "24 hours from now";
    const t = u === "day1" ? Math.min(event.startsAt + 86_400_000, event.endsAt) : event.endsAt;
    return new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
  };

  // How many open spots the budget reaches, cheapest first, never above the per-spot maximum.
  const estimate = useMemo(() => {
    let left = budget;
    let n = 0;
    for (const p of [...(event?.prices ?? [])].sort((a, b) => a - b)) {
      if (p > cap || p > left) continue;
      left -= p;
      n++;
    }
    return { n, open: event?.prices.length ?? 0 };
  }, [budget, cap, event]);

  const words = campaignRulesInWords({ maxPerSpot: cap, budget, endsAt, eventName: event?.name ?? "", privyTotal: true, startsAt: Math.floor(Date.now() / 1000) });
  const policyJson = useMemo(() => {
    const rules = campaignRules({
      chainId: CHAIN_ID, market: MARKET, usdc: USDC, brand: walletAddress ?? "0xYourWallet",
      maxPerSpot: BigInt(cap) * 1_000_000n, endsAt,
      aggregationId: "<created with the campaign>", budget: BigInt(budget) * 1_000_000n,
    });
    const aggregation = campaignAggregation({ chainId: CHAIN_ID, market: MARKET, name: "Campaign spend", windowSeconds: endsAt - Date.now() / 1000 + 3600 });
    // The ABIs are long; show where they go, not what they are.
    return JSON.stringify({ aggregation, policy: { version: "1.0", chain_type: "ethereum", rules } }, (k, v) => (k === "abi" ? "[contract ABI]" : typeof v === "bigint" ? v.toString() : v), 2);
  }, [walletAddress, cap, endsAt, budget]);

  async function start() {
    if (!authenticated || !walletAddress) return login();
    if (!event) return toast("Pick an event first.");
    const amount = BigInt(budget) * 1_000_000n;
    try {
      setBusy("Checking your balance…");
      await requireFunds(walletAddress, amount, "campaign budget");
      await stepUp.ensure(amount);
      setBusy("Privy is setting up the campaign wallet…");
      const res = await authedFetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, budget, maxPerSpot: cap, goal, endsAt }),
      });
      const json = (await res.json()) as { id?: string; walletAddress?: `0x${string}`; error?: string };
      if (!res.ok || !json.id || !json.walletAddress) throw new Error(json.error ?? "Couldn't start the campaign.");
      setBusy(`Funding it with $${budget}…`);
      await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [json.walletAddress, amount] }));
      authedFetch(`/api/campaigns/${json.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ run: true }) }).catch(() => {});
      toast(`Campaign started at ${event.name}. It bids for you from now on.`);
      router.push(`/campaigns/${json.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast(/campaign|privy|event|budget|spot|end/i.test(msg) && !/insufficient/i.test(msg) ? msg : friendlyError(err).replace("The bid didn't", "The campaign didn't"));
    } finally {
      setBusy(null);
    }
  }

  if (!events.length) {
    return (
      <div className="px-4 sm:px-6 py-16 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">No events to run a campaign at</h1>
        <p className="text-[var(--muted)]">Campaigns bid across an event. Check back when the next one is listed.</p>
      </div>
    );
  }

  const tok = (t: Token, label: string) => (
    <button type="button" onClick={() => setEditing(t)} aria-pressed={editing === t}
      className={cn("font-extrabold px-2 rounded-xl border-b-[3px] border-[var(--accent)] transition-colors", editing === t ? "bg-[var(--accent-soft)]" : "bg-[var(--accent-soft)]/50 hover:bg-[var(--accent-soft)]")}>
      {label}
    </button>
  );
  const choice = (on: boolean) => cn("h-10 px-4 rounded-full border-[1.5px] text-sm font-bold", on ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "bg-[var(--card)] border-[var(--soft)] hover:border-[var(--muted)]");

  return (
    <div className="px-4 sm:px-6 py-7 grid gap-6 max-w-[860px]">
      <div>
        <span className="eyebrow">New campaign</span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-1">Put your logo everywhere</h1>
        <p className="text-[var(--muted)] mt-1.5 text-[15px]">Say what you want once. A campaign wallet bids for you across the event, and Privy refuses anything outside your rules.</p>
        <Link href="/offers/new" className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold underline decoration-[var(--accent)] decoration-2 underline-offset-4">
          <AtSign size={14} /> Or offer a spot to one person on X, even if they&apos;re not on Patched
        </Link>
      </div>

      <div className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-6 sm:p-7 grid gap-5 shadow-[0_10px_30px_rgba(11,11,12,0.05)]">
        <p className="font-display font-semibold text-[clamp(22px,3vw,29px)] leading-[1.6] tracking-[-0.02em]">
          Spend up to {tok("budget", `$${budget}`)} at {tok("event", event?.name ?? "an event")}, never more than {tok("cap", `$${cap}`)} a spot, on{" "}
          {tok("goal", goal === "most" ? "most spots" : "prime spots")}, until {tok("until", untilLabel(until))}.
        </p>

        <AnimatePresence mode="wait">
          <motion.div key={editing} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            className="rounded-2xl bg-[var(--soft)] p-4 grid gap-3">
            {editing === "budget" && (
              <>
                <span className="text-sm font-semibold text-[var(--muted)]">Total budget</span>
                <div className="flex gap-2 flex-wrap">
                  {[100, 300, 500, 1000].map((v) => <button key={v} type="button" className={choice(budget === v)} onClick={() => { setBudget(v); setCap((c) => Math.min(c, v)); }}>${v}</button>)}
                </div>
                <input type="range" min={10} max={1000} step={10} value={budget} aria-label="Budget in dollars"
                  onChange={(e) => { const v = Number(e.target.value); setBudget(v); setCap((c) => Math.min(c, v)); }} className="accent-[var(--accent)]" />
              </>
            )}
            {editing === "event" && (
              <>
                <span className="text-sm font-semibold text-[var(--muted)]">Where it bids</span>
                <div className="grid sm:grid-cols-2 gap-2">
                  {events.map((e) => (
                    <button key={e.id} type="button" onClick={() => setEventId(e.id)}
                      className={cn("text-left rounded-xl border-[1.5px] p-3", eventId === e.id ? "border-[var(--accent)] bg-[var(--card)]" : "border-transparent bg-[var(--card)]/60 hover:border-[var(--muted)]")}>
                      <b className="block">{e.name}</b>
                      <span className="text-xs text-[var(--muted)]">{e.prices.length} open spots</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {editing === "cap" && (
              <>
                <span className="text-sm font-semibold text-[var(--muted)]">Most it pays for one spot</span>
                <div className="flex items-center gap-3">
                  <button type="button" aria-label="Lower" onClick={() => setCap((c) => Math.max(1, c - 5))} className="w-11 h-11 rounded-full border-[1.5px] border-[var(--line)] bg-[var(--card)] grid place-items-center"><Minus size={16} /></button>
                  <b className="font-mono text-2xl w-20 text-center">${cap}</b>
                  <button type="button" aria-label="Raise" onClick={() => setCap((c) => Math.min(budget, c + 5))} className="w-11 h-11 rounded-full border-[1.5px] border-[var(--line)] bg-[var(--card)] grid place-items-center"><Plus size={16} /></button>
                </div>
              </>
            )}
            {editing === "goal" && (
              <div className="grid sm:grid-cols-2 gap-2">
                {([["most", "Most spots", "As many creators as the budget reaches, cheapest first."], ["prime", "Prime spots", "Only the big, most-photographed spots."]] as const).map(([g, t, b]) => (
                  <button key={g} type="button" onClick={() => setGoal(g)}
                    className={cn("text-left rounded-xl border-[1.5px] p-3", goal === g ? "border-[var(--accent)] bg-[var(--card)]" : "border-transparent bg-[var(--card)]/60 hover:border-[var(--muted)]")}>
                    <b className="block">{t}</b><span className="text-xs text-[var(--muted)]">{b}</span>
                  </button>
                ))}
              </div>
            )}
            {editing === "until" && (
              <div className="flex gap-2 flex-wrap">
                {(["end", "day1", "24h"] as const).map((u) => (
                  <button key={u} type="button" className={choice(until === u)} onClick={() => setUntil(u)}>
                    {u === "end" ? "When the event ends" : u === "day1" ? "After day one" : "24 hours"}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <p className="text-[15px] flex items-center gap-2">
          <Activity size={17} />
          {estimate.open === 0 ? "No open spots at this event right now. The campaign waits and bids when they appear." : <>At today&apos;s prices that&apos;s about <b>{estimate.n} of {estimate.open}</b> open spots.</>}
        </p>
      </div>

      <div className="rounded-3xl bg-[#0B0B0C] text-[#FAFAF7] p-5 sm:p-6 grid gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="w-9 h-9 rounded-xl bg-[var(--accent)] grid place-items-center flex-none"><ShieldCheck size={19} className="text-[#0B0B0C]" /></span>
          <span className="grid flex-1 min-w-[200px]">
            <b className="text-[17px]">Privy guards this wallet</b>
            <span className="text-[13px] text-[#A8A69E]">A Privy server wallet with its own policy. Patched can&apos;t break these rules either.</span>
          </span>
          <button type="button" onClick={() => setShowPolicy((s) => !s)} aria-expanded={showPolicy}
            className="h-9 px-4 rounded-full border-[1.5px] border-[#3A3A35] text-sm font-semibold hover:bg-white/5">
            {showPolicy ? "Plain words" : "See the policy"}
          </button>
        </div>
        {showPolicy ? (
          <pre className="m-0 p-4 rounded-2xl bg-[#1A1A1C] font-mono text-[12px] leading-relaxed text-[#E9E7E0] overflow-x-auto max-h-[360px]">{policyJson}</pre>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {words.map((r, i) => {
              const Icon = RULE_ICONS[i];
              return (
                <div key={r.title} className="flex gap-3 p-3.5 rounded-2xl bg-[#1A1A1C] text-sm leading-snug">
                  <Icon size={18} className="text-[var(--accent)] flex-none mt-0.5" />
                  <span><b>{r.title}</b><br /><span className="text-[#C9C7BF]">{r.body}</span></span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button type="button" onClick={start} disabled={!!busy} className="btn-base btn-primary h-13 px-7 text-[17px] justify-center">
          {busy ? <><Loader2 size={17} className="animate-spin" /> {busy}</> : authenticated ? `Fund $${budget} and start` : "Sign in to start"}
        </button>
        <span className="text-[13px] text-[var(--muted)] leading-snug">One transfer from your wallet. Money it doesn&apos;t spend<br className="hidden sm:inline" /> comes back when the campaign ends.</span>
      </div>
    </div>
  );
}
