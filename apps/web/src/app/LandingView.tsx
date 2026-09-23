"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bolt,
  Check,
  Clock,
  Layers,
  Lock,
  Receipt,
  Shirt,
  Car as CarIcon,
} from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { formatCountdown } from "@/lib/format";
import type { PatchData } from "@/components/surface/Patch";
import { DEFAULT_LAYOUTS } from "@/lib/market/layouts";
import type { SurfaceKind } from "@/lib/market/types";
import { Logo } from "@/components/brand/Logo";

export interface LandingData {
  /** Newest live listing, shown in the hero. */
  featured: {
    href: string;
    surface: SurfaceKind;
    canvasImage: string | null;
    biddingEndsAt: number;
    patches: PatchData[];
  } | null;
  /** Latest real bid, for the floating badge. */
  latestBid: { who: string; label: string; amount: string } | null;
  /** Recent bids for the ticker, already formatted. */
  ticker: string[];
  /** A live listing per surface, if any, for the surface cards. */
  surfaceLinks: Partial<Record<SurfaceKind, string>>;
}

/** Empty example spots for a surface (no brands or prices: this is an illustration, not data). */
const exampleSpots = (surface: SurfaceKind): PatchData[] =>
  DEFAULT_LAYOUTS[surface].slice(0, 4).map((s, i) => ({ id: i, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, r: s.r }));

