"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Upload,
  Camera,
  Users,
  Coins,
  Loader2,
  Clock,
} from "lucide-react";
import { FIXTURE_LISTINGS } from "@/lib/data/fixtures";
import { formatUsdc } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import { toast } from "sonner";
import { useSubmitProof } from "@/lib/chain/useMilestones";

interface CreatorListingDashboardProps {
  params: Promise<{
    listingId: string;
  }>;
}

interface TeamMember {
  address: string;
  share: number;
}

export default function CreatorListingDashboard({
  params,
}: CreatorListingDashboardProps) {
  const resolvedParams = React.use(params);
  const listing =
    FIXTURE_LISTINGS.find(
      (l) => l.id === resolvedParams.listingId || l.creatorHandle === resolvedParams.listingId
    ) || FIXTURE_LISTINGS[0];

  const [proofSubmitted, setProofSubmitted] = useState<Record<number, boolean>>({
    0: true, // M1 completed in demo
    1: false,
  });
  const [proofText, setProofText] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([
    { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", share: 60 },
    { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df", share: 40 },
  ]);

  const { execute: submitProof, status: submitStatus } = useSubmitProof();

  // Milestone payout amounts
  const totalEscrow = listing.totalEscrow || 1355n * 1000000n;
  const m1Usdc = (totalEscrow * 40n) / 100n;
  const m2Usdc = totalEscrow - m1Usdc;

  const handleUploadProof = async (milestoneIdx: number) => {
    const success = await submitProof({
      listingId: listing.id,
      milestoneIndex: milestoneIdx,
      proofFiles: ["https://mock.patched.fun/proof-photo.jpg"],
    });

    if (success) {
      setProofSubmitted((prev) => ({ ...prev, [milestoneIdx]: true }));
      toast.success(
        `Milestone ${milestoneIdx + 1} proof submitted! Brands have 72h to review or dispute.`
      );
    }
  };

  const handleUpdateTeamShare = (index: number, newShare: number) => {
    const updated = [...teamMembers];
    updated[index].share = newShare;
    setTeamMembers(updated);
  };

  const totalShare = teamMembers.reduce((sum, m) => sum + m.share, 0);

  const handleSaveTeamSplit = () => {
    if (totalShare !== 100) {
      toast.error(`Team shares must sum to 100% (currently ${totalShare}%)`);
      return;
    }
    toast.success("Team split updated on-chain!");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/studio"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] mb-2 no-underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Studio
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-[var(--ink)] tracking-tight">
              {listing.creatorName} · {listing.eventName || listing.event || listing.title}
            </h1>
            <Chip variant="orange" className="text-xs">
              Live Auction
            </Chip>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/${listing.creatorHandle}/${listing.id}`}>
            <Button size="sm" variant="ghost">
              View public auction
            </Button>
          </Link>
          <Link href={`/share/${listing.id}`}>
            <Button size="sm">Share kit</Button>
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* Left Column: Milestones & Proof Upload */}
        <div className="space-y-6">
          {/* Milestone 1 Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Milestone 1 · 40% Release
                </span>
                <h3 className="font-display font-bold text-xl text-[var(--ink)] mt-0.5">
                  Print Proof & Event Ticket
                </h3>
              </div>
              <span className="font-mono font-bold text-lg text-[var(--ink)]">
                {formatUsdc(m1Usdc)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[var(--soft)] h-2.5 rounded-full border border-[var(--line)] overflow-hidden">
              <div className="bg-[var(--green)] h-full w-full" />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5 text-[var(--green)] font-semibold">
                <Check className="w-4 h-4" /> Proof approved · Funds released
              </span>
              <span>Released on-chain</span>
            </div>

            <div className="p-3 bg-[var(--paper)] rounded-xl border border-[var(--line)] text-xs text-[var(--muted)] space-y-1">
              <div className="font-semibold text-[var(--ink)]">Submitted proof:</div>
              <div>• Photo of physical garment printed with winning logos</div>
              <div>• Token2049 official entrance ticket QR scan</div>
            </div>
          </Card>

          {/* Milestone 2 Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Milestone 2 · 60% Release
                </span>
                <h3 className="font-display font-bold text-xl text-[var(--ink)] mt-0.5">
                  Event Attendance & Stage Proof
                </h3>
              </div>
              <span className="font-mono font-bold text-lg text-[var(--ink)]">
                {formatUsdc(m2Usdc)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[var(--soft)] h-2.5 rounded-full border border-[var(--line)] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  proofSubmitted[1] ? "w-full bg-[var(--accent)]" : "w-0"
                }`}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--muted)]">
                {proofSubmitted[1]
                  ? "Proof submitted · 72h dispute window running"
                  : "Awaiting event completion"}
              </span>
              <span className="font-mono font-semibold text-[var(--ink)]">
                {proofSubmitted[1] ? "Reviewing" : "Pending"}
              </span>
            </div>

            {/* Proof Upload Area */}
            {!proofSubmitted[1] ? (
              <div className="border-2 border-dashed border-[var(--line)] rounded-xl p-5 bg-[var(--paper)] space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--soft)] flex items-center justify-center">
                    <Camera className="w-5 h-5 text-[var(--ink)]" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--ink)]">
                      Upload venue proof
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      At least 2 photos wearing the garment at the venue
                    </div>
                  </div>
                </div>

                <Input
                  placeholder="Optional note / social post link (e.g. x.com/mirabuilds/...)"
                  value={proofText}
                  onChange={(e) => setProofText(e.target.value)}
                  className="text-xs"
                />

                <Button
                  variant="primary"
                  className="w-full text-xs"
                  onClick={() => handleUploadProof(1)}
                  disabled={submitStatus === "signing" || submitStatus === "confirming"}
                >
                  {submitStatus === "signing" || submitStatus === "confirming" ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting
                      proof…
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Submit proof to escrow
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-[var(--accent-soft)] rounded-xl border border-[var(--accent)] text-xs text-[var(--accent-text)] flex items-center gap-2">
                <Clock className="w-4 h-4 flex-none" />
                <span>
                  Proof submitted! Dispute countdown active (48 hours remaining). If no
                  dispute is opened by brands, funds unlock automatically.
                </span>
              </div>
            )}
          </Card>

          {/* Team Split Editor */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-display font-bold text-xl text-[var(--ink)]">
                Team payout split
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Escrow releases are automatically distributed directly into each team
              member&apos;s wallet on Monad according to these shares.
            </p>

            <div className="space-y-3">
              {teamMembers.map((member, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Input
                    value={member.address}
                    readOnly
                    className="flex-1 font-mono text-xs text-[var(--muted)]"
                  />
                  <div className="w-24 flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={member.share}
                      onChange={(e) =>
                        handleUpdateTeamShare(idx, parseInt(e.target.value) || 0)
                      }
                      className="font-mono text-xs text-right"
                    />
                    <span className="text-xs font-semibold">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--soft)] text-xs">
              <span className={totalShare === 100 ? "text-[var(--green)] font-semibold" : "text-red-500 font-semibold"}>
                Total: {totalShare}% {totalShare !== 100 && "(Must equal 100%)"}
              </span>
              <Button size="sm" onClick={handleSaveTeamSplit}>
                Save split
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Escrow Financial Summary */}
        <aside className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="font-display font-bold text-lg text-[var(--ink)]">
              Escrow summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Total top bids</span>
                <span className="font-mono font-bold text-lg text-[var(--ink)]">
                  {formatUsdc(totalEscrow)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--muted)]">Released (M1)</span>
                <span className="font-mono font-semibold text-[var(--green)]">
                  {formatUsdc(m1Usdc)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--muted)]">Pending (M2)</span>
                <span className="font-mono font-semibold text-[var(--accent)]">
                  {formatUsdc(m2Usdc)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[var(--muted)]">Creator bond</span>
                <span className="font-mono">$25 USDC (refunded at M2)</span>
              </div>
            </div>

            <Button
              className="w-full text-xs"
              variant="primary"
              onClick={() => toast.success("Funds already claimed to your wallet!")}
            >
              <Coins className="w-3.5 h-3.5 mr-1.5" /> Claim released ($542 USDC)
            </Button>
          </Card>

          {/* Quick Garment Preview */}
          <Card className="p-4 flex flex-col items-center">
            <div className="h-[220px] w-auto">
              <SurfaceFigure
                surface={listing.surface}
                patches={listing.patches}
                mode="static"
                showPrices={true}
              />
            </div>
            <div className="text-xs text-[var(--muted)] text-center mt-2">
              {listing.patches.filter((p) => p.topBid > 0n || !!p.brand).length} / {listing.patches.length} spots claimed
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
