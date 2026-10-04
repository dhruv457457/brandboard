"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import NumberFlow from "@number-flow/react";
import { EASE, Reveal } from "@/components/ui/Reveal";
import { MonadLogo, MonadMark, PrivyLogo } from "@/components/brand/PartnerLogos";
import { PoweredBy } from "@/components/brand/PoweredBy";
import { StoryPanel } from "@/components/brand/StoryPanel";
import type { SceneKind, SceneLogo } from "@/components/brand/PatchScene";
import { MONAD_MARK_SVG, MONAD_WORDMARK_SVG, PRIVY_WORDMARK_SVG, svgUrl } from "@/components/brand/partnerSvg";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Clock,
  Lock,
  Receipt,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CHAIN_ID } from "@/lib/config";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TickerItem {
  who: string;
  label: string;
  amount: string;
}

export interface LandingData {
  /** The open auction ending soonest, for the hero's "live now" chip. */
  featured: { href: string; title: string; biddingEndsAt: number; topBidsUsd: number } | null;
  /** Live numbers from the indexer. */
  stats: { liveListings: number; escrowedUsd: number; bids: number };
  /** Recent bids, newest first. */
  ticker: TickerItem[];
  /** Logos real sponsors uploaded on Patched, shown on the hero's 3D patches next to Monad and Privy. */
  brandLogos: string[];
}

/** Links into the app (creating, browsing) go through sign-in first, then on to where they pointed. Creator pages stay public. */
const viaSignIn = (href: string) => `/welcome?next=${encodeURIComponent(href)}`;

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

// The 3D scene is its own chunk, loaded only here and only in the browser.
const PatchScene = dynamic(() => import("@/components/brand/PatchScene"), { ssr: false, loading: () => null });

const SCENES: { kind: SceneKind; label: string }[] = [
  { kind: "outfit", label: "Outfits" },
  { kind: "car", label: "Vehicles" },
  { kind: "hoodie", label: "Team hoodies" },
];
const SCENE_MS = 5200;

/**
 * The hero's right side: the 3D object (outfit, vehicle, team hoodie in turn) with patches landing on it, the
 * auction ending soonest, and the latest real bids. The object only animates while it's on screen.
 */
