"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { useRole } from "@/lib/role";
import { FIXTURE_PROFILES, FIXTURE_LISTINGS } from "@/lib/data/fixtures";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { formatUsdc } from "@/lib/format";

interface CreatorPageProps {
  params: Promise<{
    handle: string;
  }>;
}

const COLOR_SWATCHES = [
  "#FF5A1F", // Patched Accent Orange
  "#836EF9", // Monad Purple
  "#16A34A", // Green
  "#F5B400", // Gold
  "#FF6FA4", // Pink
  "#2F9BFF", // Blue
];

export default function CreatorProfilePage({ params }: CreatorPageProps) {
  const resolvedParams = React.use(params);
  const cleanHandle = resolvedParams.handle.replace(/^@/, "");

  const { role } = useRole();
  const [bannerColor, setBannerColor] = useState(COLOR_SWATCHES[0]);

  // Lookup profile or fallback
  const profile =
    FIXTURE_PROFILES[cleanHandle] ||
    FIXTURE_PROFILES["mirabuilds"] || {
      handle: cleanHandle,
      displayName: cleanHandle,
      wallet: "0x0000000000000000000000000000000000000000",
      avatarInitial: cleanHandle[0]?.toUpperCase() || "C",
      deliveries: 4,
      totalDeliveries: 4,
      earnedUsdc: 8400n * 1000000n,
      badges: ["X verified", "Token2049 '25"],
      listings: FIXTURE_LISTINGS,
    };

  const isOwner = role === "creator";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Banner */}
      <div
        className="w-full h-36 sm:h-48 rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_var(--shadow)] flex items-center justify-center overflow-hidden transition-colors relative"
        style={{ backgroundColor: bannerColor }}
      >
        <span className="font-display font-black text-6xl sm:text-8xl tracking-tight text-[var(--paper)]/25 select-none uppercase">
          patched
        </span>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 px-4">
        <div className="flex items-end gap-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-3 border-[var(--line)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)] flex items-center justify-center font-display font-extrabold text-3xl sm:text-4xl text-[var(--ink)] flex-none">
            {profile.avatarInitial}
          </div>
          <div className="pb-1">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[var(--ink)] tracking-tight">
              {profile.displayName}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              patched.fun/<b>{profile.handle}</b> · builder, DevRel, conference-goer
            </p>
          </div>
        </div>

        {/* Action Button for Brands */}
        <div className="flex items-center gap-3">
          <Link href="/studio">
            <Button size="sm" variant="ghost">
              Create listing
            </Button>
          </Link>
          <a
            href={`https://x.com/${profile.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            <Button size="sm">
              Follow on X <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </Button>
          </a>
        </div>
      </div>

      {/* Badges Bar */}
      <div className="flex items-center gap-2 flex-wrap px-4">
        <Chip variant="green">
          <Check className="w-3 h-3" /> X verified
        </Chip>
        <Chip>4/4 deliveries</Chip>
        <Chip variant="orange">$8.4k earned</Chip>
        <Chip variant="monad">Token2049 ’25 badge</Chip>
      </div>

      {/* Profile Body Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Left: Active/Past Listings & Proof Feed */}
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-bold text-xl text-[var(--ink)] mb-4">
              Active and delivered auctions
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary Listing */}
              {FIXTURE_LISTINGS.slice(0, 1).map((listing) => (
                <Link
                  key={listing.id}
                  href={`/${profile.handle}/${listing.id}`}
                  className="group block bg-[var(--card)] rounded-2xl border-2 border-[var(--line)] shadow-[3px_3px_0_var(--shadow)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_var(--shadow)] transition-all p-4"
                >
                  <div className="bg-[var(--stage)] rounded-xl border border-[var(--line)] p-3 mb-3 flex items-center justify-center h-[180px] overflow-hidden">
                    <div className="h-[150px] w-auto">
                      <SurfaceFigure
                        surface={listing.surface}
                        patches={listing.patches}
                        mode="static"
                        showPrices={false}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold">{listing.eventName || listing.event || listing.title}</span>
                    <span className="text-[var(--accent)] font-semibold">Live</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-[var(--soft)]">
                    <span className="text-[var(--muted)]">4/7 with bids</span>
                    <span className="font-mono font-bold">
                      {formatUsdc(listing.totalEscrow)}
                    </span>
                  </div>
                </Link>
              ))}

              {/* Past Delivered Listing */}
              <div className="bg-[var(--card)] rounded-2xl border-2 border-[var(--line)] shadow-[3px_3px_0_var(--shadow)] p-4 flex flex-col justify-between opacity-95">
                <div>
                  <div className="bg-[var(--stage)] rounded-xl border border-[var(--line)] p-3 mb-3 flex items-center justify-center h-[180px] overflow-hidden">
                    <div className="h-[150px] w-auto">
                      <SurfaceFigure
                        surface="hoodie"
                        patches={[
                          { id: "1", name: "Chest", x: 36, y: 36, w: 28, h: 13, floor: 150n * 1000000n, buyNow: 500n * 1000000n, top: 500n * 1000000n, brand: "Nodeflux", color: "p2" },
                          { id: "2", name: "Pocket", x: 35, y: 70, w: 30, h: 13, floor: 90n * 1000000n, buyNow: 300n * 1000000n, top: 300n * 1000000n, brand: "Zeta Pay", color: "p3" },
                        ]}
                        mode="static"
                        showPrices={false}
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-semibold">ETHDenver 2026</span>
                    <Chip variant="green" className="text-[10px] py-0 px-2">
                      Delivered
                    </Chip>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs pt-2 border-t border-[var(--soft)] mt-2">
                  <span className="text-[var(--muted)]">5/5 delivered</span>
                  <span className="font-mono font-bold">$2,110 paid out</span>
                </div>
              </div>
            </div>
          </div>

          {/* Proof Post Card */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border-2 border-[var(--line)] bg-[var(--soft)] flex items-center justify-center font-display font-extrabold text-sm text-[var(--ink)]">
                {profile.avatarInitial}
              </div>
              <div>
                <div className="font-bold text-sm text-[var(--ink)]">
                  {profile.displayName}
                </div>
                <div className="text-xs text-[var(--muted)]">2 hours ago</div>
              </div>
              <Chip variant="green" className="ml-auto text-xs">
                Milestone 1 proof
              </Chip>
            </div>

            <p className="text-sm text-[var(--ink)] leading-relaxed">
              Printed. Fabric came out great, and the Nodeflux purple really pops on the
              front. 3 patches still open before the closing deadline on Thursday!
            </p>

            <div className="rounded-xl border-2 border-[var(--line)] bg-[var(--stage)] p-6 text-center text-xs text-[var(--muted)] font-mono">
              [ Verified Photo: Printed fabric dress on mannequin at maker lab · Location: Singapore ]
            </div>

            <div className="flex items-center gap-4 text-xs text-[var(--muted)] pt-2 border-t border-[var(--soft)]">
              <span className="inline-flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" /> 48 likes
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> 12 replies
              </span>
              <span className="ml-auto text-[var(--green)] font-semibold">
                Approved by escrow · 40% released
              </span>
            </div>
          </Card>
        </div>

        {/* Right: Customization Panel */}
        <aside className="space-y-4">
          {isOwner && (
            <Card className="p-5 space-y-4">
              <h3 className="font-display font-bold text-lg text-[var(--ink)]">
                Customize your page
              </h3>
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] block mb-2">
                  Banner color
                </span>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBannerColor(color)}
                      style={{ backgroundColor: color }}
                      aria-label={`Select banner color ${color}`}
                      className={`w-8 h-8 rounded-full border-2 border-[var(--line)] transition-transform hover:scale-110 ${
                        bannerColor === color ? "ring-2 ring-[var(--line)] scale-110 shadow-xs" : ""
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="font-hand text-lg text-[var(--accent-text)] -rotate-2">
                only you see this panel
              </p>
            </Card>
          )}

          <Card className="p-5 space-y-3">
            <h3 className="font-display font-bold text-base text-[var(--ink)]">
              Escrow stats
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Lifetime earned</span>
                <span className="font-mono font-bold">$8,400 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Dispute rate</span>
                <span className="font-mono font-bold text-[var(--green)]">0.0%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Monad testnet address</span>
                <span className="font-mono">{profile.wallet.slice(0, 6)}…{profile.wallet.slice(-4)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
