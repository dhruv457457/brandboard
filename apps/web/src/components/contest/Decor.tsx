"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Caveat_Brush } from "next/font/google";
import NumberFlow from "@number-flow/react";
import { cn } from "@/lib/utils";

export const hand = Caveat_Brush({ subsets: ["latin"], weight: "400", display: "swap" });

export const PASTEL_CLASS = ["ct-p1", "ct-p2", "ct-p3", "ct-p4", "ct-p5"] as const;
const COLORS = ["#FF5A1F", "#D9CCFF", "#FFE58F", "#BDEBD3", "#BFE3FF", "#FFC9DA"];

/** A stitched pastel patch: the page's one decorative building block. */
export function Patch({ children, tone = 2, rotate = -3, className, style, hover }: {
  children?: React.ReactNode; tone?: number | "orange"; rotate?: number; className?: string; style?: React.CSSProperties; hover?: boolean;
}) {
  return (
    <div
      className={cn("ct-patch", tone === "orange" ? "ct-orange" : PASTEL_CLASS[tone % 5], hover && "is-hover", className)}
      style={{ "--r": `${rotate}deg`, ...style } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/** Patches drifting around a section, behind its content. */
export function Floaters({ items, className }: { className?: string; items: { x: string; y: string; size: number; tone: number | "orange"; rotate: number; dur?: number; delay?: number; bob?: number; label?: string }[] }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)} aria-hidden="true">
      {items.map((it, i) => (
        <div
          key={i}
          className="ct-float"
          style={{ left: it.x, top: it.y, "--r": `${it.rotate}deg`, "--dur": `${it.dur ?? 7 + (i % 3)}s`, "--delay": `${it.delay ?? -i * 1.3}s`, "--bob": `${it.bob ?? 12}px` } as React.CSSProperties}
        >
          <Patch tone={it.tone} rotate={it.rotate} style={{ width: it.size, height: it.size * 0.82, borderRadius: it.size * 0.22 }} className="font-display font-extrabold text-[15px]">
            {it.label}
          </Patch>
        </div>
      ))}
    </div>
  );
}

/** A round badge with text running round its edge, slowly turning. */
export function SpinBadge({ text, size = 150, children }: { text: string; size?: number; children?: React.ReactNode }) {
  const id = useMemo(() => `ct-circle-${Math.random().toString(36).slice(2, 7)}`, []);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 200 200" width={size} height={size} className="ct-spin absolute inset-0">
        <defs>
          <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#0b0b0c" strokeOpacity=".5" strokeWidth="2" strokeDasharray="6 6" />
        <text fontFamily="var(--font-bricolage), sans-serif" fontWeight={800} fontSize="17" letterSpacing="2.6" fill="#0b0b0c">
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <div className="relative font-display font-extrabold text-[#0b0b0c] text-center leading-none">{children}</div>
    </div>
  );
}

/** An orange thread drawn under a word. */
export function ThreadUnderline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 18" preserveAspectRatio="none" className={cn("w-full h-[14px]", className)} fill="none" aria-hidden="true">
      <path className="ct-draw" pathLength={1} d="M3 11 C 60 2, 110 17, 160 9 S 250 3, 297 10" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="1" />
    </svg>
  );
}

/** Section heading: a small eyebrow, a big title and (optionally) a hand-written aside. */
export function Heading({ eyebrow, title, note, className }: { eyebrow: string; title: React.ReactNode; note?: string; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-text)]">
        <span className="w-6 border-t-[2.5px] border-dashed border-[var(--accent-text)]" /> {eyebrow}
      </span>
      <h2 className="font-display font-extrabold text-[clamp(30px,5vw,48px)] leading-[1.02] tracking-tight m-0">{title}</h2>
      {note && <span className={cn(hand.className, "text-[26px] leading-none text-[var(--muted)] -rotate-1")}>{note}</span>}
    </div>
  );
}

/** Days, hours, minutes and seconds to a moment, as four patches with rolling digits. */
export function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? 0 : Math.max(0, to - now);
  const parts = [
    ["Days", Math.floor(left / 86_400_000)],
    ["Hours", Math.floor(left / 3_600_000) % 24],
    ["Min", Math.floor(left / 60_000) % 60],
    ["Sec", Math.floor(left / 1000) % 60],
  ] as const;
  if (now !== null && now >= to) {
    return <Patch tone="orange" rotate={-2} className="px-6 py-4 font-display font-extrabold text-2xl">Entries closed</Patch>;
  }
  return (
    <div className="flex gap-2.5 sm:gap-3" role="timer" aria-label="Time left to enter">
      {parts.map(([label, v], i) => (
        <Patch key={label} tone={[3, 1, 2, 4][i]!} rotate={[-3, 2, -2, 3][i]!} hover className="w-[68px] sm:w-[84px] py-2.5 sm:py-3">
          <div className="grid place-items-center leading-none">
            <span className="font-display font-extrabold text-[30px] sm:text-[40px] tabular-nums">
              <NumberFlow value={now === null ? 0 : v} format={{ minimumIntegerDigits: 2 }} trend={-1} />
            </span>
            <span className="mt-1 font-mono text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#0b0b0c]/70">{label}</span>
          </div>
        </Patch>
      ))}
    </div>
  );
}

/** A burst of small patches falling from the top: for "You're in" and for the winner. */
export function Confetti({ fire }: { fire: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () => Array.from({ length: 56 }, (_, i) => ({
      x: (i * 37) % 100, delay: (i % 14) * 0.04, dur: 1.6 + ((i * 13) % 10) / 8, size: 10 + ((i * 7) % 12),
      rot: ((i * 53) % 540) - 270, drift: ((i * 29) % 160) - 80, color: COLORS[i % COLORS.length]!,
    })),
    [],
  );
  if (reduce || fire === 0) return null;
  return (
    <div key={fire} className="fixed inset-0 z-[60] pointer-events-none overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-[3px] border-[1.5px] border-[#0b0b0c]"
          style={{ left: `${p.x}%`, top: -30, width: p.size, height: p.size * 0.8, background: p.color }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.rot, opacity: [1, 1, 0.9] }}
          transition={{ duration: p.dur + 0.8, delay: p.delay, ease: [0.2, 0.6, 0.5, 1] }}
        />
      ))}
    </div>
  );
}
