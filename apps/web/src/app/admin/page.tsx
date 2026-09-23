"use client";

import React, { useState } from "react";
import {
  Calendar,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  BarChart3,
  Plus,
  Check,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import { SurfaceFigure, SurfaceType } from "@/components/surface/SurfaceFigure";
import { FIXTURE_EVENTS } from "@/lib/data/fixtures";
import { toast } from "sonner";

type AdminTab = "events" | "mod" | "proofs" | "disputes" | "stats";

interface ModItem {
  id: string;
  creator: string;
  title: string;
  surface: SurfaceType;
  patchesCount: number;
  flagType: "ok" | "warn";
  verdict: string;
  status: "pending" | "approved" | "rejected";
}

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("events");

  // Events state
  const [events, setEvents] = useState(FIXTURE_EVENTS);
  const [evName, setEvName] = useState("");
  const [evCity, setEvCity] = useState("");
  const [evDate, setEvDate] = useState("");

  // Moderation state
  const [modItems, setModItems] = useState<ModItem[]>([
    {
      id: "mod-1",
      creator: "@lena.sol",
      title: "Outfit · Devcon 8 · 7 patches",
      surface: "outfit",
      patchesCount: 7,
      flagType: "ok",
      verdict: "AI: X account 4 years old · 12k followers · Clean prompt history",
      status: "pending",
    },
    {
      id: "mod-2",
      creator: "@newacc_2291",
      title: "Car · 8 weeks · $5k floor",
      surface: "car",
      patchesCount: 5,
      flagType: "warn",
      verdict: "AI: Account 6 days old · Over the new-creator cap · High risk",
      status: "pending",
    },
    {
      id: "mod-3",
      creator: "Buildoors",
      title: "Team hoodie · 5 patches",
      surface: "hoodie",
      patchesCount: 5,
      flagType: "ok",
      verdict: "AI: Team verified via ETHIndia registry · 4 builders matched",
      status: "pending",
    },
  ]);

  // Disputes state
  const [disputeResolved, setDisputeResolved] = useState<string | null>(null);

  const pendingModCount = modItems.filter((m) => m.status === "pending").length;

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evName || !evCity || !evDate) {
      toast.error("Please fill all event fields");
      return;
    }
    const newEvent = {
      id: Date.now(),
      slug: evName.toLowerCase().replace(/\s+/g, "-"),
      name: evName,
      city: evCity,
      startsAt: Date.now(),
      endsAt: new Date(evDate).getTime() || Date.now() + 30 * 86400 * 1000,
      listingsCount: 0,
      volumeUsdc: 0n,
      status: "Draft" as const,
    };
    setEvents([newEvent, ...events]);
    toast.success(`Event ${evName} created on Monad!`);
    setEvName("");
    setEvCity("");
    setEvDate("");
  };

  const handleModAction = (id: string, action: "approved" | "rejected") => {
    setModItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: action } : m))
    );
    toast(
      action === "approved"
        ? "Listing approved and live on explore feed!"
        : "Listing rejected. Creator bond refunded."
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="mb-6">
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">
          Admin Console
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-[var(--ink)] tracking-tight mt-1">
          Protocol Management
        </h1>
      </div>

      {/* Main Admin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8 items-start">
        {/* Left: Tab Navigation */}
        <Card className="p-2 space-y-1">
          <button
            type="button"
            onClick={() => setTab("events")}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between ${
              tab === "events"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink)] hover:bg-[var(--soft)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Events
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("mod")}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between ${
              tab === "mod"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink)] hover:bg-[var(--soft)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Moderation
            </span>
            {pendingModCount > 0 && (
              <span className="font-mono text-xs bg-[var(--accent)] text-white px-2 py-0.5 rounded-full">
                {pendingModCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setTab("proofs")}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between ${
              tab === "proofs"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink)] hover:bg-[var(--soft)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" /> Proofs
            </span>
            <span className="font-mono text-xs bg-[var(--soft)] text-[var(--ink)] px-2 py-0.5 rounded-full">
              2
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("disputes")}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between ${
              tab === "disputes"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink)] hover:bg-[var(--soft)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Disputes
            </span>
            <span className="font-mono text-xs bg-[var(--accent)] text-white px-2 py-0.5 rounded-full">
              1
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTab("stats")}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-between ${
              tab === "stats"
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--ink)] hover:bg-[var(--soft)]"
            }`}
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Stats
            </span>
          </button>
        </Card>

        {/* Right Content Pane */}
        <div>
          {/* TAB 1: EVENTS */}
          {tab === "events" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-display font-bold text-2xl text-[var(--ink)]">
                  Conferences & Events
                </h2>
              </div>

              {/* Create Event Form */}
              <Card className="p-5">
                <form
                  onSubmit={handleCreateEvent}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
                >
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                      Event Name
                    </label>
                    <Input
                      placeholder="e.g. Devcon 8"
                      value={evName}
                      onChange={(e) => setEvName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                      City
                    </label>
                    <Input
                      placeholder="e.g. Mumbai"
                      value={evCity}
                      onChange={(e) => setEvCity(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                      Bids close
                    </label>
                    <Input
                      type="date"
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" variant="primary">
                    <Plus className="w-4 h-4 mr-1" /> Create event
                  </Button>
                </form>
              </Card>

              {/* Events Table */}
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse min-w-[560px]">
                    <thead>
                      <tr className="border-b-2 border-[var(--line)] bg-[var(--soft)]/50">
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          Event
                        </th>
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          City
                        </th>
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          Bids close
                        </th>
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          Listings
                        </th>
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          Volume
                        </th>
                        <th className="py-3 px-4 font-mono text-xs uppercase text-[var(--muted)]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--soft)]">
                      {events.map((ev) => (
                        <tr key={ev.id} className="hover:bg-[var(--paper)]">
                          <td className="py-3 px-4 font-bold">{ev.name}</td>
                          <td className="py-3 px-4 text-[var(--muted)]">{ev.city}</td>
                          <td className="py-3 px-4 font-mono">
                            {new Date(ev.endsAt).toISOString().split("T")[0]}
                          </td>
                          <td className="py-3 px-4 font-mono">{ev.listingsCount}</td>
                          <td className="py-3 px-4 font-mono font-semibold">
                            ${Number(ev.volumeUsdc / 1000000n)}
                          </td>
                          <td className="py-3 px-4">
                            <Pill variant="top">{ev.status}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: MODERATION QUEUE */}
          {tab === "mod" && (
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-[var(--ink)]">
                Moderation Queue
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modItems
                  .filter((m) => m.status === "pending")
                  .map((item) => (
                    <Card key={item.id} className="p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <b className="text-sm text-[var(--ink)]">{item.creator}</b>
                          <span className="text-[11px] font-mono text-[var(--muted)]">
                            {item.patchesCount} patches
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {item.title}
                        </p>

                        <div className="bg-[var(--stage)] rounded-xl border border-[var(--line)] my-3 h-28 flex items-center justify-center overflow-hidden">
                          <div className="h-24 w-auto">
                            <SurfaceFigure
                              surface={item.surface}
                              patches={[]}
                              mode="static"
                              showPrices={false}
                            />
                          </div>
                        </div>

                        <div
                          className={`text-xs p-2 rounded-lg border flex items-center gap-1.5 ${
                            item.flagType === "ok"
                              ? "bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]"
                              : "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-text)]"
                          }`}
                        >
                          {item.flagType === "ok" ? (
                            <Check className="w-3.5 h-3.5 flex-none" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 flex-none" />
                          )}
                          <span className="leading-tight text-[11px]">
                            {item.verdict}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onClick={() => handleModAction(item.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleModAction(item.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </Card>
                  ))}
              </div>
              {pendingModCount === 0 && (
                <div className="text-center py-12 text-[var(--muted)] font-display text-lg">
                  Moderation queue empty! All listings reviewed.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROOF REVIEW */}
          {tab === "proofs" && (
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-[var(--ink)]">
                Proof Verification
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-5 space-y-3">
                  <h3 className="font-display font-bold text-base text-[var(--ink)]">
                    @mirabuilds · M1 print proof
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="aspect-square bg-[var(--p3)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Printed dress
                    </div>
                    <div className="aspect-square bg-[var(--p4)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Flight receipt
                    </div>
                    <div className="aspect-square bg-[var(--p1)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Event ticket
                    </div>
                  </div>
                  <div className="text-xs p-2 rounded-lg bg-[var(--green-soft)] border border-[var(--green)] text-[var(--green)] flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> AI: Receipt amounts match,
                    ticket QR verified
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        toast.success("Approved! 40% released to @mirabuilds.")
                      }
                    >
                      Approve · release 40%
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast("Requested additional photos.")}
                    >
                      Ask for more
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 space-y-3">
                  <h3 className="font-display font-bold text-base text-[var(--ink)]">
                    team rektangle · M2 event proof
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="aspect-square bg-[var(--p5)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Stage photo
                    </div>
                    <div className="aspect-square bg-[var(--p2)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Team photo
                    </div>
                    <div className="aspect-square bg-[var(--p4)] rounded-lg border border-[var(--line)] flex items-center justify-center text-xs font-bold text-center p-1">
                      Video 0:12
                    </div>
                  </div>
                  <div className="text-xs p-2 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent-text)] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> AI: 1 of 3 photos has no
                    GPS location metadata
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        toast.success("Approved! Remaining 60% released to team.")
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.error("Rejected proof.")}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 4: DISPUTES */}
          {tab === "disputes" && (
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-[var(--ink)]">
                Active Disputes
              </h2>

              <Card className="p-6 space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <h3 className="font-display font-bold text-lg text-[var(--ink)]">
                    Zeta Pay vs @kr1shna · Sleeve patch · $260
                  </h3>
                  <Pill variant="outbid">Needs decision</Pill>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[var(--paper)] p-4 rounded-xl border border-[var(--line)] text-sm">
                  <div>
                    <span className="font-mono text-xs uppercase text-[var(--muted)] font-semibold">
                      Brand Claim (Zeta Pay)
                    </span>
                    <p className="mt-1 text-[var(--ink)]">
                      &quot;Logo was covered by a heavy black hoodie the whole day at the
                      conference.&quot;
                    </p>
                  </div>
                  <div>
                    <span className="font-mono text-xs uppercase text-[var(--muted)] font-semibold">
                      Creator Response (@kr1shna)
                    </span>
                    <p className="mt-1 text-[var(--ink)]">
                      &quot;Hoodie was removed from 11:00 AM onwards. 14 stage photos
                      submitted.&quot;
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-[var(--soft)] rounded-xl border border-[var(--line)] text-xs text-[var(--muted)]">
                  <span className="font-bold text-[var(--ink)]">
                    AI Vision Analysis:{" "}
                  </span>
                  11 of 14 photos clearly display the sleeve patch with high prominence
                  between 11:15 AM and 6:30 PM. Average visible area 94%.
                </div>

                {disputeResolved ? (
                  <div className="p-3 rounded-xl bg-[var(--green-soft)] border border-[var(--green)] text-xs font-semibold text-[var(--green)]">
                    Dispute resolved: {disputeResolved}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap pt-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setDisputeResolved("Escrow released to creator");
                        toast.success("Dispute resolved: Funds paid to creator.");
                      }}
                    >
                      Pay creator
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDisputeResolved("Escrow refunded to brand");
                        toast("Dispute resolved: Funds refunded to brand.");
                      }}
                    >
                      Refund brand
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDisputeResolved("Escrow split 50/50");
                        toast("Dispute resolved: 50% split applied.");
                      }}
                    >
                      Split 50/50
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 5: STATS */}
          {tab === "stats" && (
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-[var(--ink)]">
                Platform Financials
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="p-4">
                  <span className="text-xs text-[var(--muted)]">Total volume</span>
                  <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--ink)] block mt-1">
                    $51.1k
                  </b>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[var(--muted)]">Protocol fee (5%)</span>
                  <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--green)] block mt-1">
                    $2,555
                  </b>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[var(--muted)]">Gas sponsored</span>
                  <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--accent)] block mt-1">
                    $38.20
                  </b>
                </Card>
                <Card className="p-4">
                  <span className="text-xs text-[var(--muted)]">Active creators</span>
                  <b className="font-mono text-2xl sm:text-3xl font-semibold text-[var(--ink)] block mt-1">
                    59
                  </b>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
