"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAuthedFetch } from "@/lib/authedFetch";
import { STAGE_PRESETS, type PageStage } from "@/lib/market/page";
import { cn } from "@/lib/utils";

const TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX = 10 * 1024 * 1024;

/**
 * Pick what sits behind the photo on your page and in the feed: a ready colour, your own colour, or a picture.
 * A picture sits over the colour, so a cutout with soft edges blends into both.
 */
export function StagePicker({ value, onChange }: { value?: PageStage; onChange: (next: PageStage | undefined) => void }) {
  const authedFetch = useAuthedFetch();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<PageStage>) => {
    const next = { ...value, ...patch };
    onChange(next.color || next.image ? next : undefined);
  };

  async function upload(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Use a PNG, JPG or WebP picture.");
    if (file.size > MAX) return setError("That picture is over 10 MB.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("bucket", "canvases");
      const res = await authedFetch("/api/uploads", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Try again.");
      set({ image: json.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const color = value?.color;
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Background colour">
        {STAGE_PRESETS.map((p) => (
          <button key={p.color} type="button" aria-label={p.label} aria-pressed={color?.toLowerCase() === p.color.toLowerCase()}
            onClick={() => set({ color: p.color })}
            className={cn("w-8 h-8 rounded-lg border-2 border-[var(--line)]", color?.toLowerCase() === p.color.toLowerCase() && "ring-4 ring-[var(--accent)]/40")}
            style={{ background: p.color }} />
        ))}
        <label className="w-8 h-8 rounded-lg border-2 border-dashed border-[var(--line)] grid place-items-center cursor-pointer overflow-hidden relative" title="Your own colour">
          <span className="text-[10px] font-bold">+</span>
          <input type="color" value={color ?? "#F1EFE8"} onChange={(e) => set({ color: e.target.value.toUpperCase() })}
            aria-label="Your own colour" className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-base btn-small">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {value?.image ? "Change picture" : "Use a picture"}
        </button>
        {value?.image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.image} alt="" className="w-9 h-9 rounded-lg object-cover border-[1.5px] border-[var(--line)]" />
            <button type="button" onClick={() => set({ image: undefined })} className="btn-base btn-small btn-ghost"><X size={13} /> Remove picture</button>
          </>
        )}
        {value && !value.image && (
          <button type="button" onClick={() => onChange(undefined)} className="btn-base btn-small btn-ghost"><X size={13} /> Default</button>
        )}
        <input ref={input} type="file" accept={TYPES.join(",")} hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
      </div>
      {error && <p className="text-xs text-[var(--red)]" role="alert">{error}</p>}
    </div>
  );
}
