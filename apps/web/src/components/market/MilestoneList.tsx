"use client";

import { Check, Clock, Hourglass, TriangleAlert } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import { formatCountdown } from "@/lib/format";
import type { MilestoneView } from "@/lib/market/server";

const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Milestone ladder with status, deadlines, review countdowns and proof thumbnails. */
export function MilestoneList({
  milestones, nextMilestone, listingStatus, mounted, renderAction,
}: {
  milestones: MilestoneView[];
  nextMilestone: number;
  listingStatus: number;
  mounted: boolean;
  renderAction?: (m: MilestoneView) => React.ReactNode;
}) {
  return (
    <ol className="grid gap-3 list-none p-0 m-0">
      {milestones.map((m) => {
        const current = listingStatus === 2 && m.idx === nextMilestone;
        const review = m.reviewEndsAt ? formatCountdown(m.reviewEndsAt) : null;
        const overdue = current && m.status === 0 && mounted && Date.now() > m.deadline;
        return (
          <li key={m.idx} className={`rounded-2xl border-2 p-4 ${current ? "border-[var(--line)] bg-[var(--card)]" : "border-[var(--soft)]"}`}>
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div>
                <b className="text-lg">{m.bps / 100}% · {m.name}</b>
                <p className="text-sm text-[var(--muted)] flex items-center gap-1.5">
                  <Clock size={13} /> Proof due {mounted ? fmtDate(m.deadline) : ""}
                </p>
              </div>
              {m.status === 2 ? <Pill variant="top"><Check size={12} /> Paid</Pill>
                : m.status === 1 ? <Pill variant="wait"><Hourglass size={12} /> In review</Pill>
                : overdue ? <Pill variant="out"><TriangleAlert size={12} /> Deadline passed</Pill>
                : current ? <Pill variant="out">Waiting for proof</Pill>
                : <Pill variant="wait">Later</Pill>}
            </div>
            {m.status === 1 && review && mounted && (
              <p className="text-sm mt-2">
                {review.hasEnded ? "Review window is over. Payment can be released." : `Brands can dispute for another ${review.text}.`}
              </p>
            )}
            {m.proof && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {m.proof.files.map((f) => (
                  <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f} alt="Proof" className="w-full h-full object-cover" />
                  </a>
                ))}
                {m.proof.note && <p className="text-sm text-[var(--muted)] basis-full">&ldquo;{m.proof.note}&rdquo;</p>}
              </div>
            )}
            {renderAction?.(m)}
          </li>
        );
      })}
    </ol>
  );
}
