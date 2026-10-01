"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Check, ExternalLink, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EventCard } from "@/components/events/EventCard";
import { EventHeader } from "@/components/events/EventHeader";
import { EVENT_NAME_MAX_BYTES, eventNameBytes, slugify, slugProblem } from "@/lib/events";
import { cn } from "@/lib/utils";
import { CoverUpload } from "./CoverUpload";

export interface EventFormValues {
  name: string;
  slug: string;
  start: string;
  end: string;
  city: string;
  venue: string;
  description: string;
  website: string;
  x: string;
  bannerUrl: string;
}

export const EMPTY_EVENT: EventFormValues = { name: "", slug: "", start: "", end: "", city: "", venue: "", description: "", website: "", x: "", bannerUrl: "" };

/** Where a save is: creating on chain, saving the page, and the event's number once it exists on chain. */
export interface EventProgress {
  step: null | "chain" | "save";
  createdId: number | null;
  error: string | null;
}

const TEXTAREA = "w-full border-2 border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 resize-y";
const isHttps = (v: string) => !v || /^https:\/\/[^\s]+$/.test(v);

function validate(v: EventFormValues, mode: "create" | "edit"): Partial<Record<keyof EventFormValues, string>> {
  const e: Partial<Record<keyof EventFormValues, string>> = {};
  if (mode === "create") {
    if (!v.name.trim()) e.name = "Give the event a name.";
    else if (eventNameBytes(v.name.trim()) > EVENT_NAME_MAX_BYTES) e.name = `The name can be ${EVENT_NAME_MAX_BYTES} characters at most (accents and symbols count more).`;
    if (!v.start) e.start = "Pick the first day.";
    if (!v.end) e.end = "Pick the last day.";
    else if (v.start && v.end < v.start) e.end = "The last day can't be before the first.";
  }
  const slug = slugProblem(v.slug);
  if (slug) e.slug = slug;
  if (!isHttps(v.website.trim())) e.website = "Links start with https://";
  if (!isHttps(v.x.trim())) e.x = "Links start with https://";
  return e;
}

/**
 * The one form for making and editing an event page: cover, name and dates, place, about and links, with a live
 * preview of the Events card and the event page header. In edit mode the name and dates are read-only: they're
 * written on-chain when the event is created.
 */