export function LandingView({ featured, latestBid, ticker, surfaceLinks }: LandingData) {
  const [heroCd, setHeroCd] = useState<string | null>(null);

  useEffect(() => {
    if (!featured) return;
    const tick = () => setHeroCd(formatCountdown(featured.biddingEndsAt).text);
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [featured]);


  return (
    <div className="overflow-x-hidden">
      {/* HERO SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 pt-8 pb-12">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
          <div>
            <Chip variant="monad">Live on Monad · USDC escrow</Chip>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mt-5 leading-[0.98]">
              Your fit is{" "}
              <span className="relative whitespace-nowrap text-[var(--accent-text)]">
                ad space.
                <svg
                  viewBox="0 0 300 20"
                  preserveAspectRatio="none"
                  className="absolute left-0 right-0 -bottom-2 w-full h-4 text-[var(--accent)] pointer-events-none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 12 Q 75 2 150 10 T 298 8"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray="10 7"
                  />
                </svg>
              </span>
            </h1>

            <span className="font-hand text-2xl sm:text-3xl text-[var(--muted)] -rotate-3 inline-block ml-2 mt-2">
              yes, literally
            </span>

            <p className="text-lg sm:text-xl text-[var(--muted)] max-w-lg mt-5 mb-8">
              Put patches on your outfit, your car or your team hoodie. Brands bid in USDC. Escrow pays you when you show up.
            </p>

            <div className="flex items-center gap-3.5 flex-wrap">
              <Link href="/studio">
                <Button variant="primary" className="gap-2">
                  Get patched
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/explore">
                <Button>Browse live patches</Button>
              </Link>
            </div>

            <div className="flex items-center gap-8 mt-9 pt-2 flex-wrap">
              <div>
                <b className="block font-display text-3xl font-extrabold leading-none">$0</b>
                <span className="text-xs text-[var(--muted)] mt-1 block">to set up your page</span>
              </div>
              <div>
                <b className="block font-display text-3xl font-extrabold leading-none">0 gas</b>
                <span className="text-xs text-[var(--muted)] mt-1 block">we sponsor every tx</span>
              </div>
              <div>
                <b className="block font-display text-3xl font-extrabold leading-none">5%</b>
                <span className="text-xs text-[var(--muted)] mt-1 block">fee, not $300</span>
              </div>
            </div>
          </div>

          {/* Hero Stage with Model and Floating Badges */}
          <div className="relative max-w-[380px] mx-auto w-full py-4">
            {/* Dashed backdrop oval */}
            <div
              className="absolute left-[6%] right-[6%] top-[4%] bottom-0 rounded-t-full rounded-b-3xl bg-[var(--accent-soft)] border-2 border-dashed pointer-events-none -z-10"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
              }}
            />

            <div className="w-full">
              {featured ? (
                <Link href={featured.href} aria-label="Open this live listing">
                  <SurfaceFigure
                    surface={featured.surface}
                    imageUrl={featured.canvasImage}
                    patches={featured.patches}
                    mode="static"
                    showPrices={false}
                    animateDrop
                  />
                </Link>
              ) : (
                <SurfaceFigure surface="outfit" patches={exampleSpots("outfit")} mode="static" showPrices={false} animateDrop />
              )}
            </div>

            {/* Floating badges show real activity only */}
            {latestBid && (
              <div className="absolute top-[12%] -left-[6%] bg-[var(--card)] border-2 border-[var(--line)] rounded-xl px-3 py-1.5 text-xs shadow-[3px_3px_0_var(--shadow)] flex items-center gap-2 select-none">
                <span className="w-6 h-6 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center">
                  <Bolt className="w-3.5 h-3.5" />
                </span>
                <span>
                  {latestBid.who} bid <b className="font-mono">{latestBid.amount}</b> on {latestBid.label}
                </span>
              </div>
            )}

            {featured && heroCd && (
              <div className="absolute bottom-[6%] left-0 bg-[var(--card)] border-2 border-[var(--line)] rounded-xl px-3 py-1.5 text-xs shadow-[3px_3px_0_var(--shadow)] flex items-center gap-2 select-none">
                <span className="w-6 h-6 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <b className="font-mono text-sm">{heroCd}</b>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* TICKER MARQUEE: the latest real bids */}
      {ticker.length > 0 && (
      <div className="border-y-2 border-[var(--line)] bg-[var(--ink)] text-[var(--paper)] py-3 overflow-hidden select-none">
        <div className="flex gap-10 whitespace-nowrap animate-[marquee_40s_linear_infinite] font-mono text-sm">
          {[...ticker, ...ticker].map((item, idx) => (
            <span key={idx} className="inline-flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 border border-dashed border-[var(--accent)] rounded-xs" />
              {item}
            </span>
          ))}
        </div>
      </div>
      )}

      {/* THREE SURFACES SHOWCASE */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            Three surfaces
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mt-1">
            Wear it, drive it, hack in it.
          </h2>
          <p className="text-[var(--muted)] max-w-2xl mt-2 text-base sm:text-lg">
            Each surface is its own listing, and each patch on it is its own live auction. Brands bid on the exact spot they want, like the front door or the neckline.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Surface 1: Outfit */}
          <Card className="p-4 flex flex-col gap-4">
            <div className="bg-[var(--stage)] rounded-xl p-4 grid place-items-center min-h-[220px]">
              <div className="w-[140px]">
                <SurfaceFigure surface="outfit" patches={exampleSpots("outfit")} mode="static" showPrices={false} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Shirt className="w-5 h-5 text-[var(--accent)]" />
                Outfit
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-2">
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Pays</dt>
                <dd>Per event (e.g. Token2049)</dd>
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Proof</dt>
                <dd>Print photo + ticket, then venue photos</dd>
              </dl>
            </div>
            <Link href={surfaceLinks.outfit ?? "/explore"} className="mt-auto">
              <Button size="small" className="gap-1.5">
                See a live outfit
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </Card>

          {/* Surface 2: Car */}
          <Card className="p-4 flex flex-col gap-4">
            <div className="bg-[var(--stage)] rounded-xl p-4 grid place-items-center min-h-[220px]">
              <div className="w-full">
                <SurfaceFigure surface="car" patches={exampleSpots("car")} mode="static" showPrices={false} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <CarIcon className="w-5 h-5 text-[var(--accent)]" />
                Car
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-2">
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Pays</dt>
                <dd>Per week (1 to 8 weeks)</dd>
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Proof</dt>
                <dd>Dated photo every week + location check-ins</dd>
              </dl>
            </div>
            <Link href={surfaceLinks.car ?? "/explore"} className="mt-auto">
              <Button size="small" className="gap-1.5">
                See a live car
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </Card>

          {/* Surface 3: Team Hoodie */}
          <Card className="p-4 flex flex-col gap-4">
            <div className="bg-[var(--stage)] rounded-xl p-4 grid place-items-center min-h-[220px]">
              <div className="w-[180px]">
                <SurfaceFigure surface="hoodie" patches={exampleSpots("hoodie")} mode="static" showPrices={false} />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--accent)]" />
                Team hoodie
              </h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs mt-2">
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Pays</dt>
                <dd>Per hackathon, split across the team</dd>
                <dt className="font-mono uppercase text-[var(--muted)] font-semibold">Proof</dt>
                <dd>Team check-in + stage or demo photos</dd>
              </dl>
            </div>
            <Link href={surfaceLinks.hoodie ?? "/explore"} className="mt-auto">
              <Button size="small" className="gap-1.5">
                See a live hoodie
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-4 sm:px-8 py-16 space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            How it works
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mt-1">
            Three steps. No Razorpay, no website, no tailor wait.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6">
            <div className="font-display font-extrabold text-6xl text-[var(--accent)] leading-none -webkit-text-stroke-2">
              1
            </div>
            <h3 className="text-2xl font-bold mt-3 mb-1">Upload</h3>
            <p className="text-sm text-[var(--muted)]">
              Snap yourself, your car or your team hoodie. AI turns it into a clean white canvas.
            </p>
          </Card>

          <Card className="p-6">
            <div className="font-display font-extrabold text-6xl text-[var(--accent)] leading-none">
              2
            </div>
            <h3 className="text-2xl font-bold mt-3 mb-1">Patch</h3>
            <p className="text-sm text-[var(--muted)]">
              Drag patches where logos go. Set a floor price and a buy-now price for each one.
            </p>
          </Card>

          <Card className="p-6">
            <div className="font-display font-extrabold text-6xl text-[var(--accent)] leading-none">
              3
            </div>
            <h3 className="text-2xl font-bold mt-3 mb-1">Get paid</h3>
            <p className="text-sm text-[var(--muted)]">
              Brands outbid each other live. USDC sits in escrow and releases when you show up.
            </p>
          </Card>
        </div>
      </section>

      {/* ESCROW EXPLAINER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            Escrow, explained
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mt-1">
            Nobody has to trust anybody.
          </h2>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x-2 divide-dashed divide-[var(--line)]">
            <div className="p-6">
              <div className="h-11 flex items-center text-[var(--accent-text)] font-extrabold text-3xl font-display">
                <Lock className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-bold mt-2 mb-1">Bid locked</h3>
              <p className="text-xs text-[var(--muted)]">
                The brand&apos;s USDC goes into the contract. If they&apos;re outbid, it comes back right away.
              </p>
            </div>

            <div className="p-6">
              <div className="h-11 flex items-center text-[var(--accent-text)] font-extrabold text-4xl font-display">
                40%
              </div>
              <h3 className="text-lg font-bold mt-2 mb-1">Print proof</h3>
              <p className="text-xs text-[var(--muted)]">
                The creator uploads the printed patches plus a ticket, and the first milestone unlocks.
              </p>
            </div>

            <div className="p-6">
              <div className="h-11 flex items-center text-[var(--accent-text)] font-extrabold text-4xl font-display">
                60%
              </div>
              <h3 className="text-lg font-bold mt-2 mb-1">Show-up proof</h3>
              <p className="text-xs text-[var(--muted)]">
                Venue photos, or weekly photos for cars. The brand has 72 hours to dispute.
              </p>
            </div>

            <div className="p-6">
              <div className="h-11 flex items-center text-[var(--accent-text)] font-extrabold text-3xl font-display">
                <Receipt className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-bold mt-2 mb-1">Onchain receipt</h3>
              <p className="text-xs text-[var(--muted)]">
                The brand gets an NFT receipt for its patch. The creator earns reputation.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* COMPARISON TABLE */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 space-y-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
            Why not DIY
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mt-1">
            Doing it yourself costs a lot more.
          </h2>
        </div>

        <Card className="p-0 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm min-w-[540px]">
            <thead>
              <tr className="border-b-2 border-[var(--line)] bg-[var(--soft)]/50">
                <th className="p-4 font-mono text-xs uppercase text-[var(--muted)] font-semibold"></th>
                <th className="p-4 font-mono text-xs uppercase text-[var(--muted)] font-semibold">
                  Doing it yourself
                </th>
                <th className="p-4 font-mono text-xs uppercase text-[var(--accent-text)] font-bold">
                  Patched
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--soft)]">
              <tr>
                <td className="p-4 font-semibold">Pricing</td>
                <td className="p-4 text-[var(--muted)]">Fixed. Brands can&apos;t pay more.</td>
                <td className="p-4 font-bold text-[var(--ink)]">Live bids on every patch</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Payments</td>
                <td className="p-4 text-[var(--muted)]">Razorpay/Stripe, ~$200–300 in fees</td>
                <td className="p-4 font-bold text-[var(--ink)]">USDC · 5% flat · gas sponsored</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Your page</td>
                <td className="p-4 text-[var(--muted)]">Build a site from scratch</td>
                <td className="p-4 font-bold text-[var(--ink)]">patched.fun/you in 2 minutes</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Mockup</td>
                <td className="p-4 text-[var(--muted)]">Hire a designer, wait</td>
                <td className="p-4 font-bold text-[var(--ink)]">AI white canvas + patch editor</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold">Trust</td>
                <td className="p-4 text-[var(--muted)]">&ldquo;Pay me and trust me&rdquo;</td>
                <td className="p-4 font-bold text-[var(--ink)]">Escrow + proof + dispute window</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      {/* FINAL CALL TO ACTION CARD */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
        <div className="card-surface p-12 text-center bg-[var(--accent)] text-[var(--on-accent)] space-y-4">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            Stop posting for free.
          </h2>
          <p className="text-lg opacity-90 max-w-lg mx-auto">
            Your next event could pay for your flight, and more.
          </p>
          <div className="pt-2">
            <Link href="/studio">
              <Button size="default" className="text-[var(--ink)] bg-[var(--card)] hover:bg-[var(--soft)]">
                Get patched
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-8 py-8 border-t-2 border-dashed border-[var(--soft)] flex items-center justify-between gap-4 flex-wrap text-xs text-[var(--muted)]">
        <Logo size={28} />
        <span>Get patched. Get paid. · Built on Monad</span>
      </footer>
    </div>
  );
}