function HeroScene({ featured, ticker, brandLogos }: Pick<LandingData, "featured" | "ticker" | "brandLogos">) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box, { margin: "120px" });
  const [pageVisible, setPageVisible] = useState(true);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [cd, setCd] = useState<string | null>(null);
  const [bidIdx, setBidIdx] = useState(0);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!auto || reduce || !inView || !pageVisible) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, [auto, reduce, inView, pageVisible, idx]);

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

  const bid = ticker[bidIdx];
  const logos = useMemo<SceneLogo[]>(
    () => [...brandLogos.map((src) => ({ src })), { src: svgUrl(MONAD_WORDMARK_SVG), mark: svgUrl(MONAD_MARK_SVG) }, { src: svgUrl(PRIVY_WORDMARK_SVG) }],
    [brandLogos],
  );

  return (
    <motion.div
      ref={box}
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
    >
      <div className="relative h-[380px] sm:h-[480px] lg:h-[560px]">
        {/* A soft warm glow behind the object */}
        <div
          aria-hidden="true"
          className="absolute inset-[8%] rounded-full blur-3xl opacity-80"
          style={{ background: "radial-gradient(closest-side, var(--accent-soft), transparent)" }}
        />
        <div className="absolute inset-0">
          <PatchScene kind={SCENES[idx].kind} logos={logos} reduced={!!reduce} active={inView && pageVisible} />
        </div>

        {featured && (
          // A creator's listing is a public page: open it directly.
          <Link
            href={featured.href}
            className="absolute top-2 left-2 sm:left-4 z-10 max-w-[calc(100%-16px)] inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--soft)] bg-[var(--card)]/90 backdrop-blur-md pl-2.5 pr-3 py-1.5 text-xs font-semibold no-underline text-[var(--ink)] shadow-[0_8px_24px_rgba(11,11,12,0.10)] hover:border-[var(--line)]"
          >
            <span className="dot live flex-none" />
            <span className="truncate">Live now: {featured.title}</span>
            {featured.topBidsUsd > 0 && <span className="font-mono flex-none">${featured.topBidsUsd.toLocaleString("en-US")}</span>}
            {cd && (
              <span className="flex items-center gap-1 font-mono tabular-nums text-[var(--accent-text)] flex-none">
                <Clock className="w-3.5 h-3.5" />
                {cd}
              </span>
            )}
          </Link>
        )}

        {bid && (
          <div className="absolute bottom-3 right-2 sm:right-4 z-10 w-[min(300px,80%)]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={bidIdx}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="flex items-center gap-2.5 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)]/90 backdrop-blur-md px-3 py-2 text-xs shadow-[0_10px_28px_rgba(11,11,12,0.14)]"
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
      </div>

      {/* Which surface is on screen; tap one to hold it */}
      <div className="flex justify-center mt-2" role="tablist" aria-label="Shown in 3D">
        <div className="inline-flex p-1 rounded-full bg-[var(--soft)]">
          {SCENES.map((sc, i) => {
            const on = i === idx;
            return (
              <button
                key={sc.kind}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setIdx(i);
                  setAuto(false);
                }}
                className={cn("relative h-9 px-4 rounded-full text-sm font-bold transition-colors", on ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]")}
              >
                {on && (
                  <motion.span layoutId="scene-tab" className="absolute inset-0 rounded-full bg-[var(--card)] shadow-[0_2px_8px_rgba(11,11,12,0.12)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{sc.label}</span>
                {on && auto && !reduce && (
                  <span key={idx} aria-hidden="true" className="absolute left-4 right-4 bottom-1 h-[2px] rounded-full bg-[var(--accent)] origin-left [animation:story-fill_5.2s_linear_forwards]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
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

function Hero({ featured, ticker, stats, brandLogos }: Pick<LandingData, "featured" | "ticker" | "stats" | "brandLogos">) {
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
        <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-6 items-center">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="inline-flex items-center gap-2 text-xs font-semibold border-[1.5px] border-[var(--line)] rounded-full px-3 py-1 bg-[var(--card)]"
            >
              <MonadMark size={14} className="flex-none" />
              {CHAIN_ID === 143 ? "Live on Monad" : "On Monad testnet"} · Paid in stablecoins
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
              Put patches on your outfit, your car or your team hoodie. Brands bid in stablecoins (USDC) for each spot, and the money is held safely until you show up.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62, ease: EASE }}
              className="flex items-center gap-3.5 flex-wrap mt-8"
            >
              <Link href={viaSignIn("/studio")} className="btn-base btn-primary group">
                Get patched
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href={viaSignIn("/explore")} className="btn-base">
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

          <HeroScene featured={featured} ticker={ticker} brandLogos={brandLogos} />
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

/* ─────────────────────────────── How it works: the story ─────────────────────────────── */

/** The same animated story as the sign-in page: five short chapters, outfits, vehicles and hoodies in one pass. */
function StoryBand() {
  return (
    <section id="how-it-works" className="px-4 sm:px-8 py-20 sm:py-24 scroll-mt-16">
      <div className="max-w-6xl mx-auto rounded-[36px] bg-[#FF5A1F] text-[#0B0B0C] px-6 sm:px-12 py-12 sm:py-16 grid gap-10 lg:grid-cols-[0.85fr_1.15fr] items-center overflow-hidden">
        <Reveal>
          <span className="font-mono text-xs font-semibold tracking-[0.12em]">HOW IT WORKS</span>
          <h2 className="font-display font-extrabold text-[clamp(40px,5.2vw,68px)] leading-[0.94] tracking-[-0.045em] mt-3">
            Snap it.
            <br />
            Patch it.
            <br />
            Get paid.
          </h2>
          <p className="text-lg mt-6 max-w-sm">
            From a photo to USDC in your wallet. Outfits, vehicles and team hoodies all work the same way, and Privy makes
            the wallet when you sign in.
          </p>
          <Link
            href={viaSignIn("/studio")}
            className="mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-[#0B0B0C] text-white font-bold no-underline hover:opacity-90 group"
          >
            Start a listing
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <Reveal delay={0.12}>
          <StoryPanel className="w-full" />
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────────── Escrow timeline ─────────────────────────────── */

const ESCROW = [
  { icon: Lock, big: null, title: "Bid locked", body: "The brand's USDC goes into the contract. Outbid? It goes straight back in the same transaction." },
  { icon: Camera, big: "40%", title: "Print proof", body: "The creator uploads the printed patches and a ticket. The first payout unlocks." },
  { icon: BadgeCheck, big: "60%", title: "Show-up proof", body: "Venue photos, or weekly photos for a car. The brand gets 72 hours to dispute." },
  { icon: Receipt, big: null, title: "A living NFT", body: "The brand holds a patch NFT that changes as the creator delivers: printed, seen, delivered. Miss a deadline and it is unpicked." },
];

function Escrow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 55%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 py-24">
      <SectionHead eyebrow="Your money" title="Nobody has to trust anybody." sub="Brands pay in USDC, a stablecoin worth one dollar. It waits in a contract on Monad and moves only when the proof does." />
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
                <span className="relative z-10 flex-none w-14 h-14 rounded-2xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] shadow-[0_10px_28px_rgba(11,11,12,0.10)] grid place-items-center">
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

/* ─────────────────────────────── Final CTA ─────────────────────────────── */

function FinalCta() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-[36px] bg-[#0B0B0C] text-white px-6 py-16 sm:py-24 text-center">
          <DecoPatch color="p3" className="w-20 h-14 top-8 left-[8%]" rotate={-12} delay={0.2} />
          <DecoPatch color="p2" className="w-14 h-14 bottom-10 left-[16%] hidden sm:block" rotate={8} delay={0.35} />
          <DecoPatch color="p1" className="w-16 h-11 top-12 right-[10%]" rotate={14} delay={0.5} />
          <DecoPatch color="p5" className="w-12 h-16 bottom-8 right-[18%] hidden sm:block" rotate={-6} delay={0.65} />
          <div className="relative">
            <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight">Stop posting for free.</h2>
            <p className="text-lg sm:text-xl mt-4 max-w-md mx-auto opacity-80">Set up your first listing in a few minutes. It costs nothing until a brand pays you.</p>
            <Link href={viaSignIn("/studio")} className="btn-base btn-primary mt-8 group">
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
      <span className="flex items-center gap-2">
        Built on <MonadLogo height={15} /> with <PrivyLogo height={15} />
      </span>
    </footer>
  );
}

export function LandingView({ featured, stats, ticker, brandLogos }: LandingData) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-x-clip">
        <Hero featured={featured} ticker={ticker} stats={stats} brandLogos={brandLogos} />
        <Ticker items={ticker} />
        <StoryBand />
        <Escrow />
        <section className="max-w-6xl mx-auto px-4 sm:px-8 pb-20">
          <Reveal className="grid gap-6 justify-items-center">
            <span className="eyebrow">Built with</span>
            <PoweredBy height={30} />
          </Reveal>
        </section>
        <FinalCta />
        <Footer />
      </div>
    </MotionConfig>
  );
}