export function EventForm({
  mode, previewId, initial = EMPTY_EVENT, progress, onSubmit, onCancel,
}: {
  mode: "create" | "edit";
  /** The event's number (edit) or the number it will get (create); picks the pastel colours. */
  previewId: number;
  initial?: EventFormValues;
  progress: EventProgress;
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<EventFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(mode === "edit" && !!initial.slug);
  const [tried, setTried] = useState(false);
  const busy = progress.step !== null;
  const errors = validate(v, mode);
  const set = (k: keyof EventFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setV((cur) => ({ ...cur, [k]: value, ...(k === "name" && !slugTouched ? { slug: slugify(value) } : {}) }));
  };
  const show = (k: keyof EventFormValues) => (tried || k === "slug") && errors[k];
  const retrying = mode === "create" && progress.createdId !== null;
  /** The name and dates are written on-chain, so they are fixed once the event exists. */
  const locked = mode === "edit" || retrying;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(errors).length) return;
    onSubmit(v);
  }

  const startMs = v.start ? Date.parse(v.start) : 0;
  const endMs = v.end ? Date.parse(v.end) + 86_399_000 : 0;
  const days = Math.ceil((startMs - Date.now()) / 86_400_000);
  const badge = startMs ? (
    <span className="inline-flex items-center rounded-full bg-black/80 px-3 py-1.5 text-xs font-bold text-white">
      {endMs < Date.now() ? "Ended" : startMs <= Date.now() ? "Happening now" : days <= 1 ? "Starts tomorrow" : `In ${days} days`}
    </span>
  ) : null;
  const chip = "btn-base btn-small pointer-events-none";

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] items-start">
      <div className="grid gap-5">
        <CoverUpload value={v.bannerUrl} name={v.name} seed={previewId} onChange={(url) => setV((c) => ({ ...c, bannerUrl: url }))} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={mode === "create" ? `Name (${EVENT_NAME_MAX_BYTES} characters at most)` : "Name"} error={show("name")} className="sm:col-span-2">
            <Input value={v.name} onChange={set("name")} placeholder="Token2049 Singapore" disabled={locked || busy} error={!!show("name")} autoFocus={mode === "create"} />
          </Field>
          <Field label="Starts" error={show("start")}>
            <Input type="date" value={v.start} onChange={set("start")} disabled={locked || busy} error={!!show("start")} />
          </Field>
          <Field label="Ends" error={show("end")}>
            <Input type="date" value={v.end} onChange={set("end")} min={v.start || undefined} disabled={locked || busy} error={!!show("end")} />
          </Field>
          {locked && <p className="sm:col-span-2 text-xs text-[var(--muted)] -mt-2">The name and dates are written on-chain when an event is created, so they can&apos;t change.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" error={show("city")}>
            <Input value={v.city} onChange={set("city")} maxLength={60} placeholder="Singapore" disabled={busy} />
          </Field>
          <Field label="Venue" error={show("venue")}>
            <Input value={v.venue} onChange={set("venue")} maxLength={80} placeholder="Marina Bay Sands" disabled={busy} />
          </Field>
          <Field label="Page address" error={show("slug")} className="sm:col-span-2" hint="Where people find it. Letters, numbers and dashes.">
            <span className="flex items-center gap-1.5">
              <span className="font-mono text-sm text-[var(--muted)]">/e/</span>
              <Input value={v.slug} maxLength={48} placeholder="token2049-singapore" disabled={busy} error={!!show("slug")}
                onChange={(e) => { setSlugTouched(true); set("slug")(e); }} />
            </span>
          </Field>
          <Field label="About" className="sm:col-span-2" hint={`${v.description.length}/600`}>
            <textarea className={TEXTAREA} rows={3} maxLength={600} value={v.description} onChange={set("description")} disabled={busy} placeholder="What the event is and who goes." />
          </Field>
          <Field label="Website" error={show("website")}>
            <Input value={v.website} onChange={set("website")} placeholder="https://" inputMode="url" disabled={busy} error={!!show("website")} />
          </Field>
          <Field label="X" error={show("x")}>
            <Input value={v.x} onChange={set("x")} placeholder="https://x.com/…" inputMode="url" disabled={busy} error={!!show("x")} />
          </Field>
        </div>

        {mode === "create" && (progress.step || progress.createdId !== null) && <Steps progress={progress} />}
        {progress.error && <p role="alert" className="rounded-xl bg-[var(--accent-soft)] border-[1.5px] border-[var(--accent)] p-3 text-sm">{progress.error}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" disabled={busy}>
            {busy && <Loader2 size={15} className="animate-spin" />}
            {progress.step === "chain" ? "Creating on Monad…" : progress.step === "save" ? "Saving page…" : retrying ? "Retry saving page" : mode === "create" ? "Create event" : "Save changes"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>{retrying ? "Close" : "Cancel"}</Button>
        </div>
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-4 min-w-0" aria-label="Preview">
        <span className="eyebrow">Preview</span>
        <div className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">Events list</span>
          <EventCard preview event={{ id: previewId, name: v.name.trim(), slug: v.slug || null, startsAt: v.start ? new Date(startMs).toISOString() : "", endsAt: v.end ? new Date(endMs).toISOString() : "", city: v.city.trim() || null, venue: v.venue.trim() || null, banner: v.bannerUrl || null, description: v.description.trim() || null, live: 0, listings: 0 }} />
        </div>
        <div className="grid gap-2">
          <span className="text-xs font-semibold text-[var(--muted)]">Event page</span>
          <Card className="!p-0 overflow-hidden">
            <Scaled>
              <EventHeader id={previewId} name={v.name.trim()} banner={v.bannerUrl || null} startsAt={startMs} endsAt={endMs} city={v.city.trim() || null} venue={v.venue.trim() || null} badge={badge}
                actions={<>
                  {v.website && <span className={chip}><Globe size={14} /> Website <ExternalLink size={12} /></span>}
                  {v.x && <span className={chip}>On X</span>}
                </>} />
            </Scaled>
          </Card>
          <p className="text-xs text-[var(--muted)]">Phones show a slightly taller crop, so keep what matters in the middle.</p>
        </div>
      </aside>
    </form>
  );
}

function Field({ label, error, hint, className, children }: { label: string; error?: string | false; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("grid gap-1.5 content-start", className)}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span role="alert" className="text-xs font-semibold text-[var(--red)]">{error}</span> : hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function Steps({ progress }: { progress: EventProgress }) {
  const chainDone = progress.createdId !== null;
  const rows = [
    { label: chainDone ? `Created on Monad as event #${progress.createdId}` : "Create on Monad", state: chainDone ? "done" : progress.step === "chain" ? "active" : "todo" },
    { label: "Save the page", state: progress.step === "save" ? "active" : "todo" },
  ] as const;
  return (
    <ol className="grid gap-1.5 list-none m-0 p-0 text-sm" aria-live="polite">
      {rows.map((r) => (
        <li key={r.label} className={cn("flex items-center gap-2", r.state === "todo" && "text-[var(--muted)]")}>
          <span className={cn("grid place-items-center size-5 rounded-full border-[1.5px] border-[var(--line)]", r.state === "done" && "bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]")}>
            {r.state === "done" ? <Check size={12} /> : r.state === "active" ? <Loader2 size={12} className="animate-spin" /> : null}
          </span>
          {r.label}
        </li>
      ))}
    </ol>
  );
}

/** Draws its children at the width the real page has, shrunk to fit the preview column. */
function Scaled({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 });
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !inner.current) return;
      const avail = box.current.clientWidth;
      // Laptop layout in the preview on laptops; on phones the column is already phone-sized, so show it as is.
      const design = window.matchMedia("(min-width: 640px)").matches ? 960 : avail;
      const scale = Math.min(1, avail / design);
      setFit({ scale, width: design, height: inner.current.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} style={{ height: fit.height || undefined }} className="overflow-hidden relative">
      <div ref={inner} className="origin-top-left bg-[var(--paper)] pb-4" style={{ width: fit.width || "100%", transform: `scale(${fit.scale})` }}>{children}</div>
    </div>
  );
}
