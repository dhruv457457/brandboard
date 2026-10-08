"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, X } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";

interface Offer {
  id: string;
  budget: number;
  status: string;
  target_x_handle: string;
  message: string | null;
}

const SEEN = "patched:offers-seen";

/** Offers this device has opened or closed already: the Home banner stops showing them (the offer page still opens). */
function seenOffers(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function markOfferSeen(id: string) {
  try {
    const all = seenOffers().filter((x) => x !== id);
    all.push(id);
    localStorage.setItem(SEEN, JSON.stringify(all.slice(-100)));
  } catch {
    // Storage can be blocked: the banner then simply stays, as before.
  }
}

/** Open offers made to the signed-in person's X account ("Patch anyone on X"), at the top of their home. */
export function OffersForYou() {
  const { authenticated, ready } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => setSeen(seenOffers()), []);

  useEffect(() => {
    if (!ready || !authenticated) return;
    let alive = true;
    authedFetch("/api/offers")
      .then((r) => (r.ok ? r.json() : { received: [] }))
      .then((j: { received: Offer[] }) => alive && setOffers(j.received.filter((o) => o.status === "active" || o.status === "funding")))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, authenticated, authedFetch]);

  const shown = offers.filter((o) => !seen.includes(o.id));
  if (!shown.length) return null;
  return (
    <section aria-label="Offers for you" className="px-4 sm:px-5 py-2.5 md:py-4 border-b-[1.5px] border-[var(--soft)] grid gap-2">
      {shown.map((o) => (
        <div key={o.id} className="relative">
        <Link href={`/offers/${o.id}`} onClick={() => markOfferSeen(o.id)} className="flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)] p-2.5 md:p-3.5 pr-10 hover:brightness-[0.98]">
          <span className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[var(--accent)] grid place-items-center flex-none"><Gift size={18} className="text-[#0B0B0C]" /></span>
          <span className="grid min-w-0">
            <b>A brand wants to patch you: ${(Number(o.budget) / 1e6).toLocaleString("en-US")}</b>
            <span className="text-sm truncate hidden sm:block">{o.message ?? "Open the offer to claim it and list a spot."}</span>
          </span>
        </Link>
          <button type="button" aria-label="Hide this offer" onClick={() => { markOfferSeen(o.id); setSeen(seenOffers()); }}
            className="absolute top-1/2 -translate-y-1/2 right-2 w-7 h-7 rounded-full grid place-items-center hover:bg-black/10">
            <X size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}
