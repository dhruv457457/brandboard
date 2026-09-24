"use client";

import Link from "next/link";
import { Car, Shirt, Sparkles } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData } from "@/components/surface/Patch";
import { Chip } from "@/components/ui/Chip";
import { formatCountdown, formatShortAddress, formatUsdc } from "@/lib/format";
import type { ListingCard } from "@/lib/market/server";

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const SURFACE_META = {
  outfit: { label: "Outfit", Icon: Sparkles },
  car: { label: "Car", Icon: Car },
  hoodie: { label: "Team hoodie", Icon: Shirt },
} as const;

export function ListingCardView({ card, mounted }: { card: ListingCard; mounted: boolean }) {
  const { label, Icon } = SURFACE_META[card.surface];
  const countdown = formatCountdown(card.biddingEndsAt);
  const live = card.status === 1 && !countdown.hasEnded;
  const figurePatches: PatchData[] = card.patches.filter((p) => p.side === card.viewId).map((p) => ({
    id: p.id, name: p.label, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
    floor: Number(p.floor) / 1e6, topBid: Number(p.topBid) / 1e6,
    brand: p.topBidder ? formatShortAddress(p.topBidder) : null,
    c: PASTELS[p.id % PASTELS.length], bought: p.bought,
  }));
  const pct = card.patchCount ? (card.patchesWithBids / card.patchCount) * 100 : 0;

  return (
    <Link
      href={card.href}
      className="card-surface p-3.5 flex flex-col gap-3 no-underline text-[var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
    >
      {/* Fixed-height stage so every card lines up; tall people shots fit by height, cars by width. */}
      <div className="rounded-xl bg-[var(--stage)] h-[300px] p-4 flex items-center justify-center overflow-hidden">
        <SurfaceFigure
          surface={card.surface}
          imageUrl={card.canvasImage}
          patches={figurePatches}
          mode="static"
          showPrices={false}
          className={card.surface === "car" ? "w-full" : "h-full !w-auto max-w-full"}
        />
      </div>
      <div className="flex justify-between items-center gap-2">
        <Chip><Icon size={13} /> {label}</Chip>
        <Chip variant={live ? "orange" : "default"}>
          {live ? <><span className="dot live bg-[var(--accent)]" />{mounted ? `${countdown.text.split(" ")[0]} left` : "Live"}</> : card.status === 1 ? "Ended" : "Closed"}
        </Chip>
      </div>
      <div>
        <h3 className="text-xl font-extrabold leading-tight">{card.title}</h3>
        <p className="muted text-sm">{card.creatorLabel}{card.eventName ? ` · ${card.eventName}` : ""}</p>
      </div>
      <div className="h-2 rounded-full bg-[var(--soft)] overflow-hidden border-[1.5px] border-[var(--line)]">
        <i className="block h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between items-center">
        <span className="muted text-[13px]">{card.patchesWithBids}/{card.patchCount} patches with bids</span>
        <b className="font-mono">{formatUsdc(Number(card.topBidsTotal) / 1e6)}</b>
      </div>
    </Link>
  );
}
