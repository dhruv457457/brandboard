"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ListingCardView } from "@/components/market/ListingCardView";
import { formatCountdown, formatUsdc } from "@/lib/format";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";

interface EventInfo {
  id: number;
  name: string;
  startsAt: number;
  endsAt: number;
  city: string | null;
  description: string | null;
  active: boolean;
}

const fmt = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function EventView({ event, cards: wire }: { event: EventInfo; cards: Wire<ListingCard[]> }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const total = cards.reduce((s, c) => s + c.topBidsTotal, 0n);
  const startsIn = formatCountdown(event.startsAt);

  return (
    <main className="wrap pt-8 pb-24 grid gap-8">
      <Card className="p-7 bg-[var(--p3)] text-[#0B0B0C] relative overflow-hidden">
        <span className="eyebrow !text-[#0B0B0C]/70">Event</span>
        <h1 className="font-extrabold text-5xl tracking-tight mt-1">{event.name}</h1>
        <div className="flex gap-4 flex-wrap mt-3 text-sm font-semibold">
          <span className="inline-flex gap-1.5 items-center"><CalendarDays size={15} /> {fmt(event.startsAt)} to {fmt(event.endsAt)}</span>
          {event.city && <span className="inline-flex gap-1.5 items-center"><MapPin size={15} /> {event.city}</span>}
          {mounted && !startsIn.hasEnded && <span className="bg-[#0B0B0C] text-[#FAFAF7] rounded-lg px-2 py-0.5 font-mono text-xs">starts in {startsIn.text.split(" ")[0]}</span>}
        </div>
        {event.description && <p className="mt-3 max-w-[60ch]">{event.description}</p>}
      </Card>

      <Card className="grid grid-cols-2">
        <div className="kpi"><b>{cards.length}</b><span>{cards.length === 1 ? "creator listing" : "creator listings"}</span></div>
        <div className="kpi"><b>{formatUsdc(Number(total) / 1e6)}</b><span>in top bids</span></div>
      </Card>

      {cards.length === 0 ? (
        <Card className="p-8 text-center grid gap-3 justify-items-center">
          <h2 className="text-2xl font-extrabold">No one is getting patched here yet</h2>
          <p className="muted">Going to {event.name}? List your outfit or team hoodie and let brands bid.</p>
          {event.active && <Link href="/studio"><Button variant="primary">Get patched</Button></Link>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => <ListingCardView key={c.id} card={c} mounted={mounted} />)}
        </div>
      )}
    </main>
  );
}
