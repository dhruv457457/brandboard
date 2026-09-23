"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Car, Shirt } from "lucide-react";
import { FIXTURE_LISTINGS, SurfaceType } from "@/lib/data";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { PatchData } from "@/components/surface/Patch";
import { Seg } from "@/components/ui/Seg";
import { formatUsdc, formatCountdown } from "@/lib/format";

type FilterSurface = "all" | SurfaceType;

interface ExtraCard {
  id: string;
  creatorHandle: string;
  creatorName: string;
  title: string;
  surface: SurfaceType;
  claimed: string;
  top: string;
  ends: string;
  patches: PatchData[];
}

const EXTRA_CARDS: ExtraCard[] = [
  {
    id: "mira-devcon",
    creatorHandle: "mirabuilds",
    creatorName: "Lena",
    title: "Lena · Devcon dress",
    surface: "outfit",
    claimed: "2/7",
    top: "$640",
    ends: "6d left",
    patches: [
      { id: "1", name: "Neckline", x: 38, y: 24.5, w: 24, h: 7, floor: 150n * 1000000n, buyNow: 600n * 1000000n, top: 420n * 1000000n, brand: "Nodeflux", color: "p2" },
      { id: "2", name: "Waist", x: 39, y: 37.6, w: 22, h: 4.6, floor: 120n * 1000000n, buyNow: 450n * 1000000n, top: 220n * 1000000n, brand: "Zeta Pay", color: "p3" },
      { id: "3", name: "Left hip", x: 36, y: 44, w: 13, h: 8, floor: 60n * 1000000n, buyNow: 300n * 1000000n, top: 0n },
      { id: "4", name: "Right hip", x: 51, y: 44, w: 13, h: 8, floor: 60n * 1000000n, buyNow: 300n * 1000000n, top: 0n },
      { id: "5", name: "Hem center", x: 40, y: 57, w: 20, h: 11, floor: 200n * 1000000n, buyNow: 540n * 1000000n, top: 0n },
    ],
  },
  {
    id: "samir-pune",
    creatorHandle: "samir.eth",
    creatorName: "Dev",
    title: "Dev · Pune weekend drive",
    surface: "car",
    claimed: "1/5",
    top: "$180",
    ends: "1d left",
    patches: [
      { id: "1", name: "Front door", x: 34, y: 53, w: 19, h: 19, floor: 250n * 1000000n, buyNow: 900n * 1000000n, top: 180n * 1000000n, brand: "Hexa", color: "p5" },
      { id: "2", name: "Rear door", x: 55.5, y: 53, w: 11.5, h: 19, floor: 150n * 1000000n, buyNow: 500n * 1000000n, top: 0n },
      { id: "3", name: "Rear quarter", x: 71, y: 52.5, w: 18, h: 6, floor: 80n * 1000000n, buyNow: 260n * 1000000n, top: 0n },
    ],
  },
  {
    id: "rekt-ethindia",
    creatorHandle: "rektangle",
    creatorName: "Buildoors",
    title: "Buildoors · ETHIndia",
    surface: "hoodie",
    claimed: "3/5",
    top: "$520",
    ends: "4d left",
    patches: [
      { id: "1", name: "Chest", x: 36, y: 36, w: 28, h: 13, floor: 150n * 1000000n, buyNow: 500n * 1000000n, top: 310n * 1000000n, brand: "Kappa Labs", color: "p1" },
      { id: "2", name: "Right sleeve", x: 80, y: 44, w: 11, h: 12, floor: 50n * 1000000n, buyNow: 180n * 1000000n, top: 70n * 1000000n, brand: "Orbit", color: "p4" },
      { id: "3", name: "Pocket", x: 35, y: 70, w: 30, h: 13, floor: 90n * 1000000n, buyNow: 300n * 1000000n, top: 140n * 1000000n, brand: "Zeta Pay", color: "p3" },
      { id: "4", name: "Waistband", x: 30, y: 87.6, w: 40, h: 5, floor: 40n * 1000000n, buyNow: 150n * 1000000n, top: 0n },
    ],
  },
];

