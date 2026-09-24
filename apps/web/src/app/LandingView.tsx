"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import NumberFlow from "@number-flow/react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Car,
  Clock,
  Gavel,
  Lock,
  Receipt,
  RotateCcw,
  Scissors,
  Shirt,
  ShieldCheck,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { Logo } from "@/components/brand/Logo";
import { CHAIN_ID, GAS_SPONSORED } from "@/lib/config";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PatchData } from "@/components/surface/Patch";
import { DEFAULT_LAYOUTS } from "@/lib/market/layouts";
import type { SurfaceKind } from "@/lib/market/types";

export interface TickerItem {
  who: string;
  label: string;
  amount: string;
}

export interface LandingData {
  /** Newest live listing, shown in the hero. */
  featured: {
    href: string;
    title: string;
    surface: SurfaceKind;
    canvasImage: string | null;
    biddingEndsAt: number;
    patches: PatchData[];
  } | null;
  /** Live numbers from the indexer. */
  stats: { liveListings: number; escrowedUsd: number; bids: number };
  /** Recent bids, newest first. */
  ticker: TickerItem[];
  /** A live listing per surface, if any, for the surface cards. */
  surfaceLinks: Partial<Record<SurfaceKind, string>>;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Empty example spots for a surface (no brands or prices: this is an illustration, not data). */
const exampleSpots = (surface: SurfaceKind): PatchData[] =>
  DEFAULT_LAYOUTS[surface].slice(0, 4).map((s, i) => ({ id: i, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, r: s.r }));

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <Reveal className="max-w-2xl">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="text-4xl sm:text-5xl font-extrabold mt-2">{title}</h2>
      {sub && <p className="text-[var(--muted)] mt-3 text-base sm:text-lg">{sub}</p>}
    </Reveal>
  );
}

/** A small pastel patch used as decoration. */
function DecoPatch({ color, className, delay = 0, rotate = 0 }: { color: string; className?: string; delay?: number; rotate?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className={cn("absolute block rounded-xl border-2 border-[#0B0B0C] pointer-events-none", className)}
      style={{ background: `var(--${color})`, rotate }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { duration: 0.4, delay },
        scale: { type: "spring", stiffness: 260, damping: 14, delay },
        y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.6 },
      }}
    >
      <span className="absolute inset-[4px] rounded-lg border-[1.5px] border-dashed border-[#0B0B0C]/45" />
    </motion.span>
  );
}

/* ─────────────────────────────── Hero ─────────────────────────────── */

