"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, Loader2, Plus, Shirt, Sparkles, Trash2, Wand2 } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData } from "@/components/surface/Patch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { formatUsdc } from "@/lib/format";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { DEFAULT_LAYOUTS } from "@/lib/market/layouts";
import type { SurfaceKind } from "@/lib/market/types";
import { useCreateListing } from "@/lib/market/useCreateListing";

export interface StudioEvent {
  id: number;
  name: string;
  startsAt: number;
  endsAt: number;
}

interface DraftPatch {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  floor: number; // USDC
  buyNow: number; // USDC
}

const SURFACE_OPTIONS: { kind: SurfaceKind; label: string; note: string; Icon: typeof Sparkles }[] = [
  { kind: "outfit", label: "Outfit", note: "Paid per event", Icon: Sparkles },
  { kind: "car", label: "Car", note: "Paid per week", Icon: Car },
  { kind: "hoodie", label: "Team hoodie", note: "Paid per hackathon", Icon: Shirt },
];
const DAY = 86_400_000;
const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;

function defaultPatches(surface: SurfaceKind, count?: number): DraftPatch[] {
  return DEFAULT_LAYOUTS[surface].slice(0, count ?? 3).map((s, i) => ({
    id: i, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, r: s.r ?? 0, floor: 10, buyNow: 50,
  }));
}

/** Payout plan and proof deadlines (unix ms) for a surface. */
function milestonePlan(surface: SurfaceKind, biddingEndsAt: number, event?: StudioEvent) {
  if (surface === "car") {
    return [0, 1, 2, 3].map((i) => ({ name: `Week ${i + 1} proof`, bps: 2500, deadline: biddingEndsAt + (i + 1) * 7 * DAY + 2 * DAY }));
  }
  const printDue = event ? Math.max(event.startsAt, biddingEndsAt + DAY) : biddingEndsAt + 5 * DAY;
  const eventDue = event ? Math.max(event.endsAt + 3 * DAY, printDue + DAY) : biddingEndsAt + 14 * DAY;
  return [
    { name: "Print proof", bps: 4000, deadline: printDue },
    { name: surface === "hoodie" ? "Hackathon proof" : "Event proof", bps: 6000, deadline: eventDue },
  ];
}

