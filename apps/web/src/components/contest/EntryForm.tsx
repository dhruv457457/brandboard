"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Lock, Send, Share2 } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { FEEDBACK_MAX, FEEDBACK_MIN, HASHTAG, TELEGRAM_URL, TRACKS, type ContestData, type TrackId } from "@/lib/contest";
import { cn } from "@/lib/utils";
import { Confetti, Patch, hand } from "./Decor";
import { trackContest } from "@/lib/contestTrack";

const label = "font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]";

/** The entry form. Signed-out people get a sign-in prompt; the X handle always comes from the verified account. */
export function EntryForm({ data, onSaved }: { data: ContestData; onSaved: () => void }) {
  const { authenticated, ready, login } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const me = data.me;
  const mine = me?.entry ?? null;

  const [tracks, setTracks] = useState<TrackId[]>(["lucky"]);
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [feedbackUrl, setFeedbackUrl] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"new" | "updated" | null>(null);
  const [fire, setFire] = useState(0);

  // Start from the saved entry (or what Privy knows) once it arrives.
  const savedAt = mine?.updatedAt ?? null;
  useEffect(() => {
    if (mine) {
      setTracks(mine.tracks);
      setEmail(mine.email ?? "");
      setTelegram(mine.telegram);
      setPostUrl(mine.postUrl ?? "");
      setFeedbackUrl(mine.feedbackUrl ?? "");
      setFeedbackText(mine.feedbackText ?? "");
      setJoined(mine.joinedTelegram);
    } else if (me?.email) setEmail((e) => e || me.email!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAt, me?.email]);

  const wantsFeedback = tracks.includes("feedback");
  const toggle = (id: TrackId) => setTracks((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authedFetch("/api/contest", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tracks, email, telegram, postUrl, feedbackUrl: wantsFeedback ? feedbackUrl : "", feedbackText: wantsFeedback ? feedbackText : "", joinedTelegram: joined }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't save your entry.");
      setDone(mine ? "updated" : "new");
      setFire((n) => n + 1);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your entry.");
    } finally {
      setBusy(false);
    }
  }

  const shell = "relative rounded-[28px] border-[2.5px] border-[var(--ink)] bg-[var(--card)] shadow-[6px_6px_0_var(--shadow)] p-5 sm:p-8";

  if (!data.open) {
    return (
      <div className={shell}>
        <h3 className="m-0 font-display font-extrabold text-3xl">Entries are closed</h3>
        <p className="mt-2 mb-0 text-[var(--muted)]">Thank you to everyone who played. Winners are posted above once they are paid.</p>
      </div>
    );
  }

  if (!ready) return <div className={cn(shell, "min-h-[220px] grid place-items-center text-[var(--muted)] font-semibold")}>Loading…</div>;

  if (!authenticated) {
    return (
      <div className={cn(shell, "grid gap-4 justify-items-start")}>
        <Patch tone={3} rotate={-4} className="w-14 h-14"><Lock size={22} /></Patch>
        <h3 className="m-0 font-display font-extrabold text-3xl leading-tight">Sign in with X to enter</h3>
        <p className="m-0 text-[var(--muted)] max-w-[52ch]">Your X handle is your entry, so we use the account you sign in with. It takes a few seconds and the wallet is made for you.</p>
        <button type="button" onClick={login} className="btn-base btn-primary">Sign in with X</button>
      </div>
    );
  }

  if (!me?.xHandle) {
    return (
      <div className={cn(shell, "grid gap-4 justify-items-start")}>
        <h3 className="m-0 font-display font-extrabold text-3xl leading-tight">Link your X account first</h3>
        <p className="m-0 text-[var(--muted)] max-w-[52ch]">The contest runs on X handles. Sign in again with X (not email) so your handle can be checked.</p>
        <button type="button" onClick={login} className="btn-base btn-primary">Continue with X</button>
      </div>
    );
  }

  if (done) {
    const text = `I entered Get Patched Week on @Patched_world ${HASHTAG}. 3 days, $30 USDC, bid and get paid on Monad.`;
    const href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${typeof window === "undefined" ? "" : window.location.origin}/contest`)}`;
    return (
      <div className={cn(shell, "grid gap-4 justify-items-start overflow-hidden")}>
        <Confetti fire={fire} />
        <Patch tone="orange" rotate={-5} className="w-16 h-16"><Check size={30} strokeWidth={3.2} /></Patch>
        <h3 className="m-0 font-display font-extrabold text-4xl leading-none">{done === "updated" ? "Entry updated" : "You're in"}</h3>
        <p className="m-0 text-[var(--muted)] max-w-[52ch]">We have your entry as <b className="text-[var(--ink)]">@{me.xHandle}</b>. You can change it until the deadline. Tell your friends, and keep using Patched: the more you do, the better your post.</p>
        <div className="flex flex-wrap gap-2.5">
          <a href={href} target="_blank" rel="noopener noreferrer" className="btn-base btn-primary"><Share2 size={16} /> Share on X</a>
          <button type="button" onClick={() => setDone(null)} className="btn-base">Edit my entry</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} onFocusCapture={() => trackContest("form")} className={cn(shell, "grid gap-6")} noValidate>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="m-0 font-display font-extrabold text-3xl leading-none">{mine ? "Your entry" : "Enter the contest"}</h3>
        {mine && <span className="ct-stamp is-done">Saved</span>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="grid gap-1.5">
          <span className={label}>X handle</span>
          <span className="relative">
            <input className="ct-input pr-10" readOnly value={`@${me.xHandle}`} aria-label="Your X handle (from your account)" />
            <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className={label}>Telegram username</span>
          <input className="ct-input" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@yourname" autoComplete="off" required />
        </label>
        <label className="grid gap-1.5 sm:col-span-2">
          <span className={label}>Email (only to reach you if you win)</span>
          <input className="ct-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" required />
        </label>
      </div>

      <fieldset className="m-0 p-0 border-0 grid gap-3">
        <legend className={cn(label, "mb-2")}>Pick your tracks (one or more)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TRACKS.map((t, i) => {
            const on = tracks.includes(t.id);
            return (
              <button
                key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on}
                className={cn("text-left rounded-[18px] border-2 p-3.5 grid gap-1 transition-all", on ? "border-[var(--ink)] bg-[var(--accent-soft)] shadow-[4px_4px_0_var(--shadow)] -translate-y-0.5" : "border-[var(--soft)] bg-[var(--paper)] hover:border-[var(--ink)]")}
              >
                <span className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-lg leading-none">{t.name}</span>
                  <span className={cn("w-6 h-6 rounded-md border-2 border-[var(--ink)] grid place-items-center", on ? "bg-[var(--accent)]" : "bg-[var(--card)]")}>{on && <Check size={15} strokeWidth={3.4} className="text-[#0b0b0c]" />}</span>
                </span>
                <span className="font-mono text-xs font-semibold text-[var(--accent-text)]">${t.prize} USDC</span>
                <span className="sr-only">{i}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="grid gap-1.5">
        <span className={label}>Your X post (mandatory)</span>
        <input className="ct-input" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://x.com/you/status/123…" inputMode="url" autoComplete="off" required />
        <span className="text-xs text-[var(--muted)]">Tag @Patched_world and add {HASHTAG}. For Best post, this is the post we judge.</span>
      </label>

      {wantsFeedback && (
        <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[var(--ink)] p-4 bg-[var(--paper)]">
          <span className={label}>Best feedback: a link to your write-up, or write it here</span>
          <input className="ct-input" value={feedbackUrl} onChange={(e) => setFeedbackUrl(e.target.value)} placeholder="README, blog, Notion or Google Docs link" inputMode="url" />
          <span className={cn(hand.className, "text-[22px] leading-none text-[var(--muted)] -rotate-1")}>or</span>
          <textarea className="ct-input" rows={6} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value.slice(0, FEEDBACK_MAX))} placeholder="What broke? What was confusing? What would make you use it for real?" />
          <span className={cn("text-xs font-mono", feedbackText.length > 0 && feedbackText.length < FEEDBACK_MIN && !feedbackUrl ? "text-[var(--accent-text)]" : "text-[var(--muted)]")}>
            {feedbackText.length} / {FEEDBACK_MAX} characters {feedbackUrl ? "" : `(at least ${FEEDBACK_MIN})`}
          </span>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input type="checkbox" checked={joined} onChange={(e) => setJoined(e.target.checked)} className="peer sr-only" />
        <span className="mt-0.5 w-6 h-6 flex-none rounded-md border-2 border-[var(--ink)] bg-[var(--card)] grid place-items-center peer-checked:bg-[var(--accent)] peer-focus-visible:ring-2 ring-[var(--accent)] shadow-[2px_2px_0_var(--shadow)]">
          {joined && <Check size={15} strokeWidth={3.4} className="text-[#0b0b0c]" />}
        </span>
        <span className="text-[15px] leading-snug">I joined <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold">t.me/patchedworld</a></span>
      </label>

      {!me.steps.action.done && (
        <p className="m-0 text-sm text-[var(--accent-text)] font-semibold">
          Heads up: we can&apos;t see a listing, bid or Spotted photo from you on the event yet. Do one before the deadline, or your entry won&apos;t count.
        </p>
      )}
      {error && <p className="m-0 text-sm font-semibold text-[var(--red)]" role="alert">{error}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        <button type="submit" disabled={busy || tracks.length === 0} className="btn-base btn-primary">
          {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Send size={16} /> {mine ? "Update my entry" : "Enter now"}</>}
        </button>
        <span className="text-xs text-[var(--muted)]">One entry per person. Edit it any time before the deadline.</span>
      </div>
    </form>
  );
}