function HeroStage({ featured, ticker }: Pick<LandingData, "featured" | "ticker">) {
  const reduce = useReducedMotion();
  const [cd, setCd] = useState<string | null>(null);
  const [bidIdx, setBidIdx] = useState(0);

  useEffect(() => {
    if (!featured) return;
    const tick = () => setCd(formatCountdown(featured.biddingEndsAt).text);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [featured]);

  useEffect(() => {
    if (ticker.length < 2) return;
    const t = setInterval(() => setBidIdx((i) => (i + 1) % Math.min(ticker.length, 6)), 3200);
    return () => clearInterval(t);
  }, [ticker.length]);

  // Gentle 3D tilt that follows the pointer.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [7, -7]), { stiffness: 150, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [-5, 5]), { stiffness: 150, damping: 18 });
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const bid = ticker[bidIdx];
  const figure = featured ? (
    <SurfaceFigure surface={featured.surface} imageUrl={featured.canvasImage} patches={featured.patches} mode="static" showPrices={false} animateDrop />
  ) : (
    <SurfaceFigure surface="outfit" patches={exampleSpots("outfit")} mode="static" showPrices={false} animateDrop />
  );

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[380px] [perspective:1200px]"
      initial={{ opacity: 0, y: 40, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <DecoPatch color="p3" className="w-14 h-10 -top-5 -left-8 z-10" rotate={-14} delay={1.1} />
      <DecoPatch color="p2" className="w-12 h-12 top-1/3 -right-9 z-10" rotate={10} delay={1.25} />
      <DecoPatch color="p1" className="w-16 h-9 bottom-24 -left-10 z-10 hidden sm:block" rotate={6} delay={1.4} />

      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="card-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b-2 border-[var(--line)] bg-[var(--card)]">
          <span className="flex items-center gap-2 text-xs font-semibold min-w-0">
            {featured ? <span className="dot live" /> : <span className="dot" style={{ background: "var(--muted)" }} />}
            <span className="truncate">{featured ? featured.title : "Example layout"}</span>
          </span>
          {featured && cd && (
            <span className="flex items-center gap-1.5 font-mono text-xs font-semibold tabular-nums flex-none">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              {cd}
            </span>
          )}
        </div>
        <div className="bg-[var(--stage)]">
          {featured ? (
            <Link href={featured.href} aria-label={`Open ${featured.title}`} className="block">
              {figure}
            </Link>
          ) : (
            figure
          )}
        </div>
      </motion.div>

      {/* Latest real bids, cycling */}
      {bid && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[88%] z-20">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={bidIdx}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="flex items-center gap-2.5 rounded-xl border-2 border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs shadow-[3px_3px_0_var(--shadow)]"
            >
              <span className="w-7 h-7 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] grid place-items-center flex-none">
                <Zap className="w-3.5 h-3.5" />
              </span>
              <span className="min-w-0 truncate">
                <b>{bid.who}</b> bid <b className="font-mono">{bid.amount}</b> on {bid.label}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ value, label, currency }: { value: number; label: string; currency?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 600);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div>
      <NumberFlow
        value={shown}
        className="block font-display text-3xl sm:text-4xl font-extrabold leading-none tabular-nums"
        format={currency ? { style: "currency", currency: "USD", maximumFractionDigits: 0 } : undefined}
      />
      <span className="text-xs text-[var(--muted)] mt-1.5 block">{label}</span>
    </div>
  );
}

function Hero({ featured, ticker, stats }: Pick<LandingData, "featured" | "ticker" | "stats">) {
  const line = {
    hidden: { opacity: 0, y: "0.5em" },
    show: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.1 + i * 0.12, ease: EASE } }),
  };
  return (
    <section className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(var(--soft) 1.6px, transparent 1.6px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 60% 40%, #000 30%, transparent 75%)",
        }}
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-10 sm:pt-16 pb-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-8 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="inline-flex items-center gap-2 text-xs font-semibold border-[1.5px] border-[var(--line)] rounded-full px-3 py-1 bg-[var(--card)]"
            >
              <span className="w-2 h-2 rotate-45 rounded-[1.5px] bg-[var(--monad)]" />
              {CHAIN_ID === 143 ? "Live on Monad" : "On Monad testnet"} · USDC escrow
            </motion.span>

            <h1 className="text-[3.2rem] sm:text-7xl lg:text-[5.4rem] font-extrabold tracking-tight mt-6 leading-[0.95]">
              <motion.span className="block" variants={line} initial="hidden" animate="show" custom={0}>
                Your fit is
              </motion.span>
              <motion.span className="block mt-2" variants={line} initial="hidden" animate="show" custom={1}>
                <span className="relative inline-block px-3 sm:px-4 py-1">
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-2xl bg-[var(--accent)] border-[3px] border-[var(--line)] shadow-[5px_5px_0_var(--shadow)]"
                    initial={{ scale: 0.3, rotate: -14, opacity: 0 }}
                    animate={{ scale: 1, rotate: -2, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 240, damping: 13, delay: 0.45 }}
                  />
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-[7px] rounded-xl border-2 border-dashed border-[var(--on-accent)]/50 -rotate-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.95 }}
                  />
                  <span className="relative text-[var(--on-accent)]">ad space.</span>
                </span>
              </motion.span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="text-lg sm:text-xl text-[var(--muted)] max-w-md mt-8"
            >
              Put patches on your outfit, your car or your team hoodie. Brands bid in USDC for each spot, and escrow pays you when you show up.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62, ease: EASE }}
              className="flex items-center gap-3.5 flex-wrap mt-8"
            >
              <Link href="/studio" className="btn-base btn-primary group">
                Get patched
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/explore" className="btn-base">
                Browse live patches
              </Link>
            </motion.div>

            {stats.bids > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="flex items-start gap-8 sm:gap-10 mt-12 flex-wrap"
            >
              <Stat value={stats.liveListings} label="live listings" />
              <Stat value={stats.escrowedUsd} label="in top bids right now" currency />
              <Stat value={stats.bids} label="bids placed" />
            </motion.div>
            )}
          </div>

          <HeroStage featured={featured} ticker={ticker} />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Ticker ─────────────────────────────── */

