"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Car,
  Shirt,
  Camera,
  Plus,
  Wand2,
  Trash2,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { SurfaceFigure, SurfaceType } from "@/components/surface/SurfaceFigure";
import { PatchData } from "@/components/surface/Patch";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AmountInput } from "@/components/ui/AmountInput";
import { toast } from "sonner";
import { useCreateListing } from "@/lib/chain/useCreateListing";
import { formatUsdc } from "@/lib/format";

const DEFAULT_LAYOUTS: Record<SurfaceType, PatchData[]> = {
  outfit: [
    { id: "neck", name: "Neckline", x: 38, y: 24.5, w: 24, h: 7, floor: 150n * 1000000n, buyNow: 600n * 1000000n, top: 0n, r: -2 },
    { id: "belt", name: "Waist belt", x: 39, y: 37.6, w: 22, h: 4.6, floor: 120n * 1000000n, buyNow: 450n * 1000000n, top: 0n, r: 1.5 },
    { id: "hipL", name: "Left hip", x: 36, y: 44, w: 13, h: 8, floor: 60n * 1000000n, buyNow: 300n * 1000000n, top: 0n, r: -3 },
    { id: "hipR", name: "Right hip", x: 51, y: 44, w: 13, h: 8, floor: 60n * 1000000n, buyNow: 300n * 1000000n, top: 0n, r: 2 },
    { id: "skirt", name: "Skirt center", x: 40, y: 57, w: 20, h: 11, floor: 200n * 1000000n, buyNow: 540n * 1000000n, top: 0n, r: -1.5 },
    { id: "hemL", name: "Hem left", x: 27, y: 78, w: 19, h: 9, floor: 80n * 1000000n, buyNow: 320n * 1000000n, top: 0n, r: -2.5 },
    { id: "hemR", name: "Hem right", x: 54, y: 78, w: 19, h: 9, floor: 80n * 1000000n, buyNow: 320n * 1000000n, top: 0n, r: 3 },
  ],
  car: [
    { id: "fend", name: "Front fender", x: 11, y: 56, w: 12, h: 5.5, floor: 60n * 1000000n, buyNow: 220n * 1000000n, top: 0n },
    { id: "fdoor", name: "Front door", x: 34, y: 53, w: 19, h: 19, floor: 250n * 1000000n, buyNow: 900n * 1000000n, top: 0n, r: -1 },
    { id: "rdoor", name: "Rear door", x: 55.5, y: 53, w: 11.5, h: 19, floor: 150n * 1000000n, buyNow: 500n * 1000000n, top: 0n, r: 1 },
    { id: "rq", name: "Rear quarter", x: 71, y: 52.5, w: 18, h: 6, floor: 80n * 1000000n, buyNow: 260n * 1000000n, top: 0n },
    { id: "rwin", name: "Rear window", x: 58, y: 37, w: 14, h: 9, floor: 50n * 1000000n, buyNow: 180n * 1000000n, top: 0n },
  ],
  hoodie: [
    { id: "chest", name: "Chest", x: 36, y: 36, w: 28, h: 13, floor: 150n * 1000000n, buyNow: 500n * 1000000n, top: 0n, r: -1 },
    { id: "sl", name: "Left sleeve", x: 9, y: 44, w: 11, h: 12, floor: 50n * 1000000n, buyNow: 180n * 1000000n, top: 0n, r: -10 },
    { id: "sr", name: "Right sleeve", x: 80, y: 44, w: 11, h: 12, floor: 50n * 1000000n, buyNow: 180n * 1000000n, top: 0n, r: 10 },
    { id: "pocket", name: "Pocket", x: 35, y: 70, w: 30, h: 13, floor: 90n * 1000000n, buyNow: 300n * 1000000n, top: 0n, r: 1 },
    { id: "band", name: "Waistband", x: 30, y: 87.6, w: 40, h: 5, floor: 40n * 1000000n, buyNow: 150n * 1000000n, top: 0n },
  ],
};

