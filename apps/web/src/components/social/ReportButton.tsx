"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { cn } from "@/lib/utils";

const REASONS = [
  { id: "spam", label: "Spam or fake", help: "Not a real listing or photo." },
  { id: "scam", label: "Scam", help: "It tries to take money or trick people." },
  { id: "inappropriate", label: "Inappropriate", help: "Offensive, unsafe or not for this site." },
  { id: "copyright", label: "Copyright", help: "Uses a photo or logo that isn't theirs." },
  { id: "other", label: "Something else", help: "Tell us below." },
] as const;

/**
 * Report a listing or a spotted photo. Nothing waits for approval on Patched, so reports are how bad posts come down:
 * an admin hides what is reported, and three different people reporting the same thing hides it at once.
 */
export function ReportButton({ kind, id, className, label = true }: { kind: "listing" | "post"; id: string | number; className?: string; label?: boolean }) {
  const { authenticated, login } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await authedFetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id: String(id), reason, note }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; already?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Couldn't send your report.");
      toast(json.already ? "You already reported this. Thanks." : "Thanks. We'll look at it.");
      setOpen(false);
      setNote("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't send your report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (authenticated ? setOpen(true) : login())}
        aria-label={`Report this ${kind === "post" ? "photo" : "listing"}`}
        className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]", className)}
      >
        <Flag size={13} /> {label && "Report"}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Report this ${kind === "post" ? "photo" : "listing"}`} description="Nothing waits for approval on Patched, so reports are how bad posts come down. An admin looks at every one.">
        <div className="grid gap-4">
          <div role="radiogroup" aria-label="Reason" className="grid gap-2">
            {REASONS.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={reason === r.id} onClick={() => setReason(r.id)}
                className={cn("text-left rounded-xl border-[1.5px] px-3.5 py-2.5 grid", reason === r.id ? "border-[var(--ink)] bg-[var(--soft)]" : "border-[var(--soft)] hover:border-[var(--line)]")}>
                <b className="text-[15px]">{r.label}</b>
                <span className="text-sm text-[var(--muted)]">{r.help}</span>
              </button>
            ))}
          </div>
          <label className="grid gap-1.5">
            <span className="field-label">Anything else? (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className="rounded-xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-3 text-[15px]" />
          </label>
          <Button variant="primary" onClick={send} disabled={busy} className="justify-center">{busy ? "Sending…" : "Send report"}</Button>
        </div>
      </Sheet>
    </>
  );
}