function Ticker({ items }: { items: TickerItem[] }) {
  if (!items.length) return null;
  // Repeat short lists so one copy is always wider than the screen.
  const base = Array.from({ length: Math.max(1, Math.ceil(10 / items.length)) }, () => items).flat();
  return (
    <div
      className="group border-y-2 border-[var(--line)] bg-[var(--ink)] text-[var(--paper)] py-3 overflow-hidden select-none"
      style={{ maskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)" }}
    >
      <div className="flex w-max animate-[marquee_45s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-10 pr-10 font-mono text-sm" aria-hidden={copy === 1}>
            {base.map((t, i) => (
              <span key={i} className="inline-flex items-center gap-2.5 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent)]" />
                <span className="opacity-70">{t.who}</span>
                <span>{t.label}</span>
                <b className="text-[var(--accent)]">{t.amount}</b>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────── How it works ─────────────────────────────── */

const STEPS = [
  { icon: Camera, title: "Snap", body: "Take a selfie, or a photo of your car or team hoodie. AI turns it into a clean white canvas." },
  { icon: Scissors, title: "Patch", body: "Drop patches where logos go. Set a floor and a buy-now price for each one." },
  { icon: Wallet, title: "Get paid", body: "Brands outbid each other live. USDC waits in escrow and pays out when you show up." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-8 py-24 scroll-mt-20">
      <SectionHead eyebrow="How it works" title="Live in three steps." sub="No website to build, no payment processor to set up, no designer to hire." />
      <div className="relative grid md:grid-cols-3 gap-6 mt-12">
        {/* Stitch line connecting the steps */}
        <svg aria-hidden="true" className="hidden md:block absolute top-[38px] left-[16%] right-[16%] h-2 w-[68%] overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 2">
          <motion.line
            x1="0" y1="1" x2="100" y2="1"
            stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 2" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.2, ease: "easeInOut", delay: 0.2 }}
          />
        </svg>
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={0.15 * i}>
            <div className="relative text-center md:px-4">
              <motion.div
                whileHover={{ rotate: -6, scale: 1.06 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="relative mx-auto w-[76px] h-[76px] rounded-2xl border-2 border-[var(--line)] bg-[var(--card)] shadow-[4px_4px_0_var(--shadow)] grid place-items-center"
              >
                <s.icon className="w-8 h-8 text-[var(--accent-text)]" strokeWidth={2.2} />
                <span className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-[var(--ink)] text-[var(--paper)] font-mono text-xs font-bold grid place-items-center">
                  {i + 1}
                </span>
              </motion.div>
              <h3 className="text-2xl font-bold mt-6">{s.title}</h3>
              <p className="text-[var(--muted)] mt-2 max-w-xs mx-auto">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Surfaces ─────────────────────────────── */

const SURFACES: { kind: SurfaceKind; icon: typeof Shirt; name: string; pays: string; proof: string; figure: string; live: string }[] = [
  { kind: "outfit", icon: Shirt, name: "Outfit", pays: "Per event, like Token2049", proof: "Print photo and ticket, then venue photos", figure: "w-[132px]", live: "See a live outfit" },
  { kind: "car", icon: Car, name: "Car", pays: "Per week, for 1 to 8 weeks", proof: "A dated photo every week", figure: "w-full", live: "See a live car" },
  { kind: "hoodie", icon: Users, name: "Team hoodie", pays: "Per hackathon, split across the team", proof: "Team check-in, then stage or demo photos", figure: "w-[176px]", live: "See a live hoodie" },
];

function Surfaces({ surfaceLinks }: Pick<LandingData, "surfaceLinks">) {
  return (
    <section className="bg-[var(--soft)]/60 border-y-2 border-dashed border-[var(--soft)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-24">
        <SectionHead
          eyebrow="Three surfaces"
          title="Wear it, drive it, hack in it."
          sub="Each patch is its own live auction, so a brand bids on the exact spot it wants: the chest, the front door, the hood."
        />
        <div className="grid md:grid-cols-3 gap-6 mt-12">
          {SURFACES.map((s, i) => {
            const href = surfaceLinks[s.kind];
            return (
              <Reveal key={s.kind} delay={0.1 * i} className="h-full">
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="card-surface p-4 flex flex-col gap-5 h-full hover:shadow-[7px_7px_0_var(--shadow)] transition-shadow"
                >
                  <div className="bg-[var(--stage)] rounded-xl p-4 grid place-items-center h-[240px] overflow-hidden">
                    <div className={s.figure}>
                      <SurfaceFigure surface={s.kind} patches={exampleSpots(s.kind)} mode="static" showPrices={false} />
                    </div>
                  </div>
                  <div className="px-1">
                    <h3 className="text-2xl font-bold flex items-center gap-2">
                      <s.icon className="w-5 h-5 text-[var(--accent-text)]" />
                      {s.name}
                    </h3>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm mt-3">
                      <dt className="font-mono text-xs uppercase text-[var(--muted)] font-semibold pt-0.5">Pays</dt>
                      <dd>{s.pays}</dd>
                      <dt className="font-mono text-xs uppercase text-[var(--muted)] font-semibold pt-0.5">Proof</dt>
                      <dd>{s.proof}</dd>
                    </dl>
                  </div>
                  <Link href={href ?? "/studio"} className="btn-base btn-small mt-auto self-start group">
                    {href ? s.live : `List your ${s.name.toLowerCase()}`}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Escrow timeline ─────────────────────────────── */

const ESCROW = [
  { icon: Lock, big: null, title: "Bid locked", body: "The brand's USDC goes into the contract. Outbid? It goes straight back in the same transaction." },
  { icon: Camera, big: "40%", title: "Print proof", body: "The creator uploads the printed patches and a ticket. The first payout unlocks." },
  { icon: BadgeCheck, big: "60%", title: "Show-up proof", body: "Venue photos, or weekly photos for a car. The brand gets 72 hours to dispute." },
  { icon: Receipt, big: null, title: "Onchain receipt", body: "The brand keeps a receipt NFT for its patch. The creator earns reputation." },
];

function Escrow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-24">
      <SectionHead eyebrow="Escrow" title="Nobody has to trust anybody." sub="The money sits in a contract on Monad. It moves when the proof does." />
      <div ref={ref} className="relative mt-14">
        {/* Progress rail: horizontal on desktop, vertical on mobile */}
        <div aria-hidden="true" className="absolute hidden lg:block left-[12.5%] right-[12.5%] top-[27px] h-[3px] rounded-full bg-[var(--soft)]">
          <motion.div className="h-full rounded-full bg-[var(--accent)] origin-left" style={{ scaleX: fill }} />
        </div>
        <div aria-hidden="true" className="absolute lg:hidden left-[27px] top-4 bottom-4 w-[3px] rounded-full bg-[var(--soft)]">
          <motion.div className="w-full h-full rounded-full bg-[var(--accent)] origin-top" style={{ scaleY: fill }} />
        </div>

        <ol className="relative grid lg:grid-cols-4 gap-8 lg:gap-6">
          {ESCROW.map((e, i) => (
            <Reveal key={e.title} delay={0.1 * i}>
              <li className="flex lg:flex-col lg:items-center lg:text-center gap-5 lg:gap-0">
                <span className="relative z-10 flex-none w-14 h-14 rounded-2xl border-2 border-[var(--line)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)] grid place-items-center">
                  {e.big ? (
                    <span className="font-display font-extrabold text-lg text-[var(--accent-text)]">{e.big}</span>
                  ) : (
                    <e.icon className="w-6 h-6 text-[var(--accent-text)]" />
                  )}
                </span>
                <div className="lg:mt-5">
                  <h3 className="text-xl font-bold">{e.title}</h3>
                  <p className="text-sm text-[var(--muted)] mt-1.5 lg:max-w-[15rem] lg:mx-auto">{e.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.3}>
          <p className="text-xs text-[var(--muted)] mt-10 lg:text-center">
            40 / 60 is the default split for event listings. Creators can set their own milestones.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Two sides ─────────────────────────────── */

const SIDES = [
  {
    who: "For creators",
    title: "Your next event pays for the flight.",
    points: [
      { icon: Scissors, text: "Set a floor and a buy-now price for every patch" },
      { icon: Wallet, text: "Paid in USDC per milestone, 5% fee on payouts" },
      { icon: Zap, text: GAS_SPONSORED ? "Sign in with email. Gas is on us" : "Sign in with email or X, no wallet app needed" },
      { icon: Users, text: "Team hoodies split payouts automatically" },
    ],
    cta: { href: "/studio", label: "Start a listing" },
    tone: "accent",
  },
  {
    who: "For brands",
    title: "Bid on the exact spot you want.",
    points: [
      { icon: RotateCcw, text: "Outbid? Your USDC comes back instantly" },
      { icon: Gavel, text: "Buy now to skip the auction" },
      { icon: ShieldCheck, text: "72 hours to dispute a missed proof" },
      { icon: Receipt, text: "Win a receipt NFT you can resell" },
    ],
    cta: { href: "/explore", label: "Browse patches" },
    tone: "plain",
  },
] as const;

function TwoSides() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-24">
      <div className="grid md:grid-cols-2 gap-6">
        {SIDES.map((s, i) => (
          <Reveal key={s.who} delay={0.12 * i} className="h-full">
            <div className={cn("card-surface p-7 sm:p-8 h-full flex flex-col", s.tone === "accent" && "bg-[var(--accent-soft)]")}>
              <span className="eyebrow">{s.who}</span>
              <h3 className="text-3xl font-extrabold mt-2">{s.title}</h3>
              <ul className="mt-6 space-y-3">
                {s.points.map((p) => (
                  <li key={p.text} className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg border-[1.5px] border-[var(--line)] bg-[var(--card)] grid place-items-center flex-none">
                      <p.icon className="w-4 h-4 text-[var(--accent-text)]" />
                    </span>
                    {p.text}
                  </li>
                ))}
              </ul>
              <Link href={s.cta.href} className={cn("btn-base mt-8 self-start group", s.tone === "accent" && "btn-primary")}>
                {s.cta.label}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── Final CTA ─────────────────────────────── */

function FinalCta() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-16">
      <Reveal>
        <div className="relative overflow-hidden card-surface bg-[var(--accent)] text-[var(--on-accent)] px-6 py-16 sm:py-20 text-center">
          <DecoPatch color="p3" className="w-20 h-14 top-8 left-[8%]" rotate={-12} delay={0.2} />
          <DecoPatch color="p2" className="w-14 h-14 bottom-10 left-[16%] hidden sm:block" rotate={8} delay={0.35} />
          <DecoPatch color="p1" className="w-16 h-11 top-12 right-[10%]" rotate={14} delay={0.5} />
          <DecoPatch color="p5" className="w-12 h-16 bottom-8 right-[18%] hidden sm:block" rotate={-6} delay={0.65} />
          <div className="relative">
            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight">Stop posting for free.</h2>
            <p className="text-lg sm:text-xl mt-4 max-w-md mx-auto opacity-80">Set up your first listing in a few minutes. It costs nothing until a brand pays you.</p>
            <Link href="/studio" className="btn-base mt-8 group">
              Get patched
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="max-w-6xl mx-auto px-4 sm:px-8 py-8 border-t-2 border-dashed border-[var(--soft)] flex items-center justify-between gap-6 flex-wrap text-sm text-[var(--muted)]">
      <div className="flex items-center gap-4">
        <Logo size={28} />
        <span className="hidden sm:inline">Get patched. Get paid.</span>
      </div>
      <nav className="flex items-center gap-5">
        <Link href="/explore" className="hover:text-[var(--ink)] transition-colors">Explore</Link>
        <Link href="/studio" className="hover:text-[var(--ink)] transition-colors">Studio</Link>
        <Link href="/bids" className="hover:text-[var(--ink)] transition-colors">My bids</Link>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rotate-45 rounded-[1.5px] bg-[var(--monad)]" />
          Built on Monad
        </span>
      </nav>
    </footer>
  );
}

export function LandingView({ featured, stats, ticker, surfaceLinks }: LandingData) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-x-clip">
        <Hero featured={featured} ticker={ticker} stats={stats} />
        <Ticker items={ticker} />
        <HowItWorks />
        <Surfaces surfaceLinks={surfaceLinks} />
        <Escrow />
        <TwoSides />
        <FinalCta />
        <Footer />
      </div>
    </MotionConfig>
  );
}
