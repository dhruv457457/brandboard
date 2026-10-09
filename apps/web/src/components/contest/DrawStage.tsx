"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ExternalLink, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { PublicEntry } from "@/lib/contest";
import { Confetti, Patch, hand } from "./Decor";

export interface DrawResult {
  deadline: number;
  count: number;
  drawn: boolean;
  block?: { number: number; hash: string; url: string };
  index?: number | null;
  winner?: string | null;
}

const h01 = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

/** The lucky-draw drum: every entry is a patch tumbling about; on draw they spin, one drops out and gets the WINNER stamp. */
export function DrawStage({ entries, draw }: { entries: PublicEntry[]; draw: DrawResult | null }) {
  const reduce = useReducedMotion();
  const pool = useMemo(() => entries.filter((e) => e.tracks.includes("lucky")), [entries]);
  // Always enough patches to look alive; the ones with a dash are open seats ("you").
  const pieces = useMemo(() => {
    const real = pool.slice(0, 42).map((e) => ({ handle: e.handle, avatar: e.avatar, seat: false }));
    const fill = Math.max(0, 16 - real.length);
    return [...real, ...Array.from({ length: fill }, (_, i) => ({ handle: "", avatar: null, seat: true, key: i }))];
  }, [pool]);

  const [phase, setPhase] = useState<"idle" | "spin" | "reveal">("idle");
  const [winner, setWinner] = useState<{ handle: string; avatar: string | null; preview: boolean } | null>(null);
  const [fire, setFire] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function run() {
    timers.current.forEach(clearTimeout);
    // The real result when the draw has happened; otherwise a preview among the people already in.
    let w: { handle: string; avatar: string | null; preview: boolean };
    if (draw?.drawn && draw.winner) {
      const hit = entries.find((e) => e.handle === draw.winner);
      w = { handle: draw.winner, avatar: hit?.avatar ?? null, preview: false };
    } else {
      const real = pool.length ? pool[Math.floor(Math.random() * pool.length)]! : null;
      w = { handle: real?.handle ?? "you", avatar: real?.avatar ?? null, preview: true };
    }
    setWinner(null);
    setPhase("spin");
    timers.current.push(
      setTimeout(() => {
        setWinner(w);
        setPhase("reveal");
        setFire((n) => n + 1);
      }, reduce ? 200 : 2600),
    );
  }

  return (
    <div className="grid gap-5">
      <div className={`ct-drum ${phase === "spin" ? "is-spinning" : ""}`} aria-label="Lucky draw preview">
        {pieces.map((p, i) => {
          // golden-ratio spread: even coverage of the drum, never in a pile
          const left = 4 + ((i * 0.618034 + 0.13) % 1) * 74;
          const top = 7 + ((i * 0.754877 + 0.31) % 1) * 66;
          const v = (k: number, s: number) => `${Math.round((h01(i, k) - 0.5) * s)}px`;
          const dim = phase === "reveal";
          return (
            <div
              key={`${p.handle}-${i}`}
              className="ct-tumble"
              style={{
                left: `${left}%`, top: `${top}%`, "--dur": `${7 + h01(i, 3) * 6}s`, "--delay": `${-h01(i, 4) * 8}s`,
                "--x0": "0px", "--y0": "0px", "--r0": `${Math.round((h01(i, 5) - 0.5) * 30)}deg`,
                "--x1": v(6, 70), "--y1": v(7, 60), "--r1": `${Math.round((h01(i, 8) - 0.5) * 80)}deg`,
                "--x2": v(9, 80), "--y2": v(10, 70), "--r2": `${Math.round((h01(i, 11) - 0.5) * 80)}deg`,
                "--x3": v(12, 70), "--y3": v(13, 60), "--r3": `${Math.round((h01(i, 14) - 0.5) * 60)}deg`,
              } as React.CSSProperties}
            >
              <motion.div animate={{ opacity: dim ? 0.18 : p.seat ? 0.55 : 1, scale: dim ? 0.85 : 1 }} transition={{ duration: 0.5 }}>
                <Patch tone={i} rotate={0} className="px-2.5 py-2 gap-1.5 grid-flow-col" style={{ borderRadius: 14, boxShadow: "3px 3px 0 var(--shadow)" }}>
                  {p.seat ? (
                    <span className="font-display font-extrabold text-[13px] px-1">{["You?", "Next?", "Maybe you", "Your turn"][i % 4]}</span>
                  ) : (
                    <>
                      <Avatar src={p.avatar} name={p.handle} wallet={null} size={22} />
                      <span className="font-display font-extrabold text-[12px] max-w-[88px] truncate">@{p.handle}</span>
                    </>
                  )}
                </Patch>
              </motion.div>
            </div>
          );
        })}

        <AnimatePresence>
          {phase === "reveal" && winner && (
            <motion.div
              key="w"
              className="absolute inset-0 grid place-items-center z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={reduce ? false : { y: -220, scale: 0.4, rotate: -24 }}
                animate={{ y: 0, scale: 1, rotate: -2 }}
                transition={{ type: "spring", stiffness: 240, damping: 16 }}
                className="relative"
              >
                <Patch tone="orange" rotate={0} className="px-8 py-6 gap-3 justify-items-center" style={{ borderRadius: 26, boxShadow: "7px 7px 0 var(--shadow)" }}>
                  <Avatar src={winner.avatar} name={winner.handle} wallet={null} size={72} className="!border-[3px] !border-[#0b0b0c]" />
                  <span className="font-display font-extrabold text-[26px] leading-none">@{winner.handle}</span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">{winner.preview ? "Preview draw" : "Lucky draw winner"}</span>
                </Patch>
                {!winner.preview && <span className="ct-stamp ct-winner absolute -top-4 -right-6 text-[15px] px-3 py-1.5">Winner</span>}
                {winner.preview && <span className="ct-stamp ct-winner absolute -top-4 -right-6 text-[13px] px-3 py-1.5">Just a preview</span>}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute left-4 bottom-4 z-20 flex items-center gap-2">
          <button type="button" onClick={run} disabled={phase === "spin"} className="btn-base btn-primary btn-small">
            {phase === "idle" ? <><Play size={15} /> Preview the draw</> : phase === "spin" ? "Drawing…" : <><RotateCcw size={15} /> Draw again</>}
          </button>
        </div>
        <span className={`${hand.className} absolute right-6 bottom-4 text-[24px] text-[var(--muted)] -rotate-3 z-20`}>
          {draw?.drawn ? "the real one" : "this is a preview"}
        </span>
      </div>
      <Confetti fire={fire} />

      <Fairness draw={draw} />
    </div>
  );
}

function Fairness({ draw }: { draw: DrawResult | null }) {
  return (
    <div className="rounded-[22px] border-2 border-[var(--ink)] bg-[var(--card)] p-5 shadow-[4px_4px_0_var(--shadow)] grid gap-3">
      <h3 className="m-0 flex items-center gap-2 font-display font-extrabold text-xl"><ShieldCheck size={20} className="text-[var(--green)]" /> Provably fair</h3>
      <ol className="m-0 pl-5 grid gap-1.5 text-[14px] leading-snug text-[var(--muted)]">
        <li>At the deadline the entry list is fixed, oldest entry first.</li>
        <li>We take the hash of the first Monad testnet block after Oct 12, 9 AM IST.</li>
        <li className="font-mono text-[12.5px] text-[var(--ink)]">winner = entries[ BigInt(blockHash) % entries.length ]</li>
        <li>Everything below is public, so anyone can re-check it.</li>
      </ol>
      {draw?.drawn && draw.block ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          <dt className="text-[var(--muted)]">Block</dt>
          <dd className="m-0 font-mono"><a href={draw.block.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--ink)]">{draw.block.number.toLocaleString("en-US")} <ExternalLink size={12} /></a></dd>
          <dt className="text-[var(--muted)]">Block hash</dt>
          <dd className="m-0 font-mono break-all">{short(draw.block.hash)}</dd>
          <dt className="text-[var(--muted)]">Entries</dt>
          <dd className="m-0 font-mono">{draw.count}</dd>
          <dt className="text-[var(--muted)]">Index</dt>
          <dd className="m-0 font-mono">{draw.index} {draw.winner ? `(@${draw.winner})` : ""}</dd>
        </dl>
      ) : (
        <p className="m-0 text-[13px] font-semibold text-[var(--accent-text)]">The draw runs on Oct 12, 9 AM IST. The block number, hash and winner appear here.</p>
      )}
    </div>
  );
}