export function StudioEditor({ events, minBond, newCreatorCap }: { events: StudioEvent[]; minBond: string; newCreatorCap: string }) {
  const router = useRouter();
  const { authenticated, login, walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const { create, step, error } = useCreateListing();

  const [surface, setSurface] = useState<SurfaceKind>("outfit");
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState<number>(events[0]?.id ?? 0);
  const [days, setDays] = useState(3);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<null | "upload" | "canvas" | "layout">(null);
  const [patches, setPatches] = useState<DraftPatch[]>(() => defaultPatches("outfit"));
  const [selectedId, setSelectedId] = useState<number | null>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(10);

  const bond = BigInt(minBond);
  const cap = Number(newCreatorCap) / 1e6;
  const event = events.find((e) => e.id === eventId);
  const buyNowTotal = patches.reduce((s, p) => s + p.buyNow, 0);
  const selected = patches.find((p) => p.id === selectedId) ?? null;
  const plan = useMemo(() => milestonePlan(surface, Date.now() + days * DAY, surface === "car" ? undefined : event), [surface, days, event]);
  const publishing = step === "saving" || step === "approving" || step === "creating";

  function pickSurface(kind: SurfaceKind) {
    setSurface(kind);
    setCanvasUrl(null);
    setPhotoUrl(null);
    setPatches(defaultPatches(kind));
    setSelectedId(0);
    if (kind === "car") setEventId(0);
  }

  async function onPhoto(file: File) {
    if (!authenticated) return login();
    try {
      setAiBusy("upload");
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "canvases");
      const up = await authedFetch("/api/uploads", { method: "POST", body: form });
      const upJson = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !upJson.url) throw new Error(upJson.error ?? "Upload failed.");
      setPhotoUrl(upJson.url);

      setAiBusy("canvas");
      const res = await authedFetch("/api/ai/canvas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageUrl: upJson.url, surface }),
      });
      const json = (await res.json()) as { canvasUrl?: string; error?: string };
      if (!res.ok || !json.canvasUrl) throw new Error(json.error ?? "The AI couldn't make a canvas.");
      setCanvasUrl(json.canvasUrl);
      toast("Your white canvas is ready. Place your patches.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAiBusy(null);
    }
  }

  async function suggest() {
    if (!canvasUrl) {
      setPatches(defaultPatches(surface, DEFAULT_LAYOUTS[surface].length));
      toast("Placed patches on the spots people see most.");
      return;
    }
    setAiBusy("layout");
    try {
      const res = await authedFetch("/api/ai/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ canvasUrl, surface, count: 5 }),
      });
      const { patches: s } = (await res.json()) as { patches?: { name: string; x: number; y: number; w: number; h: number }[] };
      if (!s?.length) throw new Error();
      setPatches(s.map((p, i) => ({ id: nextId.current++, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, r: 0, floor: 10, buyNow: 50 + i * 10 })));
      toast(`AI placed ${s.length} patches.`);
    } catch {
      toast("The AI couldn't read this photo. Place patches by hand.");
    } finally {
      setAiBusy(null);
    }
  }

  function addPatch() {
    if (patches.length >= 16) return toast("A listing can have up to 16 patches.");
    const id = nextId.current++;
    setPatches((ps) => [...ps, { id, name: `Patch ${ps.length + 1}`, x: 40, y: 45, w: 20, h: 9, r: 0, floor: 10, buyNow: 50 }]);
    setSelectedId(id);
  }

  function update(id: number, change: Partial<DraftPatch>) {
    setPatches((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  async function publish() {
    if (!authenticated) return login();
    if (!title.trim()) return toast("Give your listing a title.");
    if (patches.some((p) => !(p.floor > 0) || p.buyNow < p.floor)) return toast("Each patch needs a floor above $0 and a buy-now at or above its floor.");
    const biddingEndsAt = Math.floor((Date.now() + days * DAY) / 1000);
    const id = await create({
      metadata: {
        version: 1,
        title: title.trim(),
        surface,
        ...(photoUrl ? { sourceImage: photoUrl } : {}),
        ...(canvasUrl ? { canvasImage: canvasUrl } : {}),
        patches: patches.map((p, i) => ({ id: i, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, rotation: p.r })),
        milestones: plan.map((m) => ({ name: m.name, bps: m.bps })),
      },
      surfaceIndex: surface === "outfit" ? 0 : surface === "car" ? 1 : 2,
      eventId: surface === "car" ? 0 : eventId,
      biddingEndsAt,
      bond,
      floors: patches.map((p) => BigInt(Math.round(p.floor * 1e6))),
      buyNows: patches.map((p) => BigInt(Math.round(p.buyNow * 1e6))),
      deadlines: plan.map((m) => Math.floor(m.deadline / 1000)),
    });
    if (id) {
      toast("Listing created. It goes live once an admin approves it.");
      router.push(`/${walletAddress?.toLowerCase()}/${id}`);
    }
  }

  const figurePatches: PatchData[] = patches.map((p, i) => ({
    id: p.id, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r, floor: p.floor, c: PASTELS[i % PASTELS.length],
  }));

  return (
    <main className="wrap pt-8 pb-24">
      <div className="mb-6">
        <span className="eyebrow">Studio</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1">Create a listing</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr_300px] items-start">
        {/* left: what & when */}
        <Card className="p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-lg mb-2">Surface</h3>
            <div className="grid gap-2">
              {SURFACE_OPTIONS.map(({ kind, label, note, Icon }) => (
                <button
                  key={kind}
                  onClick={() => pickSurface(kind)}
                  aria-pressed={surface === kind}
                  className="flex gap-2.5 items-center text-left border-2 rounded-xl px-3 py-2.5 font-semibold text-sm border-[var(--line)] bg-[var(--paper)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:border-[var(--accent)]"
                >
                  <Icon size={18} />
                  <span>{label}<small className="block font-normal text-[var(--muted)] text-xs">{note}</small></span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Title</span>
            <input className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" value={title} maxLength={80}
              placeholder={surface === "car" ? "4 weeks around Bengaluru" : "My Token2049 outfit"} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {surface !== "car" && (
            <label className="flex flex-col gap-1.5">
              <span className="field-label">Event</span>
              <select className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                <option value={0}>No specific event</option>
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="field-label">Bidding runs for</span>
            <select className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
            </select>
          </label>
          <div>
            <span className="field-label mb-1.5">Your photo</span>
            <button onClick={() => fileRef.current?.click()} disabled={!!aiBusy}
              className="w-full flex gap-3 items-center border-2 border-dashed border-[var(--line)] rounded-xl p-3 bg-[var(--paper)] hover:border-[var(--accent)] text-left">
              <span className="w-11 h-11 rounded-lg bg-[var(--soft)] grid place-items-center overflow-hidden flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photoUrl ? <img src={photoUrl} alt="Your photo" className="w-full h-full object-cover" /> : <Camera size={20} />}
              </span>
              <span className="text-sm"><b>{photoUrl ? "Change photo" : "Upload photo"}</b><br />
                <span className="text-[var(--muted)] text-xs">AI turns it into a clean white canvas</span></span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
            <p className="text-xs text-[var(--muted)] mt-1.5">Optional. Without a photo, brands see our drawing.</p>
          </div>
        </Card>

        {/* center: canvas */}
        <Card className="p-4 relative">
          <div className="flex gap-2 flex-wrap justify-center mb-3">
            <Button size="small" onClick={addPatch}><Plus size={14} /> Add patch</Button>
            <Button size="small" onClick={suggest} disabled={!!aiBusy}><Wand2 size={14} /> {canvasUrl ? "AI suggest layout" : "Suggest layout"}</Button>
          </div>
          <div className={surface === "car" ? "max-w-[620px] mx-auto" : "max-w-[380px] mx-auto"}>
            <SurfaceFigure
              surface={surface}
              imageUrl={canvasUrl}
              patches={figurePatches}
              mode="editable"
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(Number(id))}
              onUpdatePatches={(ps) => setPatches((cur) => cur.map((p) => {
                const n = ps.find((x) => x.id === p.id);
                return n ? { ...p, x: n.x, y: n.y, w: n.w, h: n.h } : p;
              }))}
            />
          </div>
          <p className="text-xs text-[var(--muted)] text-center mt-2">Drag a patch to move it. Drag its corner to resize.</p>
          {aiBusy && aiBusy !== "layout" && (
            <div className="absolute inset-0 rounded-[16px] bg-[var(--card)]/95 grid place-items-center text-center p-6">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin" />
                <b className="text-xl">{aiBusy === "upload" ? "Uploading your photo…" : "Making your white canvas…"}</b>
                <span className="text-sm text-[var(--muted)]">This takes about 10 to 20 seconds.</span>
              </div>
            </div>
          )}
        </Card>

        {/* right: patch + pricing + publish */}
        <Card className="p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-lg mb-2">Patch</h3>
            {selected ? (
              <div className="grid gap-2.5">
                <label className="flex flex-col gap-1"><span className="field-label">Name</span>
                  <input className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]" maxLength={31} value={selected.name}
                    onChange={(e) => update(selected.id, { name: e.target.value })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1"><span className="field-label">Floor ($)</span>
                    <input type="number" min={1} className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] font-mono" value={selected.floor}
                      onChange={(e) => update(selected.id, { floor: Number(e.target.value) })} /></label>
                  <label className="flex flex-col gap-1"><span className="field-label">Buy now ($)</span>
                    <input type="number" min={1} className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] font-mono" value={selected.buyNow}
                      onChange={(e) => update(selected.id, { buyNow: Number(e.target.value) })} /></label>
                </div>
                <Button size="small" variant="ghost" className="justify-self-start" onClick={() => { setPatches((ps) => ps.filter((p) => p.id !== selected.id)); setSelectedId(null); }}>
                  <Trash2 size={13} /> Remove patch
                </Button>
              </div>
            ) : <p className="text-sm text-[var(--muted)]">Select a patch on the canvas to edit it.</p>}
          </div>

          <div className="border-t-2 border-dashed border-[var(--soft)] pt-3 grid gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Patches</span><b className="font-mono">{patches.length}</b></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">If every patch sells at buy-now</span><b className="font-mono">{formatUsdc(buyNowTotal)}</b></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Your bond (returned when you deliver)</span><b className="font-mono">{formatUsdc(Number(bond) / 1e6)}</b></div>
            {buyNowTotal > cap && <p className="text-xs text-[var(--accent-text)]">First listings are capped at {formatUsdc(cap)} in buy-now prices until you complete one delivery.</p>}
          </div>

          <div className="grid gap-1.5">
            <span className="field-label">How you get paid</span>
            {plan.map((m) => (
              <div key={m.name} className="flex justify-between text-sm">
                <span>{m.bps / 100}% after {m.name.toLowerCase()}</span>
                <span className="text-[var(--muted)] font-mono text-xs">by {new Date(m.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}
          <Button variant="primary" onClick={publish} disabled={publishing || !!aiBusy}>
            {step === "saving" ? "Saving details…" : step === "approving" ? "Approving bond…" : step === "creating" ? "Publishing on-chain…" : authenticated ? "Publish listing" : "Sign in to publish"}
          </Button>
          <p className="text-xs text-[var(--muted)]">Listings go live after a quick review by the Patched team.</p>
        </Card>
      </div>
    </main>
  );
}
