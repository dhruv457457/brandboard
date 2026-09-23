"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { ListingCardView } from "@/components/market/ListingCardView";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";

export interface PublicProfile {
  wallet: string;
  handle: string | null;
  displayName: string | null;
  xHandle: string | null;
  xVerified: boolean;
  bio: string | null;
  bannerColor: string;
  completed: number;
  failed: number;
  earned: string;
}

const COLORS = ["#FF5A1F", "#836EF9", "#16A34A", "#F5B400", "#FF6FA4", "#2F9BFF"];
const INPUT = "border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)]";

export function ProfileView({ profile: p, cards: wire }: { profile: PublicProfile; cards: Wire<ListingCard[]> }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const router = useRouter();
  const { walletAddress } = usePatchedAuth();
  const { profile: mine, save } = useProfile();
  const isOwner = walletAddress?.toLowerCase() === p.wallet;
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({ displayName: p.displayName ?? "", handle: p.handle ?? "", bio: p.bio ?? "", bannerColor: p.bannerColor });
  const [saving, setSaving] = useState(false);
  useEffect(() => setMounted(true), []);

  const name = (isOwner ? form.displayName : p.displayName) || (p.handle ? `@${p.handle}` : formatShortAddress(p.wallet));
  const banner = isOwner ? form.bannerColor : p.bannerColor;

  async function onSave() {
    setSaving(true);
    const error = await save({ displayName: form.displayName, bio: form.bio, bannerColor: form.bannerColor, ...(form.handle && form.handle !== mine?.handle ? { handle: form.handle } : {}) });
    setSaving(false);
    if (error) return toast(error);
    toast("Profile saved.");
    if (form.handle && form.handle !== p.handle) router.replace(`/${form.handle.toLowerCase()}`);
    else router.refresh();
  }

  return (
    <main className="wrap pt-8 pb-24">
      <div className="h-[170px] rounded-[22px] border-2 border-[var(--line)] relative overflow-hidden shadow-[4px_4px_0_var(--shadow)]" style={{ background: banner }}>
        <div className="absolute inset-3 border-2 border-dashed border-black/30 rounded-[14px]" />
        <span className="absolute right-5 -bottom-4 font-extrabold text-[110px] leading-none tracking-[-.06em] text-black/10 select-none" aria-hidden="true">patched</span>
      </div>
      <div className="flex gap-4 items-end -mt-11 ml-5 relative flex-wrap">
        <div className="w-[100px] h-[100px] rounded-[26px] border-[3px] border-[var(--line)] grid place-items-center font-extrabold text-4xl text-[#0B0B0C] shadow-[4px_4px_0_var(--shadow)]"
          style={{ background: "linear-gradient(135deg, var(--p5), var(--p2))" }}>
          {name.replace("@", "").slice(0, 1).toUpperCase()}
        </div>
        <div className="pb-1.5">
          <h1 className="font-extrabold text-4xl tracking-tight">{name}</h1>
          <p className="muted text-sm">
            {p.handle ? `patched / ${p.handle}` : formatShortAddress(p.wallet)}
            {p.xHandle && <> · <a className="underline" href={`https://x.com/${p.xHandle}`} target="_blank" rel="noopener noreferrer">@{p.xHandle}</a></>}
          </p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mt-3 ml-5">
        {p.xVerified && <Chip variant="green"><Check size={12} /> X verified</Chip>}
        <Chip>{p.completed} {p.completed === 1 ? "delivery" : "deliveries"} completed</Chip>
        {p.failed > 0 && <Chip variant="orange">{p.failed} missed</Chip>}
        <Chip variant="orange">{formatUsdc(Number(p.earned) / 1e6)} earned</Chip>
      </div>
      {p.bio && !isOwner && <p className="mt-4 ml-5 max-w-[60ch]">{p.bio}</p>}

      <div className={`grid gap-6 mt-8 items-start ${isOwner ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <section className="grid gap-4">
          <h2 className="font-extrabold text-2xl">Listings</h2>
          {cards.length === 0 ? (
            <Card className="p-6"><p className="muted">No listings yet.{isOwner && <> <Link className="underline" href="/studio">Create your first one</Link>.</>}</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cards.map((c) => (
                <div key={c.id} className="grid gap-2">
                  <ListingCardView card={c} mounted={mounted} />
                  {isOwner && <Link href={`/studio/${c.id}`} className="btn-base btn-small justify-self-start">Manage <ExternalLink size={12} /></Link>}
                </div>
              ))}
            </div>
          )}
        </section>

        {isOwner && (
          <Card className="p-5 grid gap-3 lg:sticky lg:top-24">
            <h3 className="font-bold text-lg">Edit your page</h3>
            <label className="grid gap-1"><span className="field-label">Display name</span>
              <input className={INPUT} maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
            <label className="grid gap-1"><span className="field-label">Handle (your page address)</span>
              <input className={INPUT} maxLength={31} value={form.handle} placeholder="yourname" onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} /></label>
            <label className="grid gap-1"><span className="field-label">Bio</span>
              <textarea className={INPUT} rows={3} maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
            <div className="grid gap-1.5"><span className="field-label">Banner color</span>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} aria-label={`Banner color ${c}`} aria-pressed={form.bannerColor === c} onClick={() => setForm({ ...form, bannerColor: c })}
                    className="w-8 h-8 rounded-lg border-2 border-[var(--line)] aria-pressed:shadow-[0_0_0_3px_var(--paper),0_0_0_5px_var(--ink)]" style={{ background: c }} />
                ))}
              </div>
            </div>
            <Button variant="primary" onClick={onSave} disabled={saving || !mine}>{saving ? "Saving…" : "Save profile"}</Button>
          </Card>
        )}
      </div>
    </main>
  );
}
