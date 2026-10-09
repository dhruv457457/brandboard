"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, CalendarDays, Camera, Check, MapPin, Plus, Printer, Route, Trash2, Zap } from "lucide-react";
import { DELIVERABLES, X_POST, type DealDraft, type Kind, type PayoutPreset, type PlannedMilestone } from "@/lib/market/dealPlan";
import { cn } from "@/lib/utils";

const COLORS = ["var(--p3)", "var(--p4)", "var(--p2)", "var(--p1)", "var(--p5)", "var(--p3)", "var(--p4)", "var(--p2)"];
const PRESETS: { id: PayoutPreset; label: string; note: string }[] = [
  { id: "upfront", label: "Part before, for printing", note: "Some after the print proof, the rest after the event." },
  { id: "after", label: "All after the event", note: "Safest for brands, so bids tend to be higher." },
  { id: "daily", label: "Per day", note: "An equal part after each event day." },
  { id: "custom", label: "Custom", note: "Up to 4 steps, your split." },
];

const when = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const iconFor = (name: string) => (/print/i.test(name) ? Printer : /day/i.test(name) ? CalendarDays : /x post/i.test(name) ? Zap : Camera);

/**
 * The deal, step 3 of creating a listing: how long, how the creator gets paid (a live payout bar), and what every
 * brand gets. Everything here goes into the listing metadata and the on-chain milestones.
 */
