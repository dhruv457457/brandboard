"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { Flame, Heart, Zap, type LucideIcon } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import type { SpottedPost } from "@/lib/spotted";
import { cn } from "@/lib/utils";

export type Reactions = SpottedPost["reactions"];
type Kind = keyof Reactions["counts"];

const REACTIONS: { kind: Kind; Icon: LucideIcon; label: string; color: string }[] = [
  { kind: "flame", Icon: Flame, label: "Fire", color: "#FF5A1F" },
  { kind: "zap", Icon: Zap, label: "Cheer", color: "#E8A400" },
  { kind: "heart", Icon: Heart, label: "Love", color: "#E5484D" },
];

export const EMPTY_REACTIONS: Reactions = { counts: { flame: 0, zap: 0, heart: 0 }, mine: [] };

/**
 * Three icon reactions on a photo (postId) or a listing (listingId): tap to add yours, tap again to take it back.
 * Adding one pops the icon and throws a few copies of it outwards; the count rolls. Flips at once, rolls back on an error.
 */
export function ReactionBar({ postId, listingId, initial, onSignIn, size = "small" }: {
  postId?: string;
  listingId?: number;
  initial?: Reactions;
  onSignIn: () => void;
  size?: "small" | "large";
}) {
  const { authenticated } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [state, setState] = useState<Reactions>(initial ?? EMPTY_REACTIONS);
  // Which reaction was just added, and a counter so the same one can burst again.
  const [burst, setBurst] = useState<{ kind: Kind; n: number } | null>(null);
  useEffect(() => {
    if (initial) setState(initial);
  }, [initial]);

  async function toggle(kind: Kind) {
    if (!authenticated) return onSignIn();
    const on = !state.mine.includes(kind);
    const before = state;
    setState({
      counts: { ...state.counts, [kind]: Math.max(0, state.counts[kind] + (on ? 1 : -1)) },
      mine: on ? [...state.mine, kind] : state.mine.filter((k) => k !== kind),
    });
    if (on) setBurst((b) => ({ kind, n: (b?.n ?? 0) + 1 }));
    const res = await authedFetch("/api/reactions", {
      method: on ? "POST" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(listingId !== undefined ? { listingId, kind } : { postId, kind }),
    }).catch(() => null);
    if (res?.ok) setState((await res.json()) as Reactions);
    else setState(before);
  }

  const big = size === "large";
  return (
    <div className="flex gap-1.5" role="group" aria-label="Reactions">
      {REACTIONS.map(({ kind, Icon, label, color }) => {
        const on = state.mine.includes(kind);
        const count = state.counts[kind];
        return (
          <button
            key={kind}
            type="button"
            onClick={(e) => { e.stopPropagation(); void toggle(kind); }}
            aria-pressed={on}
            aria-label={`${label}${count ? `, ${count}` : ""}`}
            className={cn(
              "relative inline-flex items-center gap-1 rounded-full border-[1.5px] font-semibold transition-colors",
              big ? "h-9 px-3 text-sm" : "h-7 px-2 text-xs",
              on ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-text)]" : "border-[var(--soft)] text-[var(--muted)] hover:border-[var(--line)] hover:text-[var(--ink)]",
            )}
          >
            <Pop on={on} trigger={burst?.kind === kind ? burst.n : 0}>
              <Icon size={big ? 16 : 13} fill={on ? color : "none"} color={on ? color : "currentColor"} />
            </Pop>
            {count > 0 && <NumberFlow value={count} className="font-mono" />}
            {burst?.kind === kind && <Burst key={burst.n} Icon={Icon} color={color} />}
          </button>
        );
      })}
    </div>
  );
}

/** The icon itself: a springy pop each time the reaction is added. */
function Pop({ on, trigger, children }: { on: boolean; trigger: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={trigger}
      className="inline-flex"
      initial={reduce || !on || trigger === 0 ? false : { scale: 0.4, rotate: -18 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 13 }}
    >
      {children}
    </motion.span>
  );
}

/** Six little copies of the icon flying out and fading, like confetti. */
function Burst({ Icon, color }: { Icon: LucideIcon; color: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const bits = Array.from({ length: 6 }, (_, i) => {
    const angle = (-90 + (i - 2.5) * 32) * (Math.PI / 180);
    return { x: Math.cos(angle) * (26 + (i % 2) * 10), y: Math.sin(angle) * (30 + (i % 3) * 8), r: (i - 2.5) * 22 };
  });
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      <AnimatePresence>
        {bits.map((b, i) => (
          <motion.span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
            animate={{ x: b.x, y: b.y, scale: 1, opacity: 0, rotate: b.r }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Icon size={12} fill={color} color={color} />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
