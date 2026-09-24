"use client";

import { useEffect, useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useAutoBid } from "@/lib/market/useAutoBid";

const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

interface Props {
  listingId: number;
  patchId: number;
  label: string;
  /** Lowest bid that would lead right now, and the buy-now price (6-decimal USDC). */
  minNext: bigint;
  buyNow: bigint;
  /** Hide the panel while a normal bid is in flight. */
  disabled?: boolean;
}

/** "Keep me on top up to $X": turn auto-bid on, change it or turn it off for one patch. */
export function AutoBidPanel({ listingId, patchId, label, minNext, buyNow, disabled }: Props) {
  const auto = useAutoBid();
  const [active, setActive] = useState<bigint | null>(null);
  const [text, setText] = useState("");
  const [paused, setPaused] = useState<null | "balance" | "allowance">(null);

  useEffect(() => {
    let alive = true;
    auto.current(listingId, patchId).then((v) => {
      if (!alive) return;
      setActive(v);
      setText(String(Number(v > 0n ? v : suggested(minNext, buyNow)) / 1e6));
    }).catch(() => alive && setActive(0n));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, patchId, auto.current]);

  // An active auto-bid that can't afford the next step is paused, even though the rule is still on.
  useEffect(() => {
    if (!active) return setPaused(null);
    let alive = true;
    auto.health(minNext).then((h) => alive && setPaused(h === "ok" ? null : h)).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, minNext, auto.health]);

  if (!auto.available) return null;

  let max = 0n;
  try {
    max = parseUsdc(text || "0");
  } catch {
    max = 0n;
  }
  const tooLow = max < minNext;
  const on = (active ?? 0n) > 0n;

  async function save() {
    const ok = await auto.enable(listingId, patchId, max);
    if (ok) {
      setActive(max);
      toast(`Auto-bid on for ${label}. You stay on top up to ${usd(max)}.`);
    }
  }

  async function stop() {
    const ok = await auto.disable(listingId, patchId);
    if (ok) {
      setActive(0n);
      toast(`Auto-bid off for ${label}.`);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--line)] p-4 grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bold">
          <Bot size={18} className="text-[var(--accent-text)]" /> Auto-bid
        </span>
        {on && !paused && <span className="text-xs font-semibold rounded-full bg-[var(--green-soft)] text-[var(--green)] px-2 py-0.5">On, up to {usd(active!)}</span>}
        {on && paused && <span className="text-xs font-semibold rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] px-2 py-0.5">Paused</span>}
      </div>
      <p className="text-sm text-[var(--muted)]">
        Keep me on top up to a maximum. When someone outbids you, Patched bids the next step for you, within seconds.
      </p>
      <label className="grid gap-1.5">
        <span className="field-label">Up to</span>
        <div className="amt">
          <span>$</span>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} disabled={disabled || auto.busy} aria-label="Auto-bid maximum" />
          <span>USDC</span>
        </div>
      </label>
      {tooLow && text && <p className="text-xs text-[var(--muted)]">Set at least {usd(minNext)}, the next bid on this patch.</p>}
      {on && paused && (
        <p className="text-xs rounded-lg bg-[var(--accent-soft)] p-2" role="status">
          {paused === "balance"
            ? `Auto-bid is paused: your wallet has less than ${usd(minNext)}, the next bid. Add funds and it picks up again.`
            : "Auto-bid is paused: its spending permission ran out during the bidding. Press Update maximum to top it up."}
        </p>
      )}
      {auto.error && <p className="text-sm text-[var(--red)]" role="alert">{auto.error}</p>}
      <div className="flex gap-2 flex-wrap">
        <Button variant={on ? "default" : "primary"} disabled={disabled || auto.busy || tooLow || (max === active && paused !== "allowance")} onClick={save}>
          {auto.busy ? "Saving…" : on ? "Update maximum" : "Turn on auto-bid"}
        </Button>
        {on && (
          <Button variant="ghost" disabled={disabled || auto.busy} onClick={stop}>Turn off</Button>
        )}
      </div>
      <p className="text-xs text-[var(--muted)] flex gap-1.5 items-start">
        <ShieldCheck size={14} className="flex-none mt-px" />
        Runs on a Privy server wallet that can only call the auto-bid contract. The contract never bids above your
        maximum, and outbid bids come straight back to you.
      </p>
    </div>
  );
}

/** A sensible starting maximum: twice the next bid, capped at buy-now. */
function suggested(minNext: bigint, buyNow: bigint): bigint {
  const two = minNext * 2n;
  return two > buyNow ? buyNow : two;
}