export default function ExplorePage() {
  const [filter, setFilter] = useState<FilterSurface>("all");

  const surfaceOptions: { value: FilterSurface; label: string }[] = [
    { value: "all", label: "All" },
    { value: "outfit", label: "Outfits" },
    { value: "car", label: "Cars" },
    { value: "hoodie", label: "Team hoodies" },
  ];

  // Base listings
  const filteredListings = FIXTURE_LISTINGS.filter(
    (l) => filter === "all" || l.surface === filter
  );

  // Extra listings
  const filteredExtra = EXTRA_CARDS.filter(
    (e) => filter === "all" || e.surface === filter
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Explore live auctions
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl tracking-tight text-[var(--ink)] mt-1">
            Live patches
          </h1>
        </div>

        <Seg
          options={surfaceOptions}
          value={filter}
          onChange={(val) => setFilter(val as FilterSurface)}
        />
      </div>

      {/* Grid of Listings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Main interactive listings */}
        {filteredListings.map((listing) => {
          const claimedCount = listing.patches.filter((p) => p.topBid > 0n || !!p.brand).length;
          const totalCount = listing.patches.length;
          const pct = Math.round((claimedCount / (totalCount || 1)) * 100);

          const surfaceIcon =
            listing.surface === "outfit" ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : listing.surface === "car" ? (
              <Car className="w-3.5 h-3.5" />
            ) : (
              <Shirt className="w-3.5 h-3.5" />
            );

          const surfaceLabel =
            listing.surface === "outfit"
              ? "Outfit"
              : listing.surface === "car"
              ? "Car"
              : "Team hoodie";

          return (
            <Link
              key={listing.id}
              href={`/${listing.creatorHandle}/${listing.id}`}
              className="group block bg-[var(--card)] rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_var(--shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--shadow)] transition-all p-5 flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--accent)]"
            >
              <div>
                {/* Visual figure shot */}
                <div className="bg-[var(--stage)] rounded-xl border border-[var(--line)] p-4 mb-4 flex items-center justify-center min-h-[220px] max-h-[260px] overflow-hidden">
                  <div
                    className={
                      listing.surface === "car"
                        ? "w-full max-w-[260px]"
                        : "h-[200px] w-auto"
                    }
                  >
                    <SurfaceFigure
                      surface={listing.surface}
                      patches={listing.patches}
                      mode="static"
                      showPrices={false}
                    />
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[var(--line)] bg-[var(--paper)]">
                    {surfaceIcon}
                    {surfaceLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    {formatCountdown(listing.endTime || listing.biddingEndsAt).text}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-display font-bold text-lg text-[var(--ink)] tracking-tight group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                  {listing.creatorName} · {listing.eventName || listing.event || listing.title}
                </h3>

                {/* Progress bar */}
                <div className="w-full bg-[var(--soft)] h-2 rounded-full border border-[var(--line)] overflow-hidden my-3">
                  <div
                    className="bg-[var(--accent)] h-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Bottom stats row */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--soft)] mt-2">
                <span className="text-[var(--muted)]">
                  {claimedCount}/{totalCount} patches with bids
                </span>
                <span className="font-mono font-bold text-sm text-[var(--ink)]">
                  {formatUsdc(listing.totalEscrow)}
                </span>
              </div>
            </Link>
          );
        })}

        {/* Extra mock cards */}
        {filteredExtra.map((extra) => {
          const [a, b] = extra.claimed.split("/").map(Number);
          const pct = Math.round((a / (b || 1)) * 100);

          const surfaceIcon =
            extra.surface === "outfit" ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : extra.surface === "car" ? (
              <Car className="w-3.5 h-3.5" />
            ) : (
              <Shirt className="w-3.5 h-3.5" />
            );

          const surfaceLabel =
            extra.surface === "outfit"
              ? "Outfit"
              : extra.surface === "car"
              ? "Car"
              : "Team hoodie";

          return (
            <Link
              key={extra.id}
              href={`/${extra.creatorHandle}`}
              className="group block bg-[var(--card)] rounded-2xl border-2 border-[var(--line)] shadow-[4px_4px_0_var(--shadow)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_var(--shadow)] transition-all p-5 flex flex-col justify-between focus-visible:outline-3 focus-visible:outline-[var(--accent)]"
            >
              <div>
                {/* Visual figure shot */}
                <div className="bg-[var(--stage)] rounded-xl border border-[var(--line)] p-4 mb-4 flex items-center justify-center min-h-[220px] max-h-[260px] overflow-hidden">
                  <div
                    className={
                      extra.surface === "car"
                        ? "w-full max-w-[260px]"
                        : "h-[200px] w-auto"
                    }
                  >
                    <SurfaceFigure
                      surface={extra.surface}
                      patches={extra.patches}
                      mode="static"
                      showPrices={false}
                    />
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[var(--line)] bg-[var(--paper)]">
                    {surfaceIcon}
                    {surfaceLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                    {extra.ends}
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-display font-bold text-lg text-[var(--ink)] tracking-tight group-hover:text-[var(--accent)] transition-colors line-clamp-1">
                  {extra.title}
                </h3>

                {/* Progress bar */}
                <div className="w-full bg-[var(--soft)] h-2 rounded-full border border-[var(--line)] overflow-hidden my-3">
                  <div
                    className="bg-[var(--accent)] h-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Bottom stats row */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--soft)] mt-2">
                <span className="text-[var(--muted)]">
                  {extra.claimed} patches with bids
                </span>
                <span className="font-mono font-bold text-sm text-[var(--ink)]">
                  {extra.top}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
