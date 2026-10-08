"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Car, Check, ChevronDown, Lightbulb, Loader2, Plus, RefreshCw, Shirt, Sparkles, Trash2, Wand2 } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData } from "@/components/surface/Patch";
import { Button } from "@/components/ui/Button";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { formatUsdc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StagePicker } from "@/components/market/StagePicker";
import { stageStyle, type PageStage } from "@/lib/market/page";
import { CHAIN_ID } from "@/lib/config";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { CAR_VIEW_LAYOUTS, DEFAULT_LAYOUTS, MODEL_SHOT_LAYOUTS } from "@/lib/market/layouts";
import type { SurfaceKind } from "@/lib/market/types";
import { useCreateListing } from "@/lib/market/useCreateListing";
import { defaultTiers } from "@/lib/market/tiers";
import { PATCH_TIERS, type PatchTier } from "@patched/shared";
import { DealTerms } from "@/components/studio/DealTerms";
import { defaultDraft, eventDays, planMilestones, planProblem, type DealDraft, type Kind } from "@/lib/market/dealPlan";

export interface StudioEvent {
  id: number;
  name: string;
  startsAt: number;
  endsAt: number;
}

/** Id of a view: "front" / "back" for people, "left" / "right" / "front" / "back" / "roof" for cars. */
type Side = string;

interface ViewImage {
  id: Side;
  label: string;
  image: string;
}

/** The car views the AI draws from one photo, in the order they're generated and shown. */
const CAR_VIEWS: { id: keyof typeof CAR_VIEW_LAYOUTS; label: string }[] = [
  { id: "left", label: "Left side" },
  { id: "right", label: "Right side" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "roof", label: "Roof" },
];

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
  tier?: PatchTier;
  perks?: string;
}

