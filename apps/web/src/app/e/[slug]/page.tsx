"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Layers,
  Lock,
  MapPin,
  Sparkles,
} from "lucide-react";
import { getEvents, getListings } from "@/lib/data";
import { EventRecord, ListingRecord } from "@/lib/data/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Pill } from "@/components/ui/Pill";
import { formatCountdown, formatUsdc } from "@/lib/format";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function EventDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { slug } = resolvedParams;

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [countdown, setCountdown] = useState<string>("—");

  useEffect(() => {
    async function load() {
      const allEvents = await getEvents();
      const matched =
        allEvents.find((e) => e.slug === slug) ||
        allEvents.find((e) => e.slug.includes(slug)) ||
        allEvents[0];
      setEvent(matched);

      const allListings = await getListings();
      const eventListings = allListings.filter(
        (l) => l.eventSlug === matched.slug || l.eventId === matched.id
      );
      setListings(eventListings.length > 0 ? eventListings : allListings.slice(0, 3));
    }
    load();
  }, [slug]);

  useEffect(() => {
    if (!event) return;
    const tick = () => {
      setCountdown(formatCountdown(event.startsAt).text);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event]);

  if (!event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-[var(--muted)]">
        Loading event details…
      </div>
    );
  }

  const totalPatches = listings.reduce((acc, l) => acc + l.patches.length, 0);
  const totalEscrow = listings.reduce((acc, l) => acc + (l.totalEscrow || 0n), 0n);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/explore">
          <Button size="small" variant="ghost" className="gap-1.5 px-2.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Explore</span>
          </Button>
        </Link>
        <Link href={`/studio?event=${event.slug}`}>
          <Button size="small" variant="primary">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Get patched for this event
          </Button>
        </Link>
      </div>

      {/* Event Hero Banner */}
      <Card className="p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-[var(--paper)] via-[var(--card)] to-[var(--soft)] border-2 border-[var(--line)] shadow-[6px_6px_0_var(--shadow)]">
        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip color="p1" className="font-mono text-xs uppercase tracking-wider font-bold">
              Official Event
            </Chip>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-[var(--line)] bg-[var(--card)] text-xs font-semibold text-[var(--ink)]">
              <MapPin className="w-3 h-3 text-[var(--accent)]" />
              {event.city}
            </span>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] tracking-tight">
            {event.name}
          </h1>

          <p className="text-sm sm:text-base text-[var(--muted)] leading-relaxed">
            Creators are wearing high-visibility brand patches on-stage, during hackathons, and on the conference floor. Bid in USDC on Monad to secure real-world ad space.
          </p>

          {/* Countdown & Dates */}
          <div className="flex items-center gap-4 flex-wrap pt-2">
            <div className="inline-flex items-center gap-2 border-2 border-[var(--line)] rounded-xl px-3 py-1.5 font-mono text-xs font-bold bg-[var(--paper)] text-[var(--accent-text)]">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <span>Starts in: {countdown}</span>
            </div>
            <div className="inline-flex items-center gap-2 border border-[var(--line)] rounded-xl px-3 py-1.5 font-mono text-xs text-[var(--muted)] bg-[var(--card)]">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(event.startsAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(event.endsAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Decorative corner background motif */}
        <div
          aria-hidden="true"
          className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full opacity-10 bg-[var(--accent)] pointer-events-none blur-2xl"
        />
      </Card>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--p2)] border border-[var(--line)] grid place-items-center text-[#0B0B0C] flex-none">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block">Listings</span>
            <b className="font-mono text-xl sm:text-2xl font-bold text-[var(--ink)]">
              {listings.length} live
            </b>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--p3)] border border-[var(--line)] grid place-items-center text-[#0B0B0C] flex-none">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block">Ad Spots</span>
            <b className="font-mono text-xl sm:text-2xl font-bold text-[var(--ink)]">
              {totalPatches} patches
            </b>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[var(--p5)] border border-[var(--line)] grid place-items-center text-[#0B0B0C] flex-none">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-[var(--muted)] font-semibold block">In Escrow</span>
            <b className="font-mono text-xl sm:text-2xl font-bold text-[var(--ink)]">
              {formatUsdc(totalEscrow || 1450000000n)}
            </b>
          </div>
        </Card>
      </div>

      {/* Listings at this event */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-extrabold text-2xl text-[var(--ink)]">
            Listings at {event.name}
          </h2>
          <span className="text-xs text-[var(--muted)] font-mono">
            {listings.length} active boards
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((l) => {
            const filledCount = l.patches.filter((p) => p.topBid > 0n).length;
            const progress = (filledCount / (l.patches.length || 1)) * 100;

            return (
              <Link
                key={l.id}
                href={`/${l.creatorHandle}/${l.id}`}
                className="group block no-underline"
              >
                <Card className="p-5 space-y-4 hover:-translate-y-1 transition-transform border-2 border-[var(--line)] shadow-[3px_3px_0_var(--shadow)] group-hover:border-[var(--accent)]">
                  {/* Top: Surface & Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider font-bold text-[var(--muted)]">
                      {l.surface}
                    </span>
                    <Pill variant="won" className="text-[11px]">
                      Live auction
                    </Pill>
                  </div>

                  {/* Title & Creator */}
                  <div>
                    <h3 className="font-display font-bold text-lg text-[var(--ink)] group-hover:text-[var(--accent-text)] transition-colors line-clamp-1">
                      {l.title}
                    </h3>
                    <span className="text-xs text-[var(--muted)]">
                      by {l.creatorName} · @{l.creatorHandle}
                    </span>
                  </div>

                  {/* Patch Count & Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--muted)]">Patches with bids:</span>
                      <span className="font-bold text-[var(--ink)]">
                        {filledCount} / {l.patches.length}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--soft)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Escrow total & Action */}
                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[var(--muted)] block text-[11px]">In escrow</span>
                      <span className="font-mono font-bold text-sm text-[var(--ink)]">
                        {formatUsdc(l.totalEscrow)}
                      </span>
                    </div>
                    <Button size="small" variant="ghost">
                      Bid now →
                    </Button>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
