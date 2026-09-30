"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";

interface Offer {
  id: string;
  budget: number;
  status: string;
  target_x_handle: string;
  message: string | null;
}

/** Open offers made to the signed-in person's X account ("Patch anyone on X"), at the top of their home. */
export function OffersForYou() {
  const { authenticated } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    authedFetch("/api/offers")
      .then((r) => (r.ok ? r.json() : { received: [] }))
      .then((j: { received: Offer[] }) => alive && setOffers(j.received.filter((o) => o.status === "active" || o.status === "funding")))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authenticated, authedFetch]);

  if (!offers.length) return null;
  return (
    <section aria-label="Offers for you" className="px-4 sm:px-5 py-4 border-b-[1.5px] border-[var(--soft)] grid gap-2">
      {offers.map((o) => (
        <Link key={o.id} href={`/offers/${o.id}`} className="flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)] p-3.5 hover:brightness-[0.98]">
          <span className="w-10 h-10 rounded-xl bg-[var(--accent)] grid place-items-center flex-none"><Gift size={19} className="text-[#0B0B0C]" /></span>
          <span className="grid min-w-0">
            <b>A brand wants to patch you: ${(Number(o.budget) / 1e6).toLocaleString("en-US")}</b>
            <span className="text-sm truncate">{o.message ?? "Open the offer to claim it and list a spot."}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
