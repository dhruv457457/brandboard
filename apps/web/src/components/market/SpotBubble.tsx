"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BadgeCheck, Flame, Loader2, SlidersHorizontal, X } from "lucide-react";
import { PATCH_TIERS } from "@patched/shared";
import { cn } from "@/lib/utils";
import { formatShortAddress, formatTimeAgo, formatUsdc } from "@/lib/format";
import type { LivePatch } from "@/lib/market/types";
import type { SpotHeat } from "@/lib/market/heat";

const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

interface Props {
  patch: LivePatch;
  /** Lowest bid that takes the lead right now (capped at buy-now). */
  minNext: bigint;
  /** How contested the spot is, and its latest bids (newest first). */
  heat?: SpotHeat;
  history?: { id: string; who: string; amount: bigint; time: number }[];
  me?: string;
  isCreator: boolean;
  authenticated: boolean;
  biddingOpen: boolean;
  busy: boolean;
  /** Last bid error from useBid, shown inside the bubble. */
  error?: string | null;
  onLogin: () => void;
  onBid: (amount: bigint) => void;
  onMore: (amount: bigint) => void;
  onClose: () => void;
}

/**
 * The bid bubble that opens on a spot: what it is, what it costs, who leads, and one big button that bids
 * the minimum to take the lead. Quick chips change the amount; "More" opens the full sheet (custom amount,
 * auto-bid). Positioned next to the patch inside the stage.
 */
export function SpotBubble({ patch, minNext, heat, history = [], me, isCreator, authenticated, biddingOpen, busy, error, onLogin, onBid, onMore, onClose }: Props) {
  const [amount, setAmount] = useState(minNext);
  // Reset to the minimum when the spot changes or someone outbids.
  useEffect(() => setAmount(minNext), [patch.id, minNext]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mine = !!me && patch.topBidder === me;
  const tier = PATCH_TIERS[patch.tier];
  const buying = amount >= patch.buyNow;
  const chips: { label: string; value: bigint }[] = [
    { label: `+$5`, value: minNext + 5_000_000n },
    { label: `+$10`, value: minNext + 10_000_000n },
    { label: `Buy ${usd(patch.buyNow)}`, value: patch.buyNow },
  ].filter((c, i, all) => c.value <= patch.buyNow && all.findIndex((x) => x.value === c.value) === i);

  // Sit below the patch when it's in the upper part of the image, above it otherwise; stay inside the stage.
  const center = Math.min(78, Math.max(22, patch.x + patch.w / 2));
  const below = patch.y + patch.h < 58;
  const style: React.CSSProperties = below
    ? { left: `${center}%`, top: `calc(${patch.y + patch.h}% + 10px)` }
    : { left: `${center}%`, bottom: `calc(${100 - patch.y}% + 10px)` };

  return (
    <motion.div
      key={patch.id}
      role="dialog"
      aria-label={`Spot ${patch.id + 1}: ${patch.label}`}
      initial={{ opacity: 0, scale: 0.85, y: below ? -8 : 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="absolute z-30 w-[min(280px,92%)] -translate-x-1/2 card-surface p-3.5 grid gap-2.5"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-mono text-[11px] text-[var(--muted)]">{String(patch.id + 1).padStart(2, "0")} · {tier.label}</span>
          <b className="block text-lg leading-tight truncate">{patch.label}</b>
        </div>
        <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg grid place-items-center hover:bg-[var(--soft)] flex-none">
          <X size={15} />
        </button>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <b className="font-mono text-2xl tabular-nums">{usd(patch.topBid > 0n ? patch.topBid : patch.floor)}</b>
          <span className="block text-[11px] text-[var(--muted)]">{patch.bought ? "bought" : patch.topBid > 0n ? "top bid" : "starting bid"}</span>
        </div>
        {patch.topBidder && (
          <span className="text-xs text-right min-w-0">
            <span className="text-[var(--muted)]">Leading</span>
            <b className="flex items-center gap-1 justify-end truncate">
              {mine ? "You" : patch.brandName ?? formatShortAddress(patch.topBidder)}
              {patch.brandVerified && <BadgeCheck size={13} className="text-[var(--green)] flex-none" />}
            </b>
          </span>
        )}
      </div>

      {heat?.war && biddingOpen && !patch.bought && (
        <span className="text-xs font-semibold text-[var(--accent-text)] flex items-center gap-1.5">
          <Flame size={13} /> Bidding war: {heat.recent} bids in 15 min
        </span>
      )}
      {history.length > 0 && (
        <ul className="grid gap-0.5 text-[11px] border-t-[1.5px] border-[var(--soft)] pt-2" aria-label="Latest bids on this spot">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-2">
              <span className="truncate">{h.who}</span>
              <span className="font-mono tabular-nums text-[var(--muted)] flex-none">{usd(h.amount)} · {formatTimeAgo(h.time)}</span>
            </li>
          ))}
        </ul>
      )}

      {isCreator ? (
        <p className="text-xs text-[var(--muted)]">This is your spot. Share your page so brands bid on it.</p>
      ) : !biddingOpen || patch.bought ? (
        <p className="text-xs text-[var(--muted)]">{patch.bought ? "This spot was bought outright." : "Bidding is closed."}</p>
      ) : mine ? (
        <p className="text-xs font-semibold text-[var(--green)]">You lead this spot. We&apos;ll tell you if someone outbids you.</p>
      ) : (
        <>
          {chips.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {chips.map((c) => (
                <button
                  key={c.label}
                  onClick={() => setAmount(amount === c.value ? minNext : c.value)}
                  aria-pressed={amount === c.value}
                  className="text-xs font-semibold rounded-full px-2.5 py-1 border-[1.5px] border-[var(--line)] bg-[var(--card)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            {authenticated ? (
              <button
                onClick={() => onBid(amount)}
                disabled={busy}
                className="btn-base btn-primary flex-1 disabled:opacity-70"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : null}
                {busy ? "Placing…" : buying ? `Buy it · ${usd(patch.buyNow)}` : `Bid ${usd(amount)}`}
              </button>
            ) : (
              <button onClick={onLogin} className="btn-base btn-primary flex-1">Sign in to bid</button>
            )}
            <button onClick={() => onMore(amount)} className="btn-base px-3" aria-label="More bid options" title="Custom amount and auto-bid">
              <SlidersHorizontal size={16} />
            </button>
          </div>
          {error ? (
            <span className="text-xs text-[var(--red)] font-semibold" role="alert">{error}</span>
          ) : (
            <span className="text-[11px] text-[var(--muted)]">Outbid? Your USDC comes straight back.</span>
          )}
        </>
      )}
    </motion.div>
  );
}

/** A quick confetti burst from a point in the stage (percent coordinates), for taking the lead. */
export function Burst({ x, y, show }: { x: number; y: number; show: boolean }) {
  const colors = ["#FF5A1F", "#D9CCFF", "#FFE58F", "#BDEBD3", "#BFE3FF", "#FFC9DA"];
  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 pointer-events-none z-40" aria-hidden="true">
          {Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            const dist = 60 + (i % 3) * 25;
            return (
              <motion.span
                key={i}
                className={cn("absolute w-2.5 h-2.5 rounded-[3px] border border-[#0B0B0C]")}
                style={{ left: `${x}%`, top: `${y}%`, background: colors[i % colors.length] }}
                initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                animate={{ opacity: 0, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 30, rotate: 200, scale: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
