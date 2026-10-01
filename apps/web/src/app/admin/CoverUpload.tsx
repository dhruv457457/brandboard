"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Replace, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EventCover } from "@/components/events/EventCover";
import { useAuthedFetch } from "@/lib/authedFetch";
import { COVER_HINT, COVER_MAX_BYTES, COVER_MIN, COVER_TYPES } from "@/lib/events";
import { cn } from "@/lib/utils";

/** Natural size of an image file, without uploading it. */
function readSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("That file isn't an image we can read.")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/**
 * Cover image for an event: drop a file or click, checked here (type, size, dimensions) before it is uploaded,
 * then shown in the crop the event page uses. Replace and Remove sit on the image.
 */
export function CoverUpload({ value, name, seed, onChange }: { value: string; name: string; seed: number; onChange: (url: string) => void }) {
  const authedFetch = useAuthedFetch();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function take(file: File) {
    setError(null);
    setNote(null);
    if (!(COVER_TYPES as readonly string[]).includes(file.type)) return setError("Use a PNG, JPG or WebP image.");
    if (file.size > COVER_MAX_BYTES) return setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The most is ${COVER_MAX_BYTES / 1024 / 1024} MB.`);
    setBusy(true);
    try {
      const { w, h } = await readSize(file);
      if (w < COVER_MIN.w || h < COVER_MIN.h) throw new Error(`That image is ${w} × ${h}. Use at least ${COVER_MIN.w} × ${COVER_MIN.h} so it stays sharp.`);
      const body = new FormData();
      body.set("file", file);
      body.set("bucket", "canvases");
      const res = await authedFetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      onChange(json.url);
      if (w / h < 1.6) setNote("This image is tall, so only a wide strip of it shows. A landscape photo fits better.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const choose = () => !busy && input.current?.click();
  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void take(f);
  };

  return (
    <div className="grid gap-2">
      <span className="field-label">Cover image</span>
      <div
        className={cn("relative rounded-2xl overflow-hidden border-2 border-dashed", over ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]", value && "border-solid")}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        {value ? (
          <EventCover name={name} banner={value} seed={seed} variant="card" className="!border-b-0" />
        ) : (
          <button type="button" onClick={choose} disabled={busy}
            className="w-full aspect-[3/1] min-h-[132px] grid place-items-center content-center gap-1 text-center px-4 bg-[var(--paper)] cursor-pointer border-0 text-[var(--ink)]">
            {busy ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
            <b>{busy ? "Uploading…" : "Drop a cover here, or click to choose"}</b>
            <span className="text-xs text-[var(--muted)]">{COVER_HINT} · PNG, JPG or WebP · up to {COVER_MAX_BYTES / 1024 / 1024} MB</span>
          </button>
        )}
        {value && (
          <div className="absolute right-2 bottom-2 flex gap-2">
            <Button type="button" size="small" onClick={choose} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Replace size={14} />} Replace
            </Button>
            <Button type="button" size="small" onClick={() => { setNote(null); setError(null); onChange(""); }} disabled={busy} aria-label="Remove cover">
              <Trash2 size={14} /> Remove
            </Button>
          </div>
        )}
      </div>
      <input ref={input} type="file" accept={COVER_TYPES.join(",")} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void take(f); e.target.value = ""; }} />
      {error && <p role="alert" className="text-sm font-semibold text-[var(--red)]">{error}</p>}
      {note && !error && <p role="status" className="text-sm text-[var(--muted)]">{note}</p>}
      {!value && !error && <p className="text-xs text-[var(--muted)]">Optional. Without one, the event shows a patch pattern in its own colours.</p>}
    </div>
  );
}
