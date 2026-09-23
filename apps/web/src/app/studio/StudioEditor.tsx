"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Car, Loader2, Plus, Shirt, Sparkles, Trash2, Wand2 } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData } from "@/components/surface/Patch";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { formatUsdc } from "@/lib/format";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { DEFAULT_LAYOUTS, MODEL_SHOT_LAYOUTS } from "@/lib/market/layouts";
import type { SurfaceKind } from "@/lib/market/types";
import { useCreateListing } from "@/lib/market/useCreateListing";

export interface StudioEvent {
  id: number;
  name: string;
  startsAt: number;
  endsAt: number;
}

type Side = "front" | "back";

interface DraftPatch {
  id: number;
  name: string;
  side: Side;
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
const STYLE_CHOICES: { key: string; label: string }[] = [
  { key: "current", label: "Keep my current outfit" },
  { key: "hoodie", label: "Hoodie + joggers" },
  { key: "tee", label: "T-shirt + jeans" },
  { key: "blazer", label: "Blazer + trousers" },
  { key: "dress", label: "Dress" },
  { key: "jersey", label: "Sports jersey" },
];
const DAY = 86_400_000;
const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]";

let idSeq = 100;
const draft = (side: Side, s: { name: string; x: number; y: number; w: number; h: number; r?: number }, i = 0): DraftPatch => ({
  id: idSeq++, side, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, r: s.r ?? 0, floor: 10, buyNow: 50 + i * 10,
});

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
  const [styleKey, setStyleKey] = useState<string>("current");
  const [customStyle, setCustomStyle] = useState("");
  const [aiStyles, setAiStyles] = useState<string[]>([]);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("front");
  const [busy, setBusy] = useState<null | string>(null);

  const [patches, setPatches] = useState<DraftPatch[]>(() => DEFAULT_LAYOUTS.outfit.slice(0, 3).map((s) => draft("front", s)));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const person = surface !== "car";
  const bond = BigInt(minBond);
  const cap = Number(newCreatorCap) / 1e6;
  const event = events.find((e) => e.id === eventId);
  const buyNowTotal = patches.reduce((s, p) => s + p.buyNow, 0);
  const selected = patches.find((p) => p.id === selectedId) ?? null;
  const sidePatches = patches.filter((p) => p.side === side);
  const plan = useMemo(() => milestonePlan(surface, Date.now() + days * DAY, person ? event : undefined), [surface, days, event, person]);
  const publishing = step === "saving" || step === "approving" || step === "creating";
  const styleText = styleKey === "custom" ? customStyle.trim() : styleKey.startsWith("ai:") ? aiStyles[Number(styleKey.slice(3))] : styleKey;
  const canvas = side === "back" ? back : front;

  function pickSurface(kind: SurfaceKind) {
    setSurface(kind);
    setPhotoUrl(null);
    setFront(null);
    setBack(null);
    setSide("front");
    setAiStyles([]);
    setPatches(DEFAULT_LAYOUTS[kind].slice(0, 3).map((s) => draft("front", s)));
    setSelectedId(null);
    if (kind === "car") setEventId(0);
  }

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await authedFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
    return json;
  }

  async function onPhoto(file: File) {
    if (!authenticated) return login();
    try {
      setBusy("Uploading your photo…");
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "canvases");
      const up = await authedFetch("/api/uploads", { method: "POST", body: form });
      const upJson = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !upJson.url) throw new Error(upJson.error ?? "Upload failed.");
      setPhotoUrl(upJson.url);
      setFront(null);
      setBack(null);

      if (person) {
        setBusy(null);
        postJson<{ styles: string[] }>("/api/ai/styles", { photoUrl: upJson.url })
          .then(({ styles }) => setAiStyles(styles))
          .catch(() => {});
      } else {
        setBusy("Repainting your car white…");
        const { canvasUrl } = await postJson<{ canvasUrl: string }>("/api/ai/canvas", { imageUrl: upJson.url, surface });
        setFront(canvasUrl);
        await autoLayout(canvasUrl, "front");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  /** Ask the vision model for spots on one side; fall back to the fixed layout for that framing. */
  async function autoLayout(url: string, which: Side) {
    const fallback = person ? MODEL_SHOT_LAYOUTS[which] : DEFAULT_LAYOUTS.car;
    let spots: { name: string; x: number; y: number; w: number; h: number; r?: number }[] = fallback;
    try {
      const { patches: s } = await postJson<{ patches: typeof spots }>("/api/ai/layout", { canvasUrl: url, surface, count: which === "back" ? 2 : 4 });
      if (s?.length) spots = s;
    } catch {
      /* keep fallback */
    }
    setPatches((ps) => [...ps.filter((p) => p.side !== which), ...spots.map((s, i) => draft(which, s, i))]);
  }

  async function generateLook() {
    if (!photoUrl) return toast("Upload a photo of yourself first.");
    if (!styleText) return toast("Describe the outfit you want.");
    try {
      setBusy("Creating your front view… (1 of 2)");
      const f = await postJson<{ url: string }>("/api/ai/model-shot", { photoUrl, style: styleText, side: "front" });
      setFront(f.url);
      setSide("front");
      setBusy("Creating your back view… (2 of 2)");
      const b = await postJson<{ url: string }>("/api/ai/model-shot", { photoUrl, style: styleText, side: "back", frontUrl: f.url });
      setBack(b.url);
      setBusy("Placing patches…");
      setPatches([]);
      await Promise.all([autoLayout(f.url, "front"), autoLayout(b.url, "back")]);
      toast("Your look is ready. Adjust the patches, then set prices.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function addPatch() {
    if (patches.length >= 16) return toast("A listing can have up to 16 patches.");
    const p = draft(side, { name: `Patch ${patches.length + 1}`, x: 40, y: 40, w: 18, h: 8 });
    setPatches((ps) => [...ps, p]);
    setSelectedId(p.id);
  }

  const update = (id: number, change: Partial<DraftPatch>) => setPatches((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));

  async function publish() {
    if (!authenticated) return login();
    if (!title.trim()) return toast("Give your listing a title.");
    if (!patches.length) return toast("Add at least one patch.");
    if (patches.some((p) => !(p.floor > 0) || p.buyNow < p.floor)) return toast("Each patch needs a floor above $0 and a buy-now at or above its floor.");
    const ordered = [...patches.filter((p) => p.side === "front"), ...patches.filter((p) => p.side === "back")];
    const id = await create({
      metadata: {
        version: 1,
        title: title.trim(),
        surface,
        ...(photoUrl && !person ? { sourceImage: photoUrl } : {}),
        ...(front ? { canvasImage: front } : {}),
        ...(back ? { canvasImageBack: back } : {}),
        ...(person && front && styleText ? { style: styleText } : {}),
        patches: ordered.map((p, i) => ({ id: i, name: p.name, side: p.side, x: p.x, y: p.y, w: p.w, h: p.h, rotation: p.r })),
        milestones: plan.map((m) => ({ name: m.name, bps: m.bps })),
      },
      surfaceIndex: surface === "outfit" ? 0 : surface === "car" ? 1 : 2,
      eventId: person ? eventId : 0,
      biddingEndsAt: Math.floor((Date.now() + days * DAY) / 1000),
      bond,
      floors: ordered.map((p) => BigInt(Math.round(p.floor * 1e6))),
      buyNows: ordered.map((p) => BigInt(Math.round(p.buyNow * 1e6))),
      deadlines: plan.map((m) => Math.floor(m.deadline / 1000)),
    });
    if (id) {
      toast("Listing created. It goes live once an admin approves it.");
      router.push(`/${walletAddress?.toLowerCase()}/${id}`);
    }
  }

  const figurePatches: PatchData[] = sidePatches.map((p, i) => ({
    id: p.id, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r, floor: p.floor, c: PASTELS[i % PASTELS.length],
  }));

  return (
    <main className="wrap pt-8 pb-24">
      <div className="mb-6">
        <span className="eyebrow">Studio</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1">Create a listing</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr_300px] items-start">
        {/* ── left: what, when, and the look ── */}
        <Card className="p-4 flex flex-col gap-4">
          <div className="grid gap-2">
            {SURFACE_OPTIONS.map(({ kind, label, note, Icon }) => (
              <button key={kind} onClick={() => pickSurface(kind)} aria-pressed={surface === kind}
                className="flex gap-2.5 items-center text-left border-2 rounded-xl px-3 py-2.5 font-semibold text-sm border-[var(--line)] bg-[var(--paper)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:border-[var(--accent)]">
                <Icon size={18} />
                <span>{label}<small className="block font-normal text-[var(--muted)] text-xs">{note}</small></span>
              </button>
            ))}
          </div>
          <label className="grid gap-1.5"><span className="field-label">Title</span>
            <input className={INPUT} value={title} maxLength={80} placeholder={person ? "My Token2049 fit" : "4 weeks around Bengaluru"}
              onChange={(e) => setTitle(e.target.value)} /></label>
          {person && (
            <label className="grid gap-1.5"><span className="field-label">Event</span>
              <select className={INPUT} value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                <option value={0}>No specific event</option>
              </select></label>
          )}
          <label className="grid gap-1.5"><span className="field-label">Bidding runs for</span>
            <select className={INPUT} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 3, 5, 7].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
            </select></label>

          <div className="grid gap-2 border-t-2 border-dashed border-[var(--soft)] pt-3">
            <span className="field-label">{person ? "1. A photo of you" : "Photo of your car"}</span>
            <button onClick={() => fileRef.current?.click()} disabled={!!busy}
              className="w-full flex gap-3 items-center border-2 border-dashed border-[var(--line)] rounded-xl p-3 bg-[var(--paper)] hover:border-[var(--accent)] text-left">
              <span className="w-11 h-11 rounded-lg bg-[var(--soft)] grid place-items-center overflow-hidden flex-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photoUrl ? <img src={photoUrl} alt="Your photo" className="w-full h-full object-cover" /> : <Camera size={20} />}
              </span>
              <span className="text-sm"><b>{photoUrl ? "Change photo" : "Upload photo"}</b><br />
                <span className="text-[var(--muted)] text-xs">{person ? "A clear selfie is enough" : "Side view works best"}</span></span>
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
          </div>

          {person && photoUrl && (
            <div className="grid gap-2">
              <span className="field-label">2. What will you wear?</span>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_CHOICES.map((s) => (
                  <button key={s.key} onClick={() => setStyleKey(s.key)} aria-pressed={styleKey === s.key}
                    className="text-xs font-semibold border-[1.5px] border-[var(--line)] rounded-full px-2.5 py-1 bg-[var(--card)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]">
                    {s.label}
                  </button>
                ))}
              </div>
              {aiStyles.length > 0 && (
                <div className="grid gap-1.5">
                  <span className="text-xs text-[var(--muted)] flex items-center gap-1"><Sparkles size={12} /> Ideas for you</span>
                  {aiStyles.map((s, i) => (
                    <button key={s} onClick={() => setStyleKey(`ai:${i}`)} aria-pressed={styleKey === `ai:${i}`}
                      className="text-left text-xs border-[1.5px] border-[var(--line)] rounded-xl px-2.5 py-1.5 bg-[var(--card)] aria-pressed:bg-[var(--accent-soft)] aria-pressed:border-[var(--accent)]">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <input className={INPUT + " text-sm"} placeholder="Or describe your own…" value={customStyle} maxLength={120}
                onFocus={() => setStyleKey("custom")} onChange={(e) => { setCustomStyle(e.target.value); setStyleKey("custom"); }} />
              <Button variant="primary" onClick={generateLook} disabled={!!busy}>
                <Wand2 size={15} /> {front ? "Generate again" : "3. Create my look"}
              </Button>
              <p className="text-xs text-[var(--muted)]">AI makes a full-body front and back view of you in a plain white version, ready for patches.</p>
            </div>
          )}
        </Card>

        {/* ── center: canvas editor ── */}
        <Card className="p-4 relative">
          <div className="flex gap-2 flex-wrap justify-center items-center mb-3">
            {person && back && (
              <Seg options={[{ value: "front", label: "Front" }, { value: "back", label: "Back" }]} value={side} onChange={(v) => { setSide(v as Side); setSelectedId(null); }} />
            )}
            <Button size="small" onClick={addPatch}><Plus size={14} /> Add patch</Button>
            {canvas && <Button size="small" onClick={() => autoLayout(canvas, side)} disabled={!!busy}><Wand2 size={14} /> AI suggest spots</Button>}
          </div>
          <div className={surface === "car" ? "max-w-[620px] mx-auto" : "max-w-[360px] mx-auto"}>
            <SurfaceFigure
              surface={surface}
              imageUrl={canvas}
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
          <p className="text-xs text-[var(--muted)] text-center mt-2">
            {canvas ? "Drag a patch to move it. Drag its corner to resize." : person ? "Upload a photo to see yourself here, or use the drawing." : "Upload a photo of your car, or use the drawing."}
          </p>
          {busy && (
            <div className="absolute inset-0 rounded-[16px] bg-[var(--card)]/95 grid place-items-center text-center p-6">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin" />
                <b className="text-xl">{busy}</b>
                <span className="text-sm text-[var(--muted)]">Each image takes about 10 to 20 seconds.</span>
              </div>
            </div>
          )}
        </Card>

        {/* ── right: selected patch, totals, payout plan, publish ── */}
        <Card className="p-4 flex flex-col gap-4">
          <div>
            <h3 className="font-bold text-lg mb-2">Patch{selected && person && back ? ` · ${selected.side}` : ""}</h3>
            {selected ? (
              <div className="grid gap-2.5">
                <label className="grid gap-1"><span className="field-label">Name</span>
                  <input className={INPUT} maxLength={31} value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1"><span className="field-label">Floor ($)</span>
                    <input type="number" min={1} className={INPUT + " font-mono"} value={selected.floor} onChange={(e) => update(selected.id, { floor: Number(e.target.value) })} /></label>
                  <label className="grid gap-1"><span className="field-label">Buy now ($)</span>
                    <input type="number" min={1} className={INPUT + " font-mono"} value={selected.buyNow} onChange={(e) => update(selected.id, { buyNow: Number(e.target.value) })} /></label>
                </div>
                <Button size="small" variant="ghost" className="justify-self-start" onClick={() => { setPatches((ps) => ps.filter((p) => p.id !== selected.id)); setSelectedId(null); }}>
                  <Trash2 size={13} /> Remove patch
                </Button>
              </div>
            ) : <p className="text-sm text-[var(--muted)]">Select a patch on the canvas to name it and set its prices.</p>}
          </div>

          <div className="border-t-2 border-dashed border-[var(--soft)] pt-3 grid gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Patches</span><b className="font-mono">{patches.length}</b></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">If all sell at buy-now</span><b className="font-mono">{formatUsdc(buyNowTotal)}</b></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Bond (returned on delivery)</span><b className="font-mono">{formatUsdc(Number(bond) / 1e6)}</b></div>
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
          <Button variant="primary" onClick={publish} disabled={publishing || !!busy}>
            {step === "saving" ? "Saving details…" : step === "approving" ? "Approving bond…" : step === "creating" ? "Publishing on-chain…" : authenticated ? "Publish listing" : "Sign in to publish"}
          </Button>
          <p className="text-xs text-[var(--muted)]">Listings go live after a quick review by the Patched team.</p>
        </Card>
      </div>
    </main>
  );
}