export function DealTerms({ kind, draft, onChange, plan, event, biddingEndsAt }: {
  kind: Kind;
  draft: DealDraft;
  onChange: (d: DealDraft) => void;
  plan: PlannedMilestone[];
  event: { name: string; startsAt: number; endsAt: number } | null;
  /** When bidding ends (ms), once the page knows the time; the timeline starts there. */
  biddingEndsAt: number | null;
}) {
  const reduce = useReducedMotion();
  const set = (patch: Partial<DealDraft>) => onChange({ ...draft, ...patch });
  const menu = DELIVERABLES[kind];
  const customTotal = draft.custom.reduce((a, r) => a + (Number(r.pct) || 0), 0);

  return (
    <div className="grid gap-0">
      {kind === "car" && (
        <section className="grid gap-3.5 pb-6 border-b-[1.5px] border-[var(--soft)]">
          <Head title="How long" sub="Every event day you drive is a day brands pay for." />
          <div className="flex flex-wrap gap-3">
            <Seg value={draft.days} options={[1, 2, 3].map((n) => ({ value: n, label: `${n} day${n > 1 ? "s" : ""}` }))} onPick={(days) => set({ days })} label="Event days" />
            <Seg value={draft.vehicle} options={[{ value: "car", label: "Car" }, { value: "van", label: "Van" }, { value: "bus", label: "Bus" }]} onPick={(vehicle) => set({ vehicle })} label="Vehicle" />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Where the vehicle is">
            {([
              { id: "parked", title: "Parked at the venue", body: "Right by the entrance, where the queues are.", Icon: MapPin },
              { id: "loop", title: "Loops around the venue", body: "Driving the blocks around it all day.", Icon: Route },
            ] as const).map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={draft.place === p.id}
                onClick={() => {
                  // The deliverables follow: parked hours for parked, route check-ins for looping.
                  const [, parked, route] = DELIVERABLES.car;
                  const keep = draft.deliverables.filter((d) => d !== parked && d !== route);
                  set({ place: p.id, deliverables: DELIVERABLES.car.filter((d) => keep.includes(d) || d === (p.id === "parked" ? parked : route)) });
                }}
                className={cn("flex gap-3 items-start text-left p-3.5 rounded-2xl border-2 transition-colors", draft.place === p.id ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--soft)] bg-[var(--card)] hover:border-[var(--muted)]")}>
                <span className="w-9 h-9 rounded-xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] grid place-items-center flex-none"><p.Icon size={18} /></span>
                <span className="grid gap-0.5"><b className="text-[15px]">{p.title}</b><span className="text-[13px] text-[var(--muted)] leading-snug">{p.body}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={cn("grid gap-3.5 pb-6 border-b-[1.5px] border-[var(--soft)]", kind === "car" && "pt-6")}>
        <Head title="How you get paid" sub="Money waits in escrow. Each part unlocks when its proof is approved: brands can approve it right away, or you are paid when their review window (72 hours) ends." />
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Payout plan">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={draft.payout === p.id} title={p.note} onClick={() => set({ payout: p.id })}
              className={cn("h-9 px-3.5 rounded-full border-[1.5px] text-sm font-semibold transition-colors", draft.payout === p.id ? "bg-[var(--ink)] text-[var(--paper)] border-[var(--ink)]" : "bg-[var(--card)] border-[var(--soft)] hover:border-[var(--muted)]")}>
              {p.label}
            </button>
          ))}
        </div>

        {/* The whole deal in date order, so the proof dates below make sense. */}
        {biddingEndsAt !== null && plan.length > 0 && (
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 list-none m-0 px-3.5 py-2.5 rounded-2xl bg-[var(--soft)] text-sm" aria-label="Your timeline">
            <li><b>Bidding ends</b> <span className="text-[var(--muted)]">{when(biddingEndsAt)}</span></li>
            {event && (
              <>
                <li aria-hidden="true"><ArrowRight size={13} className="text-[var(--muted)]" /></li>
                <li><b>{event.name}</b> <span className="text-[var(--muted)]">{when(event.startsAt)} – {when(event.endsAt)}</span></li>
              </>
            )}
            <li aria-hidden="true"><ArrowRight size={13} className="text-[var(--muted)]" /></li>
            <li><b>Last proof</b> <span className="text-[var(--muted)]">by {when(plan[plan.length - 1].deadline)}</span></li>
          </ol>
        )}

        {/* The live payout bar */}
        <div className="flex h-[52px] rounded-2xl overflow-hidden gap-[3px]" aria-hidden="true">
          {plan.map((m, i) => {
            const Icon = iconFor(m.name);
            return (
              <motion.span key={`${plan.length}-${i}`} layout={!reduce} initial={false} animate={{ width: `${m.bps / 100}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="flex items-center gap-2 px-3 min-w-0 overflow-hidden text-[#0B0B0C]" style={{ background: COLORS[i] }}>
                <Icon size={16} className="flex-none" />
                <b className="font-mono text-[15px] whitespace-nowrap">{Math.round(m.bps / 100)}%</b>
              </motion.span>
            );
          })}
        </div>
        <ol className="grid gap-2 list-none m-0 p-0">
          {plan.map((m, i) => (
            <li key={i} className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[15px]">
              <span className="w-3 h-3 rounded-[4px] flex-none" style={{ background: COLORS[i] }} />
              <b className="min-w-0 truncate">{m.name}</b>
              <span className="text-[var(--muted)] flex-none">by {when(m.deadline)}</span>
              <span className="ml-auto font-mono font-semibold flex-none">${Math.round(m.bps / 100)} <span className="text-[var(--muted)] font-normal">per $100</span></span>
            </li>
          ))}
        </ol>

        {draft.payout === "upfront" && (
          <label className="flex items-center gap-x-3.5 gap-y-2 flex-wrap p-3 rounded-2xl bg-[var(--soft)] text-sm">
            <span>Before the event, for printing</span>
            <input type="range" min={10} max={50} step={5} value={draft.upfrontPct} onChange={(e) => set({ upfrontPct: Number(e.target.value) })}
              aria-label="Share paid before the event" className="flex-1 min-w-[120px] accent-[var(--accent)]" />
            <b className="font-mono w-11 text-right">{draft.upfrontPct}%</b>
          </label>
        )}

        {draft.payout === "custom" && (
          <div className="grid gap-2 p-3 rounded-2xl bg-[var(--soft)]">
            {draft.custom.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input value={r.name} maxLength={40} aria-label={`Step ${i + 1} name`} placeholder={`Step ${i + 1}`}
                  onChange={(e) => set({ custom: draft.custom.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] text-sm" />
                <span className="flex items-center h-10 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] pr-2.5">
                  <input inputMode="numeric" value={r.pct} aria-label={`Step ${i + 1} percent`}
                    onChange={(e) => set({ custom: draft.custom.map((x, j) => (j === i ? { ...x, pct: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) } : x)) })}
                    className="w-12 h-full bg-transparent text-right font-mono outline-none" />
                  <span className="text-sm text-[var(--muted)]">%</span>
                </span>
                <button type="button" aria-label={`Remove step ${i + 1}`} disabled={draft.custom.length < 2}
                  onClick={() => set({ custom: draft.custom.filter((_, j) => j !== i) })}
                  className="w-10 h-10 rounded-xl grid place-items-center hover:bg-[var(--paper)] disabled:opacity-40"><Trash2 size={15} /></button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              {draft.custom.length < 4 ? (
                <button type="button" onClick={() => set({ custom: [...draft.custom, { name: "", pct: 0 }] })} className="btn-base btn-small btn-ghost"><Plus size={13} /> Add a step</button>
              ) : <span />}
              <span className={cn("text-sm font-semibold", customTotal === 100 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                {customTotal === 100 ? "Adds up to 100%" : `${customTotal}% of 100%`}
              </span>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">
          {event
            ? `The dates follow ${event.name}: the print proof is due when it starts (or a day after bidding ends, if that's later), and the last proof 3 days after it ends.`
            : "With no event, proofs start 5 days after bidding ends."}
        </p>
      </section>

      <section className="grid gap-1 pt-6">
        <Head title="What every brand gets" sub="This is the proof you'll post. Keep only what you'll really do." />
        {menu.map((d) => {
          const on = draft.deliverables.includes(d);
          return (
            <button key={d} type="button" role="switch" aria-checked={on}
              onClick={() => set({ deliverables: menu.filter((x) => (x === d ? !on : draft.deliverables.includes(x))) })}
              className={cn("flex items-center gap-3.5 min-h-[50px] px-1 text-left rounded-xl hover:bg-[var(--soft)]/60", !on && "opacity-60")}>
              <span className="flex-1 text-[15px]">{d}</span>
              {d === X_POST && <span className="text-xs text-[var(--muted)] hidden sm:inline">shows the brand on X</span>}
              <Switch on={on} />
            </button>
          );
        })}
      </section>
    </div>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="grid gap-0.5">
      <b className="text-lg">{title}</b>
      <span className="text-sm text-[var(--muted)]">{sub}</span>
    </span>
  );
}

function Seg<T extends string | number>({ value, options, onPick, label }: { value: T; options: { value: T; label: string }[]; onPick: (v: T) => void; label: string }) {
  return (
    <span className="inline-flex p-1 rounded-full bg-[var(--soft)]" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onPick(o.value)}
          className={cn("h-9 px-4 rounded-full text-sm font-bold transition-colors", value === o.value ? "bg-[var(--card)] shadow-[0_1px_4px_rgba(11,11,12,0.15)]" : "text-[var(--muted)]")}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={cn("relative w-11 h-[26px] rounded-full flex-none transition-colors", on ? "bg-[var(--green)]" : "bg-[var(--muted)]/40")} aria-hidden="true">
      <span className={cn("absolute top-[3px] w-5 h-5 rounded-full bg-white shadow grid place-items-center transition-[left]", on ? "left-[21px]" : "left-[3px]")}>
        {on && <Check size={11} className="text-[var(--green)]" strokeWidth={3} />}
      </span>
    </span>
  );
}