export default function StudioPage() {
  const router = useRouter();
  const [surface, setSurface] = useState<SurfaceType>("outfit");
  const [event, setEvent] = useState("Token2049 Singapore");
  const [patches, setPatches] = useState<PatchData[]>(DEFAULT_LAYOUTS.outfit);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Stitching your white fit…");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { execute: createListing, status: txStatus } = useCreateListing();

  const selectedPatch = patches.find((p) => p.id === selectedId);

  // Switch surface handler
  const handleSelectSurface = (newSurface: SurfaceType) => {
    if (newSurface === surface) return;
    setSurface(newSurface);
    setLoadingText(
      newSurface === "car"
        ? "Blanking your car canvas…"
        : newSurface === "hoodie"
        ? "Blanking your team hoodie…"
        : "Stitching your white fit…"
    );
    setIsAiLoading(true);
    setTimeout(() => {
      setPatches(DEFAULT_LAYOUTS[newSurface]);
      setSelectedId(null);
      setIsAiLoading(false);
      toast(`Ready with default ${newSurface} layout`);
    }, 800);
  };

  // Photo upload simulation
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setUploadedImage(url);
    setIsAiLoading(true);
    setLoadingText("AI isolating canvas & removing background…");

    setTimeout(() => {
      setIsAiLoading(false);
      toast.success("White canvas ready · 7 patch spots suggested by AI");
    }, 1800);
  };

  // Add custom patch
  const handleAddPatch = () => {
    const newId = `patch-${Date.now().toString(36)}`;
    const newPatch: PatchData = {
      id: newId,
      name: `Patch ${patches.length + 1}`,
      x: 40,
      y: 45,
      w: 20,
      h: 9,
      floor: 50n * 1000000n,
      buyNow: 200n * 1000000n,
      top: 0n,
    };
    setPatches([...patches, newPatch]);
    setSelectedId(newId);
    toast("Added new patch. Drag or resize on canvas.");
  };

  // AI suggest layout
  const handleAiSuggestLayout = async () => {
    setIsAiLoading(true);
    setLoadingText("AI computing visual attention heatmaps…");
    try {
      const res = await fetch("/api/ai/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface }),
      });
      const data = await res.json();
      if (data.patches) {
        interface ApiPatch {
          id: string;
          name: string;
          x: number;
          y: number;
          w: number;
          h: number;
          floor: number;
          buyNow: number;
          r?: number;
        }
        const mapped = (data.patches as ApiPatch[]).map((p) => ({
          ...p,
          floor: BigInt(p.floor) * 1000000n,
          buyNow: BigInt(p.buyNow) * 1000000n,
          top: 0n,
        }));
        setPatches(mapped);
      }
    } catch {
      setPatches(DEFAULT_LAYOUTS[surface]);
    } finally {
      setIsAiLoading(false);
      setSelectedId(null);
      toast.success(`AI placed ${patches.length} high-attention spots`);
    }
  };

  // Delete patch
  const handleDeletePatch = () => {
    if (!selectedId) return;
    setPatches(patches.filter((p) => p.id !== selectedId));
    setSelectedId(null);
  };

  // Update selected patch
  const handleUpdateSelected = <K extends keyof PatchData>(field: K, value: PatchData[K]) => {
    if (!selectedId) return;
    setPatches((prev) =>
      prev.map((p) => (p.id === selectedId ? { ...p, [field]: value } : p))
    );
  };

  // Floor sum
  const totalFloor = patches.reduce((sum, p) => sum + BigInt(p.floor ?? 0), 0n);

  // Publish listing
  const handlePublish = async () => {
    if (patches.length === 0) {
      toast.error("Add at least one patch before publishing");
      return;
    }

    try {
      const newId = await createListing({
        surface,
        title: `${surface.toUpperCase()} · ${event}`,
        eventName: event,
        biddingEndsAt: Date.now() + 3 * 86400 * 1000,
        bond: 25n * 1000000n,
        patches: patches.map((p) => ({
          name: p.name,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          r: p.r,
          floor: BigInt(p.floor ?? 0),
          buyNow: BigInt(p.buyNow ?? 0),
        })),
      });

      if (newId) {
        toast.success("Listing published to Monad! Bond escrowed.");
        router.push(`/share/mira`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to publish listing: " + msg);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Steps Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]">
          <Check className="w-3.5 h-3.5" /> 1 · Event
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-[var(--green)] bg-[var(--green-soft)] text-[var(--green)]">
          <Check className="w-3.5 h-3.5" /> 2 · Surface
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]">
          3 · Patches
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-[var(--line)] bg-[var(--card)] text-[var(--muted)]">
          4 · Price and publish
        </span>
      </div>

      {/* 3-Column Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] gap-6 items-start">
        {/* Left Column: Surface & Photo */}
        <div className="space-y-6">
          <Card className="p-4 space-y-4">
            <h3 className="font-display font-bold text-lg text-[var(--ink)]">
              Surface
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSelectSurface("outfit")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  surface === "outfit"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--soft)]"
                }`}
              >
                <Sparkles className="w-5 h-5 flex-none text-[var(--accent)]" />
                <div>
                  <div className="font-semibold text-sm">Outfit</div>
                  <div className="text-xs text-[var(--muted)]">Paid per event</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSurface("car")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  surface === "car"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--soft)]"
                }`}
              >
                <Car className="w-5 h-5 flex-none text-[var(--accent)]" />
                <div>
                  <div className="font-semibold text-sm">Car</div>
                  <div className="text-xs text-[var(--muted)]">Paid per week</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectSurface("hoodie")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  surface === "hoodie"
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--soft)]"
                }`}
              >
                <Shirt className="w-5 h-5 flex-none text-[var(--accent)]" />
                <div>
                  <div className="font-semibold text-sm">Team hoodie</div>
                  <div className="text-xs text-[var(--muted)]">Per hackathon, split</div>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-[var(--soft)]">
              <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                Event / Campaign
              </label>
              <Input
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder="e.g. Token2049 Singapore"
                className="w-full text-sm"
              />
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="font-display font-bold text-lg text-[var(--ink)]">
              Your photo
            </h3>
            <label
              htmlFor="studio-photo-upload"
              className="group border-2 border-dashed border-[var(--line)] hover:border-[var(--accent)] rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-[var(--paper)]"
            >
              <div className="w-10 h-10 rounded-full bg-[var(--soft)] group-hover:bg-[var(--accent-soft)] flex items-center justify-center mb-2 transition-colors">
                <Camera className="w-5 h-5 text-[var(--ink)] group-hover:text-[var(--accent)]" />
              </div>
              <span className="font-bold text-sm text-[var(--ink)]">
                Upload photo
              </span>
              <span className="text-xs text-[var(--muted)] mt-1">
                AI makes a clean white version
              </span>
            </label>
            <input
              id="studio-photo-upload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            {uploadedImage && (
              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 h-12 rounded-lg border border-[var(--line)] overflow-hidden bg-[var(--soft)] flex-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedImage}
                    alt="Uploaded preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-xs text-[var(--muted)] leading-tight">
                  Source photo isolated into canvas by AI
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Center Column: Interactive Canvas */}
        <Card className="p-6 relative bg-[radial-gradient(var(--soft)_1.5px,transparent_1.5px)] [background-size:18px_18px] min-h-[540px] flex flex-col items-center justify-between overflow-hidden">
          {/* Top Canvas Tools */}
          <div className="w-full flex items-center justify-center gap-2 flex-wrap mb-4 z-10">
            <Button size="sm" onClick={handleAddPatch}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add patch
            </Button>
            <Button size="sm" onClick={handleAiSuggestLayout}>
              <Wand2 className="w-3.5 h-3.5 mr-1 text-[var(--accent)]" /> AI suggest layout
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setPatches([]);
                setSelectedId(null);
              }}
            >
              Clear
            </Button>
          </div>

          {/* Canvas Figure */}
          <div className="w-full flex items-center justify-center py-4 flex-1">
            <div
              className={
                surface === "car"
                  ? "w-full max-w-[540px]"
                  : surface === "hoodie"
                  ? "w-full max-w-[420px]"
                  : "w-full max-w-[340px]"
              }
            >
              <SurfaceFigure
                surface={surface}
                patches={patches}
                mode="editable"
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
                onUpdatePatches={(updated) => setPatches(updated)}
                showPrices={true}
              />
            </div>
          </div>

          <div className="text-xs text-[var(--muted)] text-center w-full pt-2">
            Click to select. Drag to reposition. Pull the orange corner handle to resize.
          </div>

          {/* AI Loader Overlay */}
          {isAiLoading && (
            <div className="absolute inset-0 bg-[var(--card)]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-4 z-20 transition-all">
              <svg
                className="w-48 h-10 overflow-visible text-[var(--accent)]"
                viewBox="0 0 220 40"
                aria-hidden="true"
              >
                <path
                  d="M5 20 Q 55 0 110 20 T 215 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="8 7"
                  className="animate-[dash_1s_linear_infinite]"
                />
              </svg>
              <div className="font-display font-extrabold text-xl text-[var(--ink)]">
                {loadingText}
              </div>
              <div className="text-xs font-mono text-[var(--muted)]">
                AI Vision · processing in real-time
              </div>
            </div>
          )}
        </Card>

        {/* Right Column: Patch Settings & Publish */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="font-display font-bold text-lg text-[var(--ink)]">
              Patch settings
            </h3>

            {!selectedPatch ? (
              <div className="text-sm text-[var(--muted)] leading-relaxed">
                Select a patch on the canvas. Drag to move it, and use the orange
                corner handle to resize.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                    Patch name
                  </label>
                  <Input
                    value={selectedPatch.name}
                    onChange={(e) => handleUpdateSelected("name", e.target.value)}
                    className="w-full text-sm font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                      Floor (USDC)
                    </label>
                    <AmountInput
                      value={Number(BigInt(selectedPatch.floor ?? 0) / 1000000n)}
                      onChange={(e) =>
                        handleUpdateSelected(
                          "floor",
                          BigInt(Math.max(1, parseInt(e.target.value) || 0)) * 1000000n
                        )
                      }
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[var(--muted)] mb-1">
                      Buy now
                    </label>
                    <AmountInput
                      value={Number(BigInt(selectedPatch.buyNow ?? 0) / 1000000n)}
                      onChange={(e) =>
                        handleUpdateSelected(
                          "buyNow",
                          BigInt(Math.max(1, parseInt(e.target.value) || 0)) * 1000000n
                        )
                      }
                      className="text-sm"
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDeletePatch}
                  className="text-red-500 hover:text-red-600 px-0 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete patch
                </Button>
              </div>
            )}

            <hr className="border-dashed border-[var(--soft)] my-4" />

            {/* Listing Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Patches</span>
                <span className="font-mono font-bold">{patches.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Floor total</span>
                <span className="font-mono font-bold text-[var(--accent)]">
                  {formatUsdc(totalFloor)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Your bond (escrow)</span>
                <span className="font-mono font-bold">$25</span>
              </div>
            </div>

            <div className="text-xs text-[var(--muted)] bg-[var(--soft)] p-2.5 rounded-lg border border-[var(--line)]">
              <span className="font-bold text-[var(--ink)]">Milestone release: </span>
              {surface === "outfit" && "40% print proof & ticket · 60% event photo"}
              {surface === "car" && "25% released each week on verified odometer/GPS"}
              {surface === "hoodie" && "40% check-in · 60% stage & demo photos"}
            </div>

            <Button
              variant="primary"
              className="w-full"
              disabled={patches.length === 0 || txStatus === "signing" || txStatus === "confirming"}
              onClick={handlePublish}
            >
              {txStatus === "signing" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing bond…
                </>
              ) : txStatus === "confirming" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Escrowing on Monad…
                </>
              ) : (
                <>
                  Publish and share <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
