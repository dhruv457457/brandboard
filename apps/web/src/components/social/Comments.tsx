"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { formatTimeAgo } from "@/lib/format";
import type { ListingComment } from "@/lib/comments";
import { cn } from "@/lib/utils";

export interface CommentSpot {
  id: number;
  label: string;
}

/**
 * A free, one-line-each thread under a listing. Anyone signed in can write; a comment can be about one spot
 * ("Abs is going to look great"). The author and the listing's creator can remove one.
 */
export function Comments({ listingId, spots, isCreator = false }: { listingId: number; spots: CommentSpot[]; isCreator?: boolean }) {
  const { authenticated, login, ready } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [comments, setComments] = useState<ListingComment[] | null>(null);
  const [live, setLive] = useState(true);
  const [body, setBody] = useState("");
  const [spot, setSpot] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await authedFetch(`/api/comments?listingId=${listingId}`).catch(() => null);
    const json = res && res.ok ? ((await res.json()) as { comments: ListingComment[]; ready?: boolean }) : null;
    setComments(json?.comments ?? []);
    setLive(json?.ready !== false);
  }, [listingId, authedFetch]);

  useEffect(() => {
    if (!ready) return;
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load, authenticated, ready]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!authenticated) return login();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId, patchId: spot === "" ? null : spot, body: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't post that. Try again.");
      setBody("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't post that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await authedFetch(`/api/comments?id=${id}`, { method: "DELETE" });
    if (res.ok) setComments((cs) => (cs ?? []).filter((c) => c.id !== id));
    else toast("Couldn't remove that. Try again.");
  }

  // Until comments are switched on for the database, don't show an empty box that can't work.
  if (!live) return null;

  const label = (id: number | null) => (id === null ? null : spots.find((s) => s.id === id)?.label ?? `Spot ${id + 1}`);

  return (
    <section className="grid gap-3" aria-label="Comments">
      <h2 className="font-extrabold text-xl flex items-center gap-2">
        <MessageCircle size={18} className="text-[var(--accent-text)]" /> Comments{comments && comments.length > 0 ? ` · ${comments.length}` : ""}
      </h2>

      {comments === null ? (
        <p className="text-sm text-[var(--muted)] inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No comments yet. Cheer someone on, ask a question, or say which spot you want.</p>
      ) : (
        <ul className="grid gap-3 list-none m-0 p-0">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar src={c.author.avatar} name={c.author.name} wallet={c.author.wallet} size={34} />
              <div className="min-w-0 flex-1 grid gap-0.5">
                <p className="text-[14px] leading-snug">
                  {c.author.handle ? <Link href={`/${c.author.handle}`} className="font-bold text-[var(--ink)] no-underline hover:underline">{c.author.name}</Link> : <b>{c.author.name}</b>}
                  {label(c.patchId) && (
                    <span className="ml-1.5 text-[11px] font-semibold rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] px-2 py-0.5">{label(c.patchId)}</span>
                  )}
                  <span className="text-[var(--muted)]"> · {formatTimeAgo(new Date(c.createdAt).getTime())}</span>
                </p>
                <p className="text-[15px] leading-snug break-words">{c.body}</p>
              </div>
              {(c.mine || isCreator) && (
                <button type="button" onClick={() => remove(c.id)} aria-label="Remove this comment"
                  className="self-start w-7 h-7 rounded-full grid place-items-center text-[var(--muted)] hover:bg-[var(--soft)] hover:text-[var(--ink)]">
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={post} className="grid gap-2">
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={280}
            placeholder={authenticated ? "Add a comment" : "Sign in to comment"}
            aria-label="Add a comment"
            onFocus={() => { if (!authenticated && ready) login(); }}
            className="w-0 flex-1 min-w-0 h-11 px-3.5 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]"
          />
          <button type="submit" disabled={busy || (authenticated && !body.trim())} className="btn-base btn-primary h-11 !rounded-xl !px-3.5 flex-none" aria-label="Post comment">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        {spots.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="About which spot">
            <button type="button" aria-pressed={spot === ""} onClick={() => setSpot("")}
              className={cn("text-xs font-semibold rounded-full px-2.5 py-1 border-[1.5px]", spot === "" ? "border-[var(--line)] bg-[var(--soft)]" : "border-[var(--soft)] text-[var(--muted)]")}>
              Whole listing
            </button>
            {spots.map((s) => (
              <button key={s.id} type="button" aria-pressed={spot === s.id} onClick={() => setSpot(s.id)}
                className={cn("text-xs font-semibold rounded-full px-2.5 py-1 border-[1.5px]", spot === s.id ? "border-[var(--line)] bg-[var(--soft)]" : "border-[var(--soft)] text-[var(--muted)]")}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </form>
    </section>
  );
}
