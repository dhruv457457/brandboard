"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, ShieldAlert, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useAuthedFetch } from "@/lib/authedFetch";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_FILES_MAX,
  DISPUTE_TEXT_MAX,
  encodeDisputeReason,
  type DisputeCategory,
} from "@/lib/market/dispute";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Patch label, e.g. "Chest". */
  label: string;
  milestoneName: string;
  /** When the review window closes (ms). */
  reviewEndsAt: number | null;
  /** Sends the dispute transaction with the encoded reason. Throws on failure. */
  onSubmit: (reasonURI: string) => Promise<void>;
}

const MIN_TEXT = 10;

/** Form a patch holder fills in to dispute a proof: what's wrong, details, and optional photos. */
export function DisputeSheet({ open, onClose, label, milestoneName, reviewEndsAt, onSubmit }: Props) {
  const authedFetch = useAuthedFetch();
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Start fresh each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setCategory(null);
    setText("");
    setFiles([]);
    setError(null);
  }, [open]);

  const busy = uploading || sending;
  const ready = category !== null && text.trim().length >= MIN_TEXT && !busy;

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(list).slice(0, DISPUTE_FILES_MAX - files.length)) {
        const form = new FormData();
        form.set("file", file);
        form.set("bucket", "proofs");
        const res = await authedFetch("/api/uploads", { method: "POST", body: form });
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) throw new Error(body.error ?? "Upload failed. Try again.");
        setFiles((f) => [...f, { url: body.url!, name: file.name }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function submit() {
    if (!ready || !category) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(encodeDisputeReason({ category, text: text.trim(), files: files.map((f) => f.url) }));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setSending(false);
    }
  }

  const hoursLeft = reviewEndsAt ? Math.max(0, Math.ceil((reviewEndsAt - Date.now()) / 3_600_000)) : null;

  return (
    <Sheet
      open={open}
      onClose={() => !busy && onClose()}
      title={`Dispute ${label}`}
      description={`${milestoneName}${hoursLeft !== null ? ` · ${hoursLeft}h left to dispute` : ""}`}
    >
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex gap-3 rounded-xl bg-[var(--soft)] p-3 text-sm">
          <ShieldAlert className="w-5 h-5 flex-none text-[var(--accent-text)]" />
          <p>
            This puts the payment for your patch on hold. An admin reviews the proof and your reason, then pays the
            creator, splits it, or refunds you.
          </p>
        </div>

        <fieldset className="grid gap-2">
          <legend className="field-label mb-2">What&apos;s wrong?</legend>
          {(Object.entries(DISPUTE_CATEGORIES) as [DisputeCategory, string][]).map(([key, name]) => (
            <label
              key={key}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 cursor-pointer text-sm font-semibold transition-colors",
                category === key ? "border-[var(--line)] bg-[var(--accent-soft)]" : "border-[var(--soft)] hover:border-[var(--muted)]",
              )}
            >
              <input
                type="radio"
                name="dispute-category"
                value={key}
                checked={category === key}
                onChange={() => setCategory(key)}
                className="accent-[var(--accent)] w-4 h-4"
              />
              {name}
            </label>
          ))}
        </fieldset>

        <label className="grid gap-2">
          <span className="field-label">Details</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, DISPUTE_TEXT_MAX))}
            rows={4}
            placeholder="What did you expect, and what does the proof show instead?"
            className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--paper)] p-3 text-sm outline-none focus-visible:outline-3 focus-visible:outline-[var(--accent)] resize-y"
          />
          <span className="text-xs text-[var(--muted)] flex justify-between">
            <span>{text.trim().length < MIN_TEXT ? `At least ${MIN_TEXT} characters` : " "}</span>
            <span className="font-mono">{text.length}/{DISPUTE_TEXT_MAX}</span>
          </span>
        </label>

        <div className="grid gap-2">
          <span className="field-label">Photos (optional, up to {DISPUTE_FILES_MAX})</span>
          <div className="flex gap-2 flex-wrap">
            {files.map((f) => (
              <div key={f.url} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((all) => all.filter((x) => x.url !== f.url))}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-[var(--card)] border-[1.5px] border-[var(--line)] grid place-items-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {files.length < DISPUTE_FILES_MAX && (
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--muted)] text-[var(--muted)] grid place-items-center hover:border-[var(--accent)] hover:text-[var(--accent-text)] disabled:opacity-60"
              >
                <span className="grid place-items-center gap-1 text-[11px] font-semibold">
                  <ImagePlus className="w-5 h-5" />
                  {uploading ? "Uploading" : "Add"}
                </span>
              </button>
            )}
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
          </div>
        </div>

        {error && <p className="text-sm text-[var(--red)] font-semibold" role="alert">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!ready}>
            {sending ? "Opening dispute…" : "Open dispute"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
