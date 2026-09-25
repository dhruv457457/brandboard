"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Pencil, Settings2, Share2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListingCardView } from "@/components/market/ListingCardView";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { SHAREABLE } from "@/lib/market/listingStatus";
import { fromWire, type Wire } from "@/lib/market/types";
import type { ListingCard } from "@/lib/market/server";

export interface PublicProfile {
  wallet: string;
  handle: string | null;
  displayName: string | null;
  xHandle: string | null;
  xVerified: boolean;
  avatarUrl: string | null;
  bio: string | null;
  bannerColor: string;
  completed: number;
  failed: number;
  earned: string;
}

const PASTELS = ["var(--p1)", "var(--p2)", "var(--p3)", "var(--p4)", "var(--p5)"];

/** Two pastels picked from the wallet address, so every wallet gets its own avatar without a picture. */
function walletGradient(wallet: string) {
  const a = parseInt(wallet.slice(2, 4), 16) % PASTELS.length;
  const b = (a + 1 + (parseInt(wallet.slice(4, 6), 16) % (PASTELS.length - 1))) % PASTELS.length;
  return `linear-gradient(135deg, ${PASTELS[a]}, ${PASTELS[b]})`;
}

export function ProfileView({ profile: p, cards: wire }: { profile: PublicProfile; cards: Wire<ListingCard[]> }) {
  const cards = useMemo(() => fromWire<ListingCard[]>(wire), [wire]);
  const { walletAddress } = usePatchedAuth();
  const isOwner = walletAddress?.toLowerCase() === p.wallet;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // A real name when there is one; otherwise the short address, shown once.
  const named = p.displayName || (p.handle ? `@${p.handle}` : p.xHandle ? `@${p.xHandle}` : null);
  const name = named ?? formatShortAddress(p.wallet);
  const banner = p.bannerColor;

  return (
    <main className="wrap pt-8 pb-24">
      <div className="h-[170px] rounded-[22px] border-2 border-[var(--line)] relative overflow-hidden shadow-[4px_4px_0_var(--shadow)]" style={{ background: banner }}>
        <div className="absolute inset-3 border-2 border-dashed border-black/30 rounded-[14px]" />
        <span className="absolute right-5 -bottom-4 font-extrabold text-[110px] leading-none tracking-[-.06em] text-black/10 select-none" aria-hidden="true">patched</span>
      </div>
      <div className="flex gap-4 items-end -mt-11 ml-5 relative flex-wrap">
        <div className="w-[100px] h-[100px] rounded-[26px] border-[3px] border-[var(--line)] grid place-items-center overflow-hidden font-extrabold text-4xl text-[#0B0B0C] shadow-[4px_4px_0_var(--shadow)]"
          style={{ background: walletGradient(p.wallet) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" /> : named ? named.replace("@", "").slice(0, 1).toUpperCase() : null}
        </div>
        <div className="pb-1.5">
          <h1 className="font-extrabold text-4xl tracking-tight">{name}</h1>
          <p className="muted text-sm">
            {named ? (p.handle ? `patched / ${p.handle}` : formatShortAddress(p.wallet)) : "Creator on Patched"}
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
      {p.bio && <p className="mt-4 ml-5 max-w-[60ch]">{p.bio}</p>}
      {isOwner && (
        <div className="flex gap-2 flex-wrap mt-4 ml-5">
          <Link href="/settings" className="btn-base btn-small"><Pencil size={13} /> Edit profile</Link>
          {!p.handle && <Link href="/settings" className="btn-base btn-small btn-ghost">Pick a handle for a short page address</Link>}
        </div>
      )}

      <div className="grid gap-6 mt-8 items-start">
        <section className="grid gap-4">
          <h2 className="font-extrabold text-2xl">Listings</h2>
          {cards.length === 0 ? (
            <Card className="p-6"><p className="muted">No listings yet.{isOwner && <> <Link className="underline" href="/studio">Create your first one</Link>.</>}</p></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {cards.map((c) => (
                <div key={c.id} className="grid gap-2">
                  <ListingCardView card={c} mounted={mounted} />
                  {isOwner && (
                    <div className="flex gap-2">
                      <Link href={`/studio/${c.id}`} className="btn-base btn-small"><Settings2 size={13} /> Manage</Link>
                      {SHAREABLE.has(c.status) && <Link href={`/share/${c.id}`} className="btn-base btn-small"><Share2 size={13} /> Share</Link>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
