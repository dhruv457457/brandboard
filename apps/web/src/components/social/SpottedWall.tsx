"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ReportButton } from "./ReportButton";
import { ReactionBar } from "./Reactions";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/ui/Toast";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useSpot } from "@/lib/market/useSpot";
import { SPOTTER } from "@/lib/config";
import { formatTimeAgo } from "@/lib/format";
import type { SpottedPost } from "@/lib/spotted";

export interface SpotChoice {
  listingId: number;
  label: string;
}

/**
 * Photos of patched people, posted by whoever saw them. Shows the latest for an event, a listing or a creator, and a
 * "Spotted someone?" button: pick who, add a photo and a line, and the creator is told. `choices` are the listings you
 * can spot on this page (none: just the wall).
 */
export function SpottedWall({ eventId, listingId, wallet, choices = [], title = "Spotted" }: {
  eventId?: number; listingId?: number; wallet?: string; choices?: SpotChoice[]; title?: string;
}) {
  const { authenticated, login, walletAddress, ready } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [posts, setPosts] = useState<SpottedPost[] | null>(null);
  const [open, setOpen] = useState(false);

  const query = eventId ? `eventId=${eventId}` : listingId ? `listingId=${listingId}` : wallet ? `wallet=${wallet}` : "";
  const load = useCallback(async () => {
    if (!query) return;
    const res = await authedFetch(`/api/spotted?${query}`).catch(() => null);
    const json = res && res.ok ? ((await res.json()) as { posts: SpottedPost[] }) : null;
    setPosts(json?.posts ?? []);
  }, [query, authedFetch]);
  // Load, again once signed in (so your own reactions show), and every 20 s so new photos and cheers arrive.
  useEffect(() => {
    if (!ready) return; // wait for the sign-in to settle, so the first request already knows who is asking
    void load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load, authenticated, ready]);

  async function remove(id: string) {
    const res = await authedFetch(`/api/spotted?id=${id}`, { method: "DELETE" });
    if (res.ok) setPosts((ps) => (ps ?? []).filter((p) => p.id !== id));
    else toast("Couldn't remove that. Try again.");
  }

  if (posts === null && choices.length === 0) return null;
  if (posts && posts.length === 0 && choices.length === 0) return null;

  return (
    <section className="grid gap-3" aria-label={title}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-extrabold text-xl flex items-center gap-2"><Camera size={18} className="text-[var(--accent-text)]" /> {title}</h2>
        {choices.length > 0 && (
          <Button size="small" variant="primary" onClick={() => (authenticated ? setOpen(true) : login())}>
            <Camera size={14} /> Spotted someone?
          </Button>
        )}
      </div>

      {posts && posts.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nobody has been spotted yet. See someone wearing a patch? Post the first photo.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none m-0 p-0">
          {(posts ?? []).map((p) => {
            const mine = !!walletAddress && (p.creator === walletAddress.toLowerCase() || p.author.wallet === walletAddress.toLowerCase());
            return (
              <li key={p.id} className="relative rounded-2xl overflow-hidden border-[1.5px] border-[var(--soft)] bg-[var(--card)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo} alt={p.caption ?? "A spotted patch"} loading="lazy" className="w-full aspect-[3/4] object-cover bg-[var(--soft)]" />
                <div className="p-2.5 grid gap-1.5 text-[13px]">
                  {p.caption && <span className="leading-snug">{p.caption}</span>}
                  <span className="text-[var(--muted)] truncate">
                    {p.author.handle ? <Link href={`/${p.author.handle}`} className="font-semibold text-[var(--ink)] no-underline">{p.author.name}</Link> : p.author.name} · {formatTimeAgo(p.createdAt)}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <ReactionBar postId={p.id} initial={p.reactions} onSignIn={login} />
                    {!mine && <ReportButton kind="post" id={p.id} label={false} />}
                  </span>
                </div>
                {mine && (
                  <button type="button" onClick={() => remove(p.id)} aria-label="Remove this photo"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white grid place-items-center hover:bg-black/75">
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <SpotSheet open={open} onClose={() => setOpen(false)} choices={choices} onPosted={() => { setOpen(false); void load(); }} />
    </section>
  );
}

function SpotSheet({ open, onClose, choices, onPosted }: { open: boolean; onClose: () => void; choices: SpotChoice[]; onPosted: () => void }) {
  const authedFetch = useAuthedFetch();
  const spot = useSpot();
  const [listing, setListing] = useState(choices[0]?.listingId ?? 0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!listing && choices[0]) setListing(choices[0].listingId);
  }, [choices, listing]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !listing || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("bucket", "proofs");
      const up = await authedFetch("/api/uploads", { method: "POST", body: form });
      const uploaded = (await up.json()) as { url?: string; error?: string };
      if (!up.ok || !uploaded.url) throw new Error(uploaded.error ?? "The photo didn't upload.");
      // Pin the photo, record the spot on-chain (gas-free with a Patched wallet), then show it.
      const pin = await authedFetch("/api/spotted/pin", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: listing, photo: uploaded.url, caption }),
      });
      const pinned = (await pin.json()) as { photoHash?: `0x${string}`; photoURI?: string; error?: string };
      if (!pin.ok || !pinned.photoHash || !pinned.photoURI) throw new Error(pinned.error ?? "Couldn't prepare your photo.");
      const tx = await spot(listing, pinned.photoHash, pinned.photoURI);
      const res = await authedFetch("/api/spotted", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ listingId: listing, photo: uploaded.url, caption, tx }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Couldn't post that.");
      toast(SPOTTER ? "Spotted. It is on Monad now and the creator has been told." : "Posted. The creator has been told.");
      setFile(null);
      setCaption("");
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Spotted someone?" description="Post a photo of a patch in the wild. The creator gets a notification.">
      <form onSubmit={submit} className="grid gap-4">
        {choices.length > 1 && (
          <label className="grid gap-1.5">
            <span className="field-label">Who did you spot?</span>
            <select className="h-11 px-3 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]" value={listing} onChange={(e) => setListing(Number(e.target.value))}>
              {choices.map((c) => <option key={c.listingId} value={c.listingId}>{c.label}</option>)}
            </select>
          </label>
        )}
        {choices.length === 1 && <p className="text-sm"><b>{choices[0].label}</b></p>}

        <div className="grid gap-1.5">
          <span className="field-label">Photo</span>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a photo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => input.current?.click()}
            className="rounded-2xl border-2 border-dashed border-[var(--line)] min-h-[160px] grid place-items-center overflow-hidden hover:bg-[var(--soft)]">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your photo" className="max-h-[260px] w-auto" />
            ) : (
              <span className="grid justify-items-center gap-1 text-[var(--muted)] text-sm"><ImagePlus size={24} /> Choose a photo</span>
            )}
          </button>
        </div>

        <label className="grid gap-1.5">
          <span className="field-label">Say something (optional)</span>
          <input className="h-11 px-3 rounded-xl border-[1.5px] border-[var(--line)] bg-[var(--paper)]" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="The hoodie by the main stage" />
        </label>

        {error && <p className="text-sm text-[var(--red)] font-semibold" role="alert">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!file || busy}>{busy ? <><Loader2 size={15} className="animate-spin" /> Posting…</> : "Post"}</Button>
        </div>
      </form>
    </Sheet>
  );
}

export { ReactionBar } from "./Reactions";
