"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Seg } from "@/components/ui/Seg";
import { Button } from "@/components/ui/Button";
import { ListingCardView } from "@/components/market/ListingCardView";
import { fromWire, type SurfaceKind, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";

type Filter = "all" | SurfaceKind;

export function ExploreGrid({ cards: wire }: { cards: Wire<ListingCard[]> }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const [filter, setFilter] = useState<Filter>("all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shown = cards.filter((c) => filter === "all" || c.surface === filter);

  return (
    <main className="wrap pt-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
        <div>
          <span className="eyebrow">Live auctions</span>
          <h1 className="font-extrabold text-4xl sm:text-5xl tracking-tight mt-1">Live patches</h1>
        </div>
        <Seg
          options={[
            { value: "all", label: "All" },
            { value: "outfit", label: "Outfits" },
            { value: "car", label: "Cars" },
            { value: "hoodie", label: "Team hoodies" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((c) => <ListingCardView key={c.id} card={c} mounted={mounted} />)}
        </div>
      ) : (
        <div className="card-surface p-10 text-center flex flex-col items-center gap-3">
          <h2 className="text-2xl font-extrabold">
            {cards.length === 0 ? "No live listings yet" : "Nothing live in this category yet"}
          </h2>
          <p className="muted max-w-[42ch]">
            Be the first: put patches on your outfit, car or team hoodie and let brands bid in USDC.
          </p>
          <Link href="/studio"><Button variant="primary">Get patched</Button></Link>
        </div>
      )}
    </main>
  );
}
