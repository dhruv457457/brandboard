"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { useAutoBid } from "@/lib/market/useAutoBid";
import { useProfile } from "@/lib/profile";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { requireBrand, shouldAskBrand } from "@/components/market/BrandSetup";

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
  const { profile } = useProfile();
  const { walletAddress } = usePatchedAuth();
  const [active, setActive] = useState<bigint | null>(null);
  const [text, setText] = useState("");
  // Once the brand types, a load that lands late must not overwrite what they typed.
  const typed = useRef(false);
  const [paused, setPaused] = useState<null | "balance" | "allowance">(null);

  useEffect(() => {
    let alive = true;
    auto.current(listingId, patchId).then((v) => {
      if (!alive) return;
      setActive(v);
      if (!typed.current) setText(String(Number(v > 0n ? v : suggested(minNext, buyNow)) / 1e6));
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
    // Auto-bid bids as your brand, so the same brand check as a normal bid comes first.
    if (shouldAskBrand(profile, listingId, walletAddress) && !(await requireBrand(listingId))) return;
    const ok = await auto.enable(listingId, patchId, max);
    if (ok) {
      setActive(max);
      setText(String(Number(max) / 1e6));
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
    <div className="rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--paper)] p-3 grid gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bold text-sm">
          <Bot size={16} className="text-[var(--accent-text)]" /> Auto-bid
        </span>
        {on && !paused && <span className="text-xs font-semibold rounded-full bg-[var(--green-soft)] text-[var(--green)] px-2 py-0.5">On, up to {usd(active!)}</span>}
        {on && paused && <span className="text-xs font-semibold rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] px-2 py-0.5">Paused</span>}
      </div>
      <p className="text-xs text-[var(--muted)]">If someone outbids you, Patched bids the next step for you, up to this maximum.</p>
      <div className="flex gap-2 items-stretch">
        <label className="flex-1 min-w-0 flex items-center gap-1.5 h-10 px-3 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--card)]">
          <span className="text-[var(--muted)] font-mono">$</span>
          <input className="w-0 flex-1 min-w-0 bg-transparent outline-none font-mono text-base font-semibold" inputMode="decimal" value={text}
            onChange={(e) => { typed.current = true; setText(e.target.value); }} disabled={disabled || auto.busy} aria-label="Auto-bid maximum" />
          <span className="text-xs text-[var(--muted)] font-mono">USDC</span>
        </label>
        <Button variant={on ? "default" : "primary"} className="flex-none" disabled={disabled || auto.busy || tooLow || (max === active && paused !== "allowance")} onClick={save}>
          {auto.busy ? "Saving…" : on ? "Update" : "Turn on"}
        </Button>
      </div>
      {tooLow && text && <p className="text-xs text-[var(--muted)]">Set at least {usd(minNext)}, the next bid on this patch.</p>}
      {on && paused && (
        <p className="text-xs rounded-lg bg-[var(--accent-soft)] p-2" role="status">
          {paused === "balance"
            ? `Auto-bid is paused: your wallet has less than ${usd(minNext)}, the next bid. Send USDC to your wallet and it picks up again.`
            : "Auto-bid is paused: its spending permission ran out during the bidding. Press Update to top it up."}
        </p>
      )}
      {auto.error && <p className="text-sm text-[var(--red)]" role="alert">{auto.error}</p>}
      {on && (
        <button type="button" className="justify-self-start text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]" disabled={disabled || auto.busy} onClick={stop}>
          Turn off auto-bid
        </button>
      )}
      <details className="text-xs text-[var(--muted)]">
        <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 font-semibold"><ShieldCheck size={13} /> How it works</summary>
        <p className="mt-1.5">
          {auto.mode === "signer"
            ? "Bids come from your own wallet. Patched is added to it as a Privy signer whose policy only allows bids on the spots you pick, never above your maximum. Revoke it any time in Settings."
            : "Runs on a Privy server wallet that can only call the auto-bid contract. The contract never bids above your maximum, and outbid bids come straight back to you. Your maximum is public on-chain, so someone could bid just to push you up toward it: a Patched wallet keeps it private."}
        </p>
      </details>
    </div>
  );
}

/** A sensible starting maximum: twice the next bid, capped at buy-now. */
function suggested(minNext: bigint, buyNow: bigint): bigint {
  const two = minNext * 2n;
  return two > buyNow ? buyNow : two;
}
