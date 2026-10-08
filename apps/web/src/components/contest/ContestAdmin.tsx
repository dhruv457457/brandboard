"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { TRACKS } from "@/lib/contest";
import { cn } from "@/lib/utils";

interface Row {
  id: string; x_handle: string; email: string | null; telegram: string; tracks: string[]; post_url: string | null;
  feedback_url: string | null; feedback_text: string | null; valid: boolean | null; created_at: string;
}

/** For the team only (an admin wallet): review entries, rule them in or out, and record the winners and their payments. */
export function ContestAdmin() {
  const { walletAddress, authenticated } = usePatchedAuth();
  const isAdmin = useIsAdmin(walletAddress);
  const authedFetch = useAuthedFetch();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [w, setW] = useState({ track: "post", handle: "", note: "", tx: "" });

  const load = useCallback(async () => {
    const res = await authedFetch("/api/contest/admin", { cache: "no-store" });
    if (res.ok) setRows(((await res.json()) as { entries: Row[] }).entries);
  }, [authedFetch]);
  useEffect(() => {
    if (authenticated && isAdmin) void load();
  }, [authenticated, isAdmin, load]);

  async function post(body: object) {
    const res = await authedFetch("/api/contest/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    setMsg(res.ok ? "Saved." : (j.error ?? "Couldn't save."));
    if (res.ok) void load();
  }

  if (!authenticated || !isAdmin) return null;
  return (
    <section className="grid gap-5 rounded-[24px] border-2 border-dashed border-[var(--ink)] p-5 bg-[var(--card)]" aria-label="Contest admin">
      <h2 className="m-0 font-display font-extrabold text-2xl">Team only: entries ({rows?.length ?? "…"})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[760px]">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <th className="p-2">X</th><th className="p-2">Contact</th><th className="p-2">Tracks</th><th className="p-2">Links</th><th className="p-2">Counts?</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className={cn("border-t border-[var(--soft)] align-top", r.valid === false && "opacity-50")}>
                <td className="p-2 font-semibold">@{r.x_handle}</td>
                <td className="p-2">{r.email}<br />{r.telegram}</td>
                <td className="p-2">{r.tracks.join(", ")}</td>
                <td className="p-2 grid gap-1">
                  {r.post_url && <a href={r.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">post <ExternalLink size={11} /></a>}
                  {r.feedback_url && <a href={r.feedback_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">feedback link <ExternalLink size={11} /></a>}
                  {r.feedback_text && <details><summary className="cursor-pointer">feedback ({r.feedback_text.length})</summary><p className="m-0 mt-1 max-w-[320px] whitespace-pre-wrap">{r.feedback_text}</p></details>}
                </td>
                <td className="p-2">
                  <span className="inline-flex gap-1.5">
                    <button type="button" aria-label="Counts" onClick={() => post({ id: r.id, valid: true })} className={cn("w-8 h-8 grid place-items-center rounded-lg border-2 border-[var(--ink)]", r.valid === true ? "bg-[var(--green-soft)]" : "bg-[var(--card)]")}><Check size={15} /></button>
                    <button type="button" aria-label="Doesn't count" onClick={() => post({ id: r.id, valid: false })} className={cn("w-8 h-8 grid place-items-center rounded-lg border-2 border-[var(--ink)]", r.valid === false ? "bg-[var(--accent-soft)]" : "bg-[var(--card)]")}><X size={15} /></button>
                    {r.valid !== null && <button type="button" onClick={() => post({ id: r.id, valid: null })} className="text-xs underline">reset</button>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        className="grid sm:grid-cols-[140px_1fr_1fr_1.4fr_auto] gap-2 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ winner: w });
        }}
      >
        <select className="ct-input" value={w.track} onChange={(e) => setW({ ...w, track: e.target.value })}>{TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <input className="ct-input" placeholder="X handle" value={w.handle} onChange={(e) => setW({ ...w, handle: e.target.value })} required />
        <input className="ct-input" placeholder="Note (optional)" value={w.note} onChange={(e) => setW({ ...w, note: e.target.value })} />
        <input className="ct-input" placeholder="Prize tx hash (0x…)" value={w.tx} onChange={(e) => setW({ ...w, tx: e.target.value })} />
        <button type="submit" className="btn-base btn-primary">Set winner</button>
      </form>
      {msg && <p className="m-0 text-sm font-semibold">{msg}</p>}
    </section>
  );
}