const SURFACE_OPTIONS: { kind: Kind; label: string; note: string; Icon: typeof Sparkles }[] = [
  { kind: "outfit", label: "Outfit", note: "What you wear at an event", Icon: Sparkles },
  { kind: "car", label: "Vehicle", note: "Car, van or bus, 1 to 3 event days", Icon: Car },
  { kind: "hoodie", label: "Team hoodie", note: "Your team at a hackathon", Icon: Shirt },
  { kind: "idea", label: "Your own idea", note: "A laptop lid, a booth wall, a board", Icon: Lightbulb },
];
/** Starting spots for an own idea: one big centre spot and two corners. The AI suggests better ones from the photo. */
const IDEA_LAYOUT = [
  { name: "Centre", x: 33, y: 36, w: 34, h: 22 },
  { name: "Top left", x: 8, y: 10, w: 24, h: 16 },
  { name: "Top right", x: 68, y: 10, w: 24, h: 16 },
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
const MIN = 60_000;
/** How long bidding runs is typed in (a number and a unit); these are one-tap shortcuts. Minutes are for demos only. */
const BID_UNITS = [
  { unit: "min", label: "minutes", ms: MIN },
  { unit: "hour", label: "hours", ms: 60 * MIN },
  { unit: "day", label: "days", ms: DAY },
] as const;
type BidUnit = (typeof BID_UNITS)[number]["unit"];
const BID_PRESETS: { n: number; unit: BidUnit; label: string; demo?: boolean }[] = [
  { n: 5, unit: "min", label: "5 min", demo: true },
  { n: 1, unit: "hour", label: "1 hour" },
  { n: 1, unit: "day", label: "1 day" },
  { n: 3, unit: "day", label: "3 days" },
  { n: 7, unit: "day", label: "7 days" },
];
/** The shortest and longest auction: a couple of minutes on the test network (for demos), an hour on the real one. */
const bidLimits = (demo: boolean) => ({ min: demo ? 2 * MIN : 60 * MIN, max: 30 * DAY });
const fmtDuration = (ms: number) => {
  const mins = Math.round(ms / MIN);
  if (mins % (24 * 60) === 0) return `${mins / (24 * 60)} day${mins === 24 * 60 ? "" : "s"}`;
  if (mins % 60 === 0) return `${mins / 60} hour${mins === 60 ? "" : "s"}`;
  return `${mins} min`;
};
const PROOF_STEPS = [
  { ms: 0, label: "Event dates" },
  { ms: 3 * MIN, label: "3 min apart" },
  { ms: 10 * MIN, label: "10 min apart" },
  { ms: 30 * MIN, label: "30 min apart" },
];
const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const INPUT = "w-full min-w-0 h-11 px-3.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]";
const AREA = "w-full min-w-0 px-3.5 py-2.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)] resize-y";
const PANEL = "rounded-3xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] shadow-[0_16px_48px_rgba(11,11,12,0.08)]";
const STEPS = [
  { id: "what", label: "What" },
  { id: "spots", label: "Spots" },
  { id: "deal", label: "Deal" },
  { id: "page", label: "Page" },
] as const;

let idSeq = 100;
const draft = (side: Side, s: { name: string; x: number; y: number; w: number; h: number; r?: number }, i = 0): DraftPatch => ({
  id: idSeq++, side, name: s.name, x: s.x, y: s.y, w: s.w, h: s.h, r: s.r ?? 0, floor: 10, buyNow: 50 + i * 10,
});

/** An offer made to this creator on X ("Patch anyone on X"), when they came here from it. */
export interface StudioOffer {
  id: string;
  amount: number;
  brand: string;
  eventId: number;
}

export function StudioEditor({ events, minBond, newCreatorCap, initialEventId, offer }: { events: StudioEvent[]; minBond: string; newCreatorCap: string; initialEventId?: number; offer?: StudioOffer | null }) {
  const router = useRouter();
  const { authenticated, login, walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const { create, step, error } = useCreateListing();

  const [kind, setKind] = useState<Kind>("outfit");
  const surface: SurfaceKind = kind === "idea" ? "outfit" : kind;
  const [ideaText, setIdeaText] = useState("");
  const [deal, setDeal] = useState<DealDraft>(() => defaultDraft("outfit"));
  const [title, setTitle] = useState("");
  const [eventId, setEventId] = useState<number>(() => (initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : events[0]?.id ?? 0));
  const [bidAmount, setBidAmount] = useState("3");
  const [bidUnit, setBidUnit] = useState<BidUnit>("day");
  // Demo timing: minute-long auctions and proofs a few minutes apart, so a whole listing can be shown in one sitting.
  const [proofStepMs, setProofStepMs] = useState(0);
  const demo = CHAIN_ID === 10143;
  const bidMs = Math.round((Number(bidAmount) || 0) * (BID_UNITS.find((u) => u.unit === bidUnit)?.ms ?? DAY));
  const bidLimit = bidLimits(demo);
  // The clock differs between server and browser, so "Ends ..." is shown only once the page is in the browser.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [styleKey, setStyleKey] = useState<string>("current");
  const [customStyle, setCustomStyle] = useState("");
  const [aiStyles, setAiStyles] = useState<string[]>([]);
  const [views, setViews] = useState<ViewImage[]>([]);
  const [carDescription, setCarDescription] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("front");
  const [busy, setBusy] = useState<null | string>(null);

  // The first spots get fixed ids (1, 2, 3) so the server and the browser render the same thing; the shared
  // counter only numbers spots added later, in the browser.
  const [patches, setPatches] = useState<DraftPatch[]>(() => DEFAULT_LAYOUTS.outfit.slice(0, 3).map((s, i) => ({ ...draft("front", s, i), id: i + 1 })));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [headline, setHeadline] = useState("");
  const [story, setStory] = useState("");
  // What sits behind the photo on the page and in the feed. Saved with the page once the listing exists.
  const [stage, setStage] = useState<PageStage | undefined>(undefined);
  const [faq, setFaq] = useState<{ q: string; a: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const reduce = useReducedMotion();

  // People (outfit, hoodie) get the AI model shots; vehicles get every side; an own idea gets one clean photo.
  const person = kind === "outfit" || kind === "hoodie";
  const isIdea = kind === "idea";
  const bond = BigInt(minBond);
  const cap = Number(newCreatorCap) / 1e6;
  const event = events.find((e) => e.id === eventId);
  const buyNowTotal = patches.reduce((s, p) => s + p.buyNow, 0);
  const sidePatches = patches.filter((p) => p.side === side);
  const plan = useMemo(() => planMilestones({ kind, draft: deal, biddingEndsAt: Date.now() + bidMs, event, demoStepMs: demo && proofStepMs ? proofStepMs : undefined }), [kind, deal, bidMs, event, demo, proofStepMs]);
  const publishing = step === "saving" || step === "approving" || step === "creating";
  const styleText = styleKey === "custom" ? customStyle.trim() : styleKey.startsWith("ai:") ? aiStyles[Number(styleKey.slice(3))] : styleKey;
  const canvas = views.find((v) => v.id === side)?.image ?? null;
  const viewLabel = (id: Side) => views.find((v) => v.id === id)?.label ?? id;
  const putView = (v: ViewImage) =>
    setViews((cur) => {
      const order = person ? ["front", "back"] : isIdea ? ["front"] : CAR_VIEWS.map((c) => c.id as string);
      return [...cur.filter((x) => x.id !== v.id), v].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    });

  function pickSurface(next: Kind) {
    if (next === kind) return;
    setKind(next);
    setDeal(defaultDraft(next));
    setPhotoUrl(null);
    setViews([]);
    setCarDescription(null);
    setSide(next === "car" ? "left" : "front");
    setAiStyles([]);
    const layout = next === "idea" ? IDEA_LAYOUT : DEFAULT_LAYOUTS[next].slice(0, 3);
    setPatches(layout.map((s) => draft(next === "car" ? "left" : "front", s)));
    setSelectedId(null);
  }

  async function postJson<T>(url: string, body: unknown): Promise<T> {
    const res = await authedFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
    return json;
  }

  async function onPhoto(file: File) {
    if (!authenticated) return login();
    if (isIdea && !ideaText.trim()) return toast('Say what it is first, like "Laptop lid on stage".');
    try {
      setBusy("Uploading your photo…");
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "canvases");
      const up = await authedFetch("/api/uploads", { method: "POST", body: form });
      const upJson = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !upJson.url) throw new Error(upJson.error ?? "Upload failed.");
      setPhotoUrl(upJson.url);
      setViews([]);

      if (person) {
        setBusy(null);
        postJson<{ styles: string[] }>("/api/ai/styles", { photoUrl: upJson.url })
          .then(({ styles }) => setAiStyles(styles))
          .catch(() => {});
      } else if (isIdea) {
        await generateIdeaCanvas(upJson.url);
      } else {
        setBusy(null);
        await generateCarViews(upJson.url);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  /** Ask the vision model for spots on one view; fall back to the fixed layout for that framing. */
  async function autoLayout(url: string, which: Side) {
    const fallback = person
      ? MODEL_SHOT_LAYOUTS[which === "back" ? "back" : "front"]
      : isIdea ? IDEA_LAYOUT : CAR_VIEW_LAYOUTS[which as keyof typeof CAR_VIEW_LAYOUTS] ?? DEFAULT_LAYOUTS.car;
    const count = person ? (which === "back" ? 2 : 4) : isIdea ? 3 : which === "left" || which === "right" ? 4 : 2;
    let spots: { name: string; x: number; y: number; w: number; h: number; r?: number }[] = fallback;
    try {
      const label = person || isIdea ? which : CAR_VIEWS.find((c) => c.id === which)?.label;
      const { patches: s } = await postJson<{ patches: typeof spots }>("/api/ai/layout", { canvasUrl: url, surface, count, view: label });
      if (s?.length) spots = s;
    } catch {
      /* keep fallback */
    }
    setPatches((ps) => [...ps.filter((p) => p.side !== which), ...spots.map((s, i) => draft(which, s, i))]);
  }

  /**
   * One car photo → every side. The first view also returns the AI's description of the car, which goes with
   * the other views (plus the first view as a reference image) so they all show the same car.
   * Pass `only` to redraw a single view.
   */
  async function generateCarViews(photo: string, only?: Side) {
    const todo = only ? CAR_VIEWS.filter((v) => v.id === only) : CAR_VIEWS;
    let description = only ? carDescription : null;
    let reference = only ? views.find((v) => v.id !== only)?.image : undefined;
    try {
      for (const [i, v] of todo.entries()) {
        setBusy(only ? `Redrawing the ${v.label.toLowerCase()}…` : `Drawing the ${v.label.toLowerCase()}… (${i + 1} of ${todo.length})`);
        const res = await postJson<{ url: string; description: string }>("/api/ai/car-view", {
          photoUrl: photo, view: v.id, ...(description ? { description } : {}), ...(reference ? { referenceUrl: reference } : {}),
        });
        description = res.description;
        setCarDescription(res.description);
        reference ??= res.url;
        putView({ id: v.id, label: v.label, image: res.url });
        if (i === 0) setSide(v.id);
        // Spots for this view load in the background while the next view is drawn.
        void autoLayout(res.url, v.id);
      }
      if (!only) toast("Every side of your car is ready. Adjust the patches, then set prices.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  /** Own idea: the photo, whitewashed by the AI so logos can go on it, as one view. */
  async function generateIdeaCanvas(photo: string) {
    try {
      setBusy("Cleaning up your photo…");
      const { canvasUrl } = await postJson<{ canvasUrl: string }>("/api/ai/canvas", { imageUrl: photo, surface: "outfit", idea: ideaText.trim() });
      setViews([{ id: "front", label: "Front", image: canvasUrl }]);
      setSide("front");
      setBusy("Placing spots…");
      await autoLayout(canvasUrl, "front");
      toast("Your canvas is ready. Adjust the spots, then set the deal.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function generateLook() {
    if (!photoUrl) return toast("Upload a photo of yourself first.");
    if (!styleText) return toast("Describe the outfit you want.");
    try {
      setBusy("Creating your front view… (1 of 2)");
      const f = await postJson<{ url: string }>("/api/ai/model-shot", { photoUrl, style: styleText, side: "front" });
      setViews([{ id: "front", label: "Front", image: f.url }]);
      setSide("front");
      setBusy("Creating your back view… (2 of 2)");
      const b = await postJson<{ url: string }>("/api/ai/model-shot", { photoUrl, style: styleText, side: "back", frontUrl: f.url });
      putView({ id: "back", label: "Back", image: b.url });
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

  /** What still needs doing on a step, or null when it's ready. */
  function stepProblem(i: number): string | null {
    if (i === 0) {
      if (isIdea && !ideaText.trim()) return 'Say what your idea is, like "Laptop lid on stage".';
      if (!title.trim()) return "Give your listing a title.";
      if (bidMs < bidLimit.min) return `Bidding has to run at least ${fmtDuration(bidLimit.min)}.`;
      if (bidMs > bidLimit.max) return `Bidding can run at most ${fmtDuration(bidLimit.max)}.`;
    }
    if (i === 1) {
      if (!patches.length) return "Add at least one spot.";
      if (patches.some((p) => !(p.floor > 0) || p.buyNow < p.floor)) return "Each spot needs a floor above $0 and a buy-now at or above its floor.";
    }
    if (i === 2) return planProblem(plan);
    return null;
  }

  function goTo(i: number) {
    setStepIdx(i);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function next() {
    const issue = stepProblem(stepIdx);
    if (issue) return toast(issue);
    goTo(stepIdx + 1);
  }

  async function publish() {
    if (!authenticated) return login();
    // Send the creator back to the first step that isn't ready.
    for (let i = 0; i < STEPS.length - 1; i++) {
      const issue = stepProblem(i);
      if (issue) {
        goTo(i);
        return toast(issue);
      }
    }
    // Patches grouped by view, in view order (the contract's patch ids follow this order).
    const viewOrder = views.length ? views.map((v) => v.id) : [...new Set(patches.map((p) => p.side))];
    const ordered = viewOrder.flatMap((id) => patches.filter((p) => p.side === id));
    const autoTiers = defaultTiers(ordered.map((p) => p.w * p.h));
    const id = await create({
      metadata: {
        version: 1,
        title: title.trim(),
        surface,
        ...(photoUrl && !person ? { sourceImage: photoUrl } : {}),
        ...(views[0] ? { canvasImage: views[0].image } : {}),
        ...(person && views.find((v) => v.id === "back") ? { canvasImageBack: views.find((v) => v.id === "back")!.image } : {}),
        ...(views.length ? { views } : {}),
        ...(person && views.length && styleText ? { style: styleText } : {}),
        ...(!person && carDescription ? { style: carDescription } : {}),
        patches: ordered.map((p, i) => ({
          id: i, name: p.name, side: p.side, x: p.x, y: p.y, w: p.w, h: p.h, rotation: p.r,
          tier: p.tier ?? autoTiers[i], ...(p.perks?.trim() ? { perks: p.perks.trim() } : {}),
        })),
        ...(headline.trim() ? { headline: headline.trim() } : {}),
        ...(story.trim() ? { story: story.trim() } : {}),
        ...(faq.some((f) => f.q.trim() && f.a.trim()) ? { faq: faq.filter((f) => f.q.trim() && f.a.trim()) } : {}),
        milestones: plan.map((m) => ({ name: m.name, bps: m.bps })),
        deal: {
          ...(isIdea ? { idea: ideaText.trim() } : {}),
          ...(kind === "car" ? { vehicle: deal.vehicle, days: deal.days, place: deal.place } : { days: eventDays(event) }),
          payout: deal.payout,
          deliverables: deal.deliverables,
        },
      },
      surfaceIndex: surface === "outfit" ? 0 : surface === "car" ? 1 : 2,
      eventId,
      biddingEndsAt: Math.floor((Date.now() + bidMs) / 1000),
      bond,
      floors: ordered.map((p) => BigInt(Math.round(p.floor * 1e6))),
      buyNows: ordered.map((p) => BigInt(Math.round(p.buyNow * 1e6))),
      deadlines: plan.map((m) => Math.floor(m.deadline / 1000)),
    });
    if (id) {
      if (stage) {
        await authedFetch(`/api/listings/${id}/page`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ stage }) }).catch(() => {});
      }
      toast("Listing created. It is live and open for bids.");
      router.push(`/${walletAddress?.toLowerCase()}/${id}`);
    }
  }

  const fromPrice = patches.length ? Math.min(...patches.map((p) => p.floor)) : 0;
  const firstView = views[0]?.id ?? (surface === "car" ? "left" : "front");
  const colorOf = (p: DraftPatch) => PASTELS[patches.filter((x) => x.side === p.side).indexOf(p) % PASTELS.length];
  const previewPatches: PatchData[] = patches.filter((p) => p.side === firstView).map((p) => ({
    id: p.id, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r, c: colorOf(p),
  }));
  const figurePatches: PatchData[] = sidePatches.map((p) => ({
    id: p.id, name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, r: p.r, floor: p.floor, c: colorOf(p),
  }));
  const last = stepIdx === STEPS.length - 1;
  const stepId = STEPS[stepIdx].id;

  return (
    <main className="wrap pt-8 pb-24">
      <div className="mb-6 grid gap-4">
        <div>
          <span className="eyebrow">Studio</span>
          <h1 className="font-extrabold text-4xl tracking-tight mt-1">Create a listing</h1>
        </div>
        {offer && (
          <p className="rounded-2xl bg-[var(--accent-soft)] p-3.5 text-sm" role="status">
            <b>{offer.brand} offered you ${offer.amount.toLocaleString("en-US")}.</b> List at {events.find((e) => e.id === offer.eventId)?.name ?? "the event"} and
            price one spot&apos;s buy-now at ${offer.amount.toLocaleString("en-US")} or less: the offer buys it as soon as your listing is live.
          </p>
        )}
        <Stepper step={stepIdx} onPick={goTo} />
      </div>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <section className={cn(PANEL, "p-5 sm:p-7 min-w-0")}>
          <motion.div key={stepId} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="grid gap-6">
            {stepId === "what" && (
              <>
                <StepHead title="What are you selling?" sub="Pick where the logos go. Each spot on it becomes its own auction." />
                <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="What you're selling">
                  {SURFACE_OPTIONS.map((o) => (
                    <button key={o.kind} type="button" role="radio" aria-checked={kind === o.kind} onClick={() => pickSurface(o.kind)}
                      className={cn("flex gap-3.5 items-center text-left p-4 rounded-2xl border-2 transition-colors",
                        kind === o.kind ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--soft)] hover:border-[var(--muted)]")}>
                      <span className="w-11 h-11 rounded-xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] grid place-items-center flex-none"><o.Icon size={20} /></span>
                      <span className="grid gap-0.5 min-w-0"><b>{o.label}</b><span className="text-sm text-[var(--muted)]">{o.note}</span></span>
                    </button>
                  ))}
                </div>
                {isIdea && (
                  <Field label="What is it?" hint="The AI uses this to clean up your photo.">
                    <input className={INPUT} value={ideaText} maxLength={60} placeholder="Laptop lid on stage" onChange={(e) => setIdeaText(e.target.value)} />
                  </Field>
                )}
                <Field label="Title" hint="The first thing brands read.">
                  <input className={INPUT} value={title} maxLength={80} placeholder={kind === "car" ? "Ravi's van at Token2049" : isIdea ? "My laptop lid on stage" : "My Token2049 fit"}
                    onChange={(e) => setTitle(e.target.value)} />
                </Field>
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Event">
                    <select className={INPUT} value={eventId} onChange={(e) => setEventId(Number(e.target.value))}>
                      {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      <option value={0}>No specific event</option>
                    </select>
                  </Field>
                  <div className="grid gap-1.5 min-w-0">
                    <span className="field-label">Bidding runs for</span>
                    <div className="flex gap-2 min-w-0">
                      <input
                        inputMode="decimal"
                        aria-label="How long bidding runs"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
                        className={cn(INPUT, "w-24 flex-none font-mono text-center", bidMs < bidLimit.min || bidMs > bidLimit.max ? "!border-[var(--red)]" : "")}
                      />
                      <Pills value={bidUnit} onPick={setBidUnit} label="Unit" options={BID_UNITS.filter((u) => demo || u.unit !== "min").map((u) => ({ value: u.unit, label: u.label }))} />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {BID_PRESETS.filter((q) => demo || !q.demo).map((q) => (
                        <button key={q.label} type="button" onClick={() => { setBidAmount(String(q.n)); setBidUnit(q.unit); }}
                          className="h-7 px-2.5 rounded-full border-[1.5px] border-[var(--soft)] text-xs font-semibold hover:border-[var(--muted)]">{q.label}</button>
                      ))}
                    </div>
                    <span className={cn("text-xs", bidMs < bidLimit.min || bidMs > bidLimit.max ? "text-[var(--red)]" : "text-[var(--muted)]")}>
                      {bidMs < bidLimit.min ? `At least ${fmtDuration(bidLimit.min)}.` : bidMs > bidLimit.max ? `At most ${fmtDuration(bidLimit.max)}.` : `Ends ${now ? new Date(now + bidMs).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}`}
                    </span>
                  </div>
                </div>
              </>
            )}

            {stepId === "spots" && (
              <>
                <StepHead
                  title={person ? "Make your look, then place the spots" : kind === "car" ? "Draw your vehicle, then place the spots" : "Add a photo, then place the spots"}
                  sub="Drag a spot to move it and its corner to resize. Tap one to name it and set its prices." />
                <div className={cn("grid gap-6 items-start", surface !== "car" && "md:grid-cols-[minmax(0,1fr)_280px]")}>
                  <div className="grid gap-3 min-w-0">
                    <div className="flex gap-2 flex-wrap items-center">
                      {views.length > 1 && (
                        <Seg options={views.map((v) => ({ value: v.id, label: v.label }))} value={side} onChange={(v) => { setSide(v); setSelectedId(null); }} size="small" />
                      )}
                      <span className="flex-1" />
                      {!person && photoUrl && canvas && (
                        <Button size="small" variant="ghost" onClick={() => generateCarViews(photoUrl, side)} disabled={!!busy}><RefreshCw size={14} /> Redraw</Button>
                      )}
                      {canvas && <Button size="small" variant="ghost" onClick={() => autoLayout(canvas, side)} disabled={!!busy}><Wand2 size={14} /> AI spots</Button>}
                      <Button size="small" onClick={addPatch}><Plus size={14} /> Add spot</Button>
                    </div>
                    <div className="relative rounded-2xl bg-[var(--stage)] p-4 sm:p-6">
                      <div className={surface === "car" ? "max-w-[620px] mx-auto" : isIdea ? "max-w-[460px] mx-auto" : "max-w-[320px] mx-auto"}>
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
                      {busy && (
                        <div className="absolute inset-0 rounded-2xl bg-[var(--card)]/95 grid place-items-center text-center p-6">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin" />
                            <b className="text-xl">{busy}</b>
                            <span className="text-sm text-[var(--muted)]">Each image takes about 10 to 20 seconds.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-6 min-w-0">
                    <div className="grid gap-2.5">
                      <span className="field-label">{person ? "A photo of you" : isIdea ? "A photo of it" : "A photo of your vehicle"}</span>
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
                        className="w-full flex gap-3 items-center rounded-2xl border-[1.5px] border-dashed border-[var(--line)] p-3 bg-[var(--paper)] hover:border-[var(--accent)] text-left disabled:opacity-60">
                        <span className="w-11 h-11 rounded-xl bg-[var(--soft)] grid place-items-center overflow-hidden flex-none">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {photoUrl ? <img src={photoUrl} alt="Your photo" className="w-full h-full object-cover" /> : <Camera size={20} />}
                        </span>
                        <span className="text-sm min-w-0"><b>{photoUrl ? "Change photo" : "Upload photo"}</b>
                          <span className="block text-[var(--muted)] text-xs">{person ? "A clear selfie is enough" : isIdea ? "AI cleans it up so logos fit" : "One photo from the front corner. AI draws every side"}</span></span>
                      </button>
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ""; }} />
                      {!photoUrl && <p className="text-xs text-[var(--muted)]">No photo yet? You can place spots on the drawing and add a photo later.</p>}

                      {person && photoUrl && (
                        <div className="grid gap-2 pt-1">
                          <span className="field-label">What will you wear?</span>
                          <div className="flex flex-wrap gap-1.5">
                            {STYLE_CHOICES.map((c) => (
                              <button key={c.key} type="button" onClick={() => setStyleKey(c.key)} aria-pressed={styleKey === c.key}
                                className="text-xs font-semibold border-[1.5px] border-[var(--soft)] rounded-full px-2.5 py-1 hover:border-[var(--muted)] aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)] aria-pressed:border-[var(--ink)]">
                                {c.label}
                              </button>
                            ))}
                          </div>
                          {aiStyles.length > 0 && (
                            <div className="grid gap-1.5">
                              <span className="text-xs text-[var(--muted)] flex items-center gap-1"><Sparkles size={12} /> Ideas for you</span>
                              {aiStyles.map((c, i) => (
                                <button key={c} type="button" onClick={() => setStyleKey(`ai:${i}`)} aria-pressed={styleKey === `ai:${i}`}
                                  className="text-left text-xs border-[1.5px] border-[var(--soft)] rounded-xl px-2.5 py-1.5 aria-pressed:bg-[var(--accent-soft)] aria-pressed:border-[var(--accent)]">
                                  {c}
                                </button>
                              ))}
                            </div>
                          )}
                          <input className={INPUT + " text-sm"} placeholder="Or describe your own, e.g. a button-down shirt and jeans" value={customStyle} maxLength={120} aria-label="Describe your outfit"
                            onFocus={() => setStyleKey("custom")} onChange={(e) => { setCustomStyle(e.target.value); setStyleKey("custom"); }} />
                          <Button variant="primary" onClick={generateLook} disabled={!!busy} className="justify-center">
                            <Wand2 size={15} /> {views.length ? "Make it again" : "Make my look"}
                          </Button>
                          <p className="text-xs text-[var(--muted)]">AI makes a front and back view of you in plain white, ready for logos. Your face is kept automatically, so describe only the clothes.</p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <div className="flex justify-between items-baseline">
                        <span className="field-label">Spots and prices</span>
                        <span className="text-xs text-[var(--muted)]">{patches.length} of 16</span>
                      </div>
                      <div className={cn("grid gap-2", surface === "car" && "sm:grid-cols-2")}>
                        {patches.map((p) => {
                          const open = p.id === selectedId;
                          return (
                            <div key={p.id} className={cn("rounded-2xl border-[1.5px] transition-colors", open ? "border-[var(--accent)]" : "border-[var(--soft)]")}>
                              <button type="button" aria-expanded={open} onClick={() => { setSelectedId(open ? null : p.id); if (p.side !== side) setSide(p.side); }}
                                className="w-full flex items-center gap-2.5 px-3 h-11 text-left">
                                <span className="w-3 h-3 rounded-[4px] flex-none border border-black/20" style={{ background: `var(--${colorOf(p)})` }} />
                                <b className="flex-1 min-w-0 truncate text-sm">{p.name || "Untitled spot"}</b>
                                {views.length > 1 && <span className="text-[11px] text-[var(--muted)] flex-none">{viewLabel(p.side)}</span>}
                                <span className="font-mono text-xs text-[var(--muted)] flex-none">${p.floor}+</span>
                                <ChevronDown size={14} className={cn("flex-none text-[var(--muted)] transition-transform", open && "rotate-180")} />
                              </button>
                              {open && (
                                <div className="grid gap-2.5 px-3 pb-3">
                                  <Field label="Name">
                                    <input className={INPUT} maxLength={31} value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} />
                                  </Field>
                                  <div className="grid grid-cols-2 gap-2">
                                    <Field label="Floor ($)">
                                      <input type="number" min={1} className={INPUT + " font-mono"} value={p.floor} onChange={(e) => update(p.id, { floor: Number(e.target.value) })} />
                                    </Field>
                                    <Field label="Buy now ($)">
                                      <input type="number" min={1} className={INPUT + " font-mono"} value={p.buyNow} onChange={(e) => update(p.id, { buyNow: Number(e.target.value) })} />
                                    </Field>
                                  </div>
                                  <Field label="Tier">
                                    <select className={INPUT} value={p.tier ?? ""} onChange={(e) => update(p.id, { tier: (e.target.value || undefined) as PatchTier | undefined })}>
                                      <option value="">Auto (by size)</option>
                                      {(Object.keys(PATCH_TIERS) as PatchTier[]).map((t) => <option key={t} value={t}>{PATCH_TIERS[t].label}</option>)}
                                    </select>
                                  </Field>
                                  <Field label="What the brand gets" hint="Optional">
                                    <input className={INPUT} maxLength={120} value={p.perks ?? ""} placeholder="Front and centre in every photo" onChange={(e) => update(p.id, { perks: e.target.value })} />
                                  </Field>
                                  <button type="button" className="justify-self-start text-xs font-semibold text-[var(--muted)] hover:text-[var(--red)] inline-flex items-center gap-1.5"
                                    onClick={() => { setPatches((ps) => ps.filter((x) => x.id !== p.id)); setSelectedId(null); }}>
                                    <Trash2 size={13} /> Remove spot
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="text-[var(--muted)]">If every spot sells at buy-now</span>
                        <b className="font-mono">{formatUsdc(buyNowTotal)}</b>
                      </div>
                      {buyNowTotal > cap && <p className="text-xs text-[var(--accent-text)]">First listings are capped at {formatUsdc(cap)} in buy-now prices until you complete one delivery.</p>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {stepId === "deal" && (
              <>
                <StepHead title="Set your deal" sub="How you get paid and what every brand gets. Brands see all of this before they bid." />
                <DealTerms kind={kind} draft={deal} onChange={setDeal} plan={plan} eventName={event?.name ?? null} />
                {demo && (
                  <div className="grid gap-2 rounded-2xl bg-[var(--soft)] p-4">
                    <span className="field-label">Demo timing <span className="font-normal text-[var(--muted)]">(test network only)</span></span>
                    <p className="text-sm text-[var(--muted)]">Show the whole flow in minutes: each proof is due this long after the last one, starting when bidding ends.</p>
                    <Pills value={proofStepMs} onPick={setProofStepMs} label="Time between proofs" options={PROOF_STEPS.map((o) => ({ value: o.ms, label: o.label }))} />
                  </div>
                )}
              </>
            )}

            {stepId === "page" && (
              <>
                <StepHead title="Your sponsor page" sub="Optional. A few lines in your voice help brands pick you. You can edit this later." />
                <Field label="Headline">
                  <input className={INPUT} maxLength={80} value={headline} onChange={(e) => setHeadline(e.target.value)}
                    placeholder={person ? "Walking billboard for your brand" : "Your logo, driving around Bengaluru"} />
                </Field>
                <div className="grid gap-1.5">
                  <span className="field-label">Background behind the photo</span>
                  <p className="text-xs text-[var(--muted)]">Shows on your page and in the feed. Pick a colour or use your own picture; you can change it later with Edit page.</p>
                  <StagePicker value={stage} onChange={setStage} />
                </div>
                <Field label="Your story">
                  <textarea className={AREA} rows={4} maxLength={800} value={story} onChange={(e) => setStory(e.target.value)}
                    placeholder="Who you are, why you're doing this, and what brands get from you." />
                </Field>
                <div className="grid gap-2">
                  <span className="field-label">Questions brands might ask</span>
                  {faq.map((f, i) => (
                    <div key={i} className="grid gap-2 rounded-2xl border-[1.5px] border-[var(--soft)] p-3">
                      <input className={INPUT} maxLength={120} placeholder="Question" aria-label={`Question ${i + 1}`} value={f.q}
                        onChange={(e) => setFaq((all) => all.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                      <textarea className={AREA} rows={2} maxLength={400} placeholder="Answer" aria-label={`Answer ${i + 1}`} value={f.a}
                        onChange={(e) => setFaq((all) => all.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
                      <button type="button" className="text-xs font-semibold text-[var(--muted)] justify-self-start hover:text-[var(--red)] inline-flex items-center gap-1.5"
                        onClick={() => setFaq((all) => all.filter((_, j) => j !== i))}><Trash2 size={13} /> Remove</button>
                    </div>
                  ))}
                  {faq.length < 6 && (
                    <button type="button" className="justify-self-start text-sm font-semibold inline-flex items-center gap-1.5 hover:text-[var(--accent-text)]"
                      onClick={() => setFaq((all) => [...all, { q: "", a: "" }])}><Plus size={14} /> Add a question</button>
                  )}
                </div>
                <div className="grid gap-1.5 text-sm rounded-2xl bg-[var(--soft)] p-4">
                  <b className="text-base mb-1">Before you publish</b>
                  <Row label="Spots" value={String(patches.length)} />
                  <Row label="If every spot sells at buy-now" value={formatUsdc(buyNowTotal)} />
                  <Row label="Your stake, returned when you deliver" value={formatUsdc(Number(bond) / 1e6)} />
                  <p className="text-xs text-[var(--muted)] mt-1">Listings go live after a quick review by the Patched team.</p>
                </div>
                {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}
              </>
            )}
          </motion.div>

          <div className="flex items-center justify-between gap-3 mt-7 pt-5 border-t-[1.5px] border-[var(--soft)]">
            {stepIdx > 0 ? (
              <button type="button" onClick={() => goTo(stepIdx - 1)} className="h-11 px-4 rounded-full font-semibold inline-flex items-center gap-2 hover:bg-[var(--soft)]">
                <ArrowLeft size={16} /> Back
              </button>
            ) : <span />}
            {last ? (
              <Button variant="primary" className="h-12 px-6 text-base" onClick={publish} disabled={publishing || !!busy}>
                {step === "saving" ? "Saving details…" : step === "approving" ? "Approving your stake…" : step === "creating" ? "Publishing on-chain…" : authenticated ? "Publish listing" : "Sign in to publish"}
              </Button>
            ) : (
              <Button variant="primary" className="h-12 px-6 text-base" onClick={next} disabled={!!busy}>
                Continue to {STEPS[stepIdx + 1].label.toLowerCase()} <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </section>

        {/* What brands will see, updating as the creator goes. */}
        <aside className="grid gap-3 lg:sticky lg:top-6">
          <span className="eyebrow">What brands see</span>
          <div className={cn(PANEL, "overflow-hidden")}>
            <div className="bg-[var(--stage)] h-[240px] p-4 flex items-center justify-center overflow-hidden" style={stageStyle(stage)}>
              <SurfaceFigure surface={surface} imageUrl={views[0]?.image ?? null} patches={previewPatches} mode="static" showPrices={false}
                className={surface === "car" ? "w-full" : "h-full !w-auto max-w-full"} />
            </div>
            <div className="p-5 grid gap-3">
              <div>
                <b className="text-lg leading-tight block">{title.trim() || "Your listing"}</b>
                <span className="text-sm text-[var(--muted)]">
                  {kind === "car" ? `${deal.days} event day${deal.days > 1 ? "s" : ""}, ${deal.place === "loop" ? "looping the venue" : "parked at the venue"}` : isIdea ? (ideaText.trim() || "Your own idea") : SURFACE_OPTIONS.find((o) => o.kind === kind)?.label}
                  {event ? ` · ${event.name}` : ""}
                </span>
              </div>
              <p className="text-sm">
                {patches.length} spot{patches.length === 1 ? "" : "s"} from <b className="font-mono">{formatUsdc(fromPrice)}</b>
                {" · "}{plan.length === 1 ? "paid in full after the event" : `paid in ${plan.length} parts`}
              </p>
              <div className="flex h-2 rounded-full overflow-hidden gap-[2px]" aria-hidden="true">
                {plan.map((m, i) => <span key={i} style={{ width: `${m.bps / 100}%`, background: ["var(--p3)", "var(--p4)", "var(--p2)", "var(--p1)"][i % 4] }} />)}
              </div>
              {deal.deliverables.length > 0 && (
                <ul className="grid gap-1.5 text-sm list-none m-0 p-0">
                  {deal.deliverables.map((d) => <li key={d} className="flex gap-2 items-start"><Check size={15} className="text-[var(--green)] flex-none mt-0.5" /> {d}</li>)}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stepper({ step, onPick }: { step: number; onPick: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2 list-none m-0 p-0" aria-label="Steps">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 flex-none">
          {i > 0 && <span className={cn("w-3 sm:w-10 h-[1.5px]", i <= step ? "bg-[var(--ink)]" : "bg-[var(--soft)]")} aria-hidden="true" />}
          <button type="button" onClick={() => onPick(i)} aria-current={i === step ? "step" : undefined}
            className={cn("h-9 pl-1.5 pr-1.5 sm:pr-3.5 aria-[current=step]:pr-3.5 rounded-full inline-flex items-center gap-2 text-sm font-semibold transition-colors",
              i === step ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-[var(--soft)]", i > step && "text-[var(--muted)]")}>
            <span className={cn("w-6 h-6 rounded-full grid place-items-center text-xs font-bold",
              i === step ? "bg-[var(--accent)] text-[#0B0B0C]" : i < step ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-[var(--soft)]")}>
              {i < step ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            {/* On phones only the current step shows its name. */}
            <span className={cn(i !== step && "sr-only sm:not-sr-only")}>{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function StepHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="grid gap-1">
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h2>
      <p className="text-[var(--muted)]">{sub}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 min-w-0">
      <span className="flex items-baseline justify-between gap-2">
        <span className="field-label">{label}</span>
        {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Pills<T extends number | string>({ value, options, onPick, label }: { value: T; options: { value: T; label: string }[]; onPick: (v: T) => void; label: string }) {
  return (
    <span className="flex p-1 rounded-full bg-[var(--soft)]" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} onClick={() => onPick(o.value)}
          className={cn("flex-1 h-9 px-3 rounded-full text-sm font-bold transition-colors whitespace-nowrap", value === o.value ? "bg-[var(--card)] shadow-[0_1px_4px_rgba(11,11,12,0.15)]" : "text-[var(--muted)]")}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3"><span className="text-[var(--muted)]">{label}</span><b className="font-mono">{value}</b></div>
  );
}
