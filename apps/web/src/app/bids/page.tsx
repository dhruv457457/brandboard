"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Zap,
  Shield,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { FIXTURE_BRAND_DASHBOARD } from "@/lib/data/fixtures";
import { toast } from "sonner";
import { useListForResale } from "@/lib/chain/useResale";

export default function BrandDashboardPage() {
  const [data, setData] = useState(FIXTURE_BRAND_DASHBOARD);
  const [autoBidCap, setAutoBidCap] = useState(500);
  const [autoBidActive, setAutoBidActive] = useState(false);
  const [selectedReceiptForResale, setSelectedReceiptForResale] = useState<string | null>(null);
  const [resaleAmount, setResaleAmount] = useState("450");

  const { execute: listResale } = useListForResale();

  const handleQuickRebid = (listingId: string, patchId: string | number, currentBid: bigint) => {
    const nextBid = currentBid + 40n * 1000000n;
    setData((prev) => ({
      ...prev,
      activeBids: prev.activeBids.map((b) =>
        b.listingId === listingId && b.patchId === patchId
          ? {
              ...b,
              yourBid: nextBid,
              topBid: nextBid,
              isTop: true,
              status: "Top bid" as const,
            }
          : b
      ),
    }));
    toast.success("Placed bid $320! You now lead Team Rektangle · Chest");
  };

  const handleToggleAutoBid = () => {
    setAutoBidActive(!autoBidActive);
    if (!autoBidActive) {
      toast.success(
        `Auto-bid activated! Session signer will outbid competitors up to $${autoBidCap}.`
      );
    } else {
      toast("Auto-bid turned off.");
    }
  };

  const handleResellSubmit = async (tokenId: string) => {
    const priceNum = parseInt(resaleAmount) || 450;
    await listResale({
      tokenId,
      price: BigInt(priceNum) * 1000000n,
    });
    toast.success(`Patch receipt #${tokenId} listed for $${priceNum} USDC (5% creator royalty)`);
    setSelectedReceiptForResale(null);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
            Brand Dashboard
          </span>
          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] tracking-tight mt-1">
            Nodeflux
          </h1>
        </div>

        <Button
          size="sm"
          onClick={() =>
            toast("Privy Card Onramp: Deposit native USDC via debit/credit card or Apple Pay")
          }
        >
          <CreditCard className="w-4 h-4 mr-1.5" /> Add funds with card
        </Button>
      </div>

      {/* 4 KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <span className="text-xs text-[var(--muted)] block">In escrow</span>
          <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--ink)] mt-1 block">
            $1,240
          </b>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--muted)] block">Leading bids</span>
          <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--green)] mt-1 block">
            3
          </b>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--muted)] block">Patches won</span>
          <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--accent)] mt-1 block">
            11
          </b>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-[var(--muted)] block">Est. impressions</span>
          <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--ink)] mt-1 block">
            184k
          </b>
        </Card>
      </div>

      {/* Bids Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[620px]">
            <thead>
              <tr className="border-b-2 border-[var(--line)] bg-[var(--soft)]/50">
                <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Creator
                </th>
                <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Patch
                </th>
                <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Surface
                </th>
                <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Your bid
                </th>
                <th className="py-3 px-4 font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
                  Status
                </th>
                <th className="py-3 px-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--soft)]">
              {data.activeBids.map((bid) => {
                const isLeading = bid.status === "Top bid";
                const isWon = bid.status === "Won";
                const isOutbid = bid.status === "Outbid";

                return (
                  <tr
                    key={`${bid.listingId}-${bid.patchId}`}
                    className="hover:bg-[var(--paper)] transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-[var(--ink)]">
                      {bid.creatorHandle}
                    </td>
                    <td className="py-3 px-4">{bid.patchLabel}</td>
                    <td className="py-3 px-4 text-[var(--muted)] text-xs">
                      {bid.surface}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">
                      ${Number(bid.yourBid / 1000000n)}
                    </td>
                    <td className="py-3 px-4">
                      {isLeading && <Pill variant="top">Top bid</Pill>}
                      {isWon && <Pill variant="won">Won · receipt minted</Pill>}
                      {isOutbid && (
                        <Pill variant="outbid">
                          Outbid · ${Number(bid.topBid / 1000000n)}
                        </Pill>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isOutbid ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() =>
                            handleQuickRebid(
                              bid.listingId,
                              bid.patchId,
                              bid.yourBid
                            )
                          }
                        >
                          Bid $320
                        </Button>
                      ) : (
                        <Link href={`/${bid.creatorHandle.replace("@", "")}`}>
                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Two Column Layout: Proof Review & Auto-Bid/Receipts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Proof Review */}
        <Card className="p-6 space-y-4">
          <h3 className="font-display font-bold text-xl text-[var(--ink)]">
            Weekly proof · @dev.drives car
          </h3>

          {/* 4-Week Milestone indicators */}
          <div className="flex gap-2 my-2">
            <div className="flex-1 h-3 rounded-full border-2 border-[var(--line)] bg-[var(--soft)] overflow-hidden">
              <div className="h-full bg-[var(--green)] w-full" />
            </div>
            <div className="flex-1 h-3 rounded-full border-2 border-[var(--line)] bg-[var(--soft)] overflow-hidden">
              <div className="h-full bg-[var(--green)] w-full" />
            </div>
            <div className="flex-1 h-3 rounded-full border-2 border-[var(--line)] bg-[var(--soft)] overflow-hidden">
              <div className="h-full bg-[var(--accent)] w-[65%]" />
            </div>
            <div className="flex-1 h-3 rounded-full border-2 border-[var(--line)] bg-[var(--soft)] overflow-hidden">
              <div className="h-full bg-[var(--soft)] w-0" />
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Week 1–2 released · Week 3 dispute window:{" "}
            <b className="font-mono text-[var(--ink)]">41h left</b>
          </p>

          {/* Proof Evidence Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="aspect-square rounded-xl border-2 border-[var(--line)] bg-[var(--p1)] flex items-center justify-center text-xs font-bold text-[var(--ink)] text-center p-2">
              Dated photo
            </div>
            <div className="aspect-square rounded-xl border-2 border-[var(--line)] bg-[var(--p4)] flex items-center justify-center text-xs font-bold text-[var(--ink)] text-center p-2">
              Check-in map
            </div>
            <div className="aspect-square rounded-xl border-2 border-[var(--line)] bg-[var(--p2)] flex items-center justify-center text-xs font-bold text-[var(--ink)] text-center p-2">
              Odometer
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => toast.success("Approved! Escrow released to @dev.drives.")}
            >
              Looks good, release now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => toast.error("Dispute opened. Monad escrow paused for review.")}
            >
              Open dispute
            </Button>
          </div>
        </Card>

        {/* Right Column: Auto-bid & Receipts */}
        <div className="space-y-6">
          {/* Auto-bid Card */}
          <Card className="p-6 space-y-4">
            <h3 className="font-display font-bold text-xl text-[var(--ink)]">
              Auto-bid
            </h3>
            <p className="text-sm text-[var(--muted)]">
              Stay on top of <b>team rektangle · Chest</b> without watching the page.
            </p>

            <div>
              <div className="flex justify-between items-center text-sm font-semibold mb-2">
                <span>Max bid cap</span>
                <span className="font-mono font-bold text-[var(--accent)]">
                  ${autoBidCap}
                </span>
              </div>
              <input
                type="range"
                min={320}
                max={1500}
                step={10}
                value={autoBidCap}
                onChange={(e) => setAutoBidCap(Number(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div className="space-y-2 text-xs text-[var(--muted)] bg-[var(--paper)] p-3 rounded-xl border border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
                <span>A session signer bids for you, up to your max only</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--green)] flex-none" />
                <span>Can only call the Patched escrow contract</span>
              </div>
            </div>

            <Button
              size="sm"
              variant={autoBidActive ? "default" : "primary"}
              onClick={handleToggleAutoBid}
              className="w-full"
            >
              {autoBidActive ? "Turn off auto-bid" : "Turn on auto-bid"}
            </Button>
          </Card>

          {/* Patch Receipts (NFT Cards) */}
          <Card className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display font-bold text-xl text-[var(--ink)]">
                Patch receipts
              </h3>
              <span className="text-xs font-mono text-[var(--muted)]">
                ERC-721 on Monad
              </span>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              {data.receipts.map((receipt, idx) => (
                <div
                  key={receipt.tokenId}
                  className={`w-36 p-3 rounded-xl border-2 border-[var(--line)] bg-[var(--paper)] shadow-[3px_3px_0_var(--shadow)] transition-transform hover:scale-105 ${
                    idx === 0 ? "-rotate-2" : "rotate-2"
                  }`}
                >
                  <div
                    className="h-16 rounded-lg border-2 border-[var(--line)] flex items-center justify-center font-display font-extrabold text-sm mb-2 relative"
                    style={{
                      backgroundColor: idx === 0 ? "var(--p2)" : "var(--p3)",
                    }}
                  >
                    Nodeflux
                    <div className="absolute inset-1 border border-dashed border-[var(--line)]/40 rounded-sm pointer-events-none" />
                  </div>
                  <div className="text-xs font-bold text-[var(--ink)]">
                    #{receipt.tokenId}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] line-clamp-1">
                    {receipt.patchLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReceiptForResale(receipt.tokenId)}
                    className="mt-2 w-full text-center text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Tag className="w-3 h-3" /> Resell
                  </button>
                </div>
              ))}
            </div>

            {selectedReceiptForResale && (
              <div className="p-3 bg-[var(--soft)] rounded-xl border border-[var(--line)] space-y-2 text-xs">
                <div className="font-bold text-[var(--ink)]">
                  List #{selectedReceiptForResale} on secondary market:
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center border border-[var(--line)] rounded-lg bg-[var(--card)] px-2">
                    <span className="font-mono text-xs text-[var(--muted)] mr-1">$</span>
                    <input
                      type="number"
                      value={resaleAmount}
                      onChange={(e) => setResaleAmount(e.target.value)}
                      className="w-full py-1 text-xs font-mono font-bold outline-hidden"
                    />
                    <span className="font-mono text-[10px] text-[var(--muted)]">USDC</span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleResellSubmit(selectedReceiptForResale)}
                  >
                    List
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedReceiptForResale(null)}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  5% royalty goes to the creator upon resale.
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
