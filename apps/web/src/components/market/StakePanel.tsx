"use client";

import { BadgeCheck, CalendarClock, ShieldCheck, Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatUsdc } from "@/lib/format";
import type { ListingView } from "@/lib/market/types";

const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

interface Props {
  listing: ListingView;
  creatorLabel: string;
  status: number;
  /** Dates differ between server and browser time zones, so they render after mount. */
  mounted: boolean;
}

/**
 * What protects a brand's money on this listing: the creator's bond (paid to spot holders on a no-show),
 * the creator's delivery record from the contract, and the payout plan (every payment needs proof first).
 */
export function StakePanel({ listing, creatorLabel, status, mounted }: Props) {
  const { bond, creatorRecord: rec } = listing;
  const outcome =
    status === 3 ? `${creatorLabel} delivered. The stake went back to them.`
    : status === 4 ? `${creatorLabel} missed a deadline. The stake and unpaid escrow went to the spot holders.`
    : `If ${creatorLabel} misses a proof deadline, this stake and all unpaid escrow go to the spot holders.`;

  return (
    <Card className="p-5 sm:p-6 grid gap-5">
      <div className="grid gap-1">
        <span className="eyebrow">Your protection</span>
        <h2 className="text-2xl sm:text-3xl font-extrabold">{creatorLabel} has money on the line</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border-2 border-[var(--line)] p-4 grid gap-1 content-start">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck size={16} className="text-[var(--accent-text)]" /> Creator stake</span>
          <b className="font-mono text-3xl tabular-nums">{usd(bond)}</b>
          <p className="text-xs text-[var(--muted)]">{outcome}</p>
        </div>
        <div className="rounded-2xl border-2 border-[var(--line)] p-4 grid gap-1 content-start">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><Trophy size={16} className="text-[var(--accent-text)]" /> Track record</span>
          {rec.completed + rec.failed > 0 ? (
            <>
              <b className="font-mono text-3xl tabular-nums">{rec.completed} delivered</b>
              <p className="text-xs text-[var(--muted)]">
                {rec.failed === 0 ? "No missed deadlines" : `${rec.failed} missed ${rec.failed === 1 ? "deadline" : "deadlines"}`} · {usd(rec.earned)} earned on Patched
              </p>
            </>
          ) : (
            <>
              <b className="text-2xl font-extrabold">First listing</b>
              <p className="text-xs text-[var(--muted)]">New creators have a spending cap until their first delivery, so the risk stays small.</p>
            </>
          )}
        </div>
        <div className="rounded-2xl border-2 border-[var(--line)] p-4 grid gap-1 content-start">
          <span className="flex items-center gap-1.5 text-sm font-semibold"><BadgeCheck size={16} className="text-[var(--accent-text)]" /> Escrow</span>
          <b className="text-2xl font-extrabold">Paid only on proof</b>
          <p className="text-xs text-[var(--muted)]">Your USDC sits in the contract. Each payment needs proof first, and you get 72 hours to dispute it.</p>
        </div>
      </div>

      {listing.milestoneBps.length > 0 && (
        <div className="grid gap-2">
          <span className="text-sm font-semibold flex items-center gap-1.5"><CalendarClock size={16} /> Payout plan</span>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {listing.milestoneBps.map((bps, i) => (
              <li key={i} className="rounded-xl bg-[var(--soft)] px-3 py-2 flex items-center gap-3">
                <b className="font-mono text-lg tabular-nums">{bps / 100}%</b>
                <span className="grid min-w-0">
                  <span className="text-sm font-semibold truncate">{listing.metadata?.milestones[i]?.name ?? `Milestone ${i + 1}`}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {mounted && listing.deadlines[i] ? `proof due ${new Date(listing.deadlines[i]).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : " "}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}
