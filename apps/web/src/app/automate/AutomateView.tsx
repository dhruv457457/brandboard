"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, AtSign, Bot, Megaphone, ShieldCheck, Zap } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useProfile } from "@/lib/profile";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/Card";
import { SignInPrompt } from "@/components/ui/SignInPrompt";

interface Counts {
  autoBids: number | null;
  campaigns: number | null;
  offers: number | null;
}

/**
 * Automate: the three ways Patched bids for a brand without it being there, each with the Privy feature that keeps it
 * safe and how many of them are running now.
 */
export function AutomateView() {
  const { ready, authenticated, walletAddress } = usePatchedAuth();
  const { profile } = useProfile();
  const authedFetch = useAuthedFetch();
  const [counts, setCounts] = useState<Counts>({ autoBids: null, campaigns: null, offers: null });

  useEffect(() => {
    if (!authenticated || !walletAddress) return;
    let alive = true;
    authedFetch("/api/autobid")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { bids?: unknown[] } | null) => alive && j && setCounts((c) => ({ ...c, autoBids: j.bids?.length ?? 0 })))
      .catch(() => {});
    supabase().from("brand_campaigns").select("kind, status").eq("chain_id", CHAIN_ID).eq("brand", walletAddress.toLowerCase())
      .in("status", ["funding", "active", "paused", "ending"])
      .then(({ data }) => {
        if (!alive) return;
        const rows = data ?? [];
        setCounts((c) => ({ ...c, campaigns: rows.filter((r) => r.kind !== "x_offer").length, offers: rows.filter((r) => r.kind === "x_offer").length }));
      });
    return () => {
      alive = false;
    };
  }, [authenticated, walletAddress, authedFetch]);

  if (ready && !authenticated) {
    return <SignInPrompt icon={Bot} title="Automate your bidding" text="Keep your logo on top, spread a budget across an event, or offer a spot to anyone on X. Sign in to set one up." />;
  }

  const me = profile?.handle ?? walletAddress?.toLowerCase();
  const cards = [
    {
      icon: Zap,
      title: "Auto-bid",
      text: "Pick a spot and a maximum. When someone outbids you, Patched bids again from your own wallet, never above that maximum.",
      privy: "A Privy signer on your wallet, limited by a policy to those spots and that maximum. Revoke it any time in Settings.",
      count: counts.autoBids,
      noun: "running",
      href: "/explore",
      cta: "Pick a spot to protect",
      manage: { href: "/settings", label: "Manage permission" },
    },
    {
      icon: Megaphone,
      title: "Campaign",
      text: "Set a budget and a price cap per spot. Patched spreads your logo across every open spot at an event until the money is used.",
      privy: "Its own Privy wallet and policy. A budget aggregation refuses any bid that would go past the budget.",
      count: counts.campaigns,
      noun: "running",
      href: "/campaigns/new",
      cta: "Start a campaign",
      manage: me ? { href: `/${me}?tab=campaigns`, label: "Your campaigns" } : null,
    },
    {
      icon: AtSign,
      title: "Patch anyone on X",
      text: "Offer a spot to any X account, even one that isn't on Patched yet. They sign in with X, claim it and list.",
      privy: "A Privy wallet made ahead of time for their X account, so the offer can be funded before they ever sign up.",
      count: counts.offers,
      noun: "open",
      href: "/offers/new",
      cta: "Make an offer",
      manage: me ? { href: `/${me}?tab=campaigns`, label: "Your offers" } : null,
    },
  ];

  return (
    <div className="px-4 sm:px-6 py-6 pb-24 grid gap-6 max-w-5xl">
      <header className="grid gap-2">
        <span className="eyebrow">Automate</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Bid while you sleep</h1>
        <p className="text-[var(--muted)] max-w-[60ch]">
          Three ways to let Patched bid for you. Each one runs inside rules you set, enforced by Privy, so it can never spend more than you allowed.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title} className="p-5 grid gap-4 content-between">
            <div className="grid gap-3">
              <span className="flex items-center justify-between gap-3">
                <span className="w-11 h-11 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center"><c.icon size={22} /></span>
                {c.count !== null && c.count > 0 && (
                  <span className="text-xs font-bold rounded-full bg-[var(--accent)] text-[var(--on-accent)] px-2.5 py-1">{c.count} {c.noun}</span>
                )}
              </span>
              <h2 className="text-xl font-extrabold">{c.title}</h2>
              <p className="text-sm text-[var(--muted)]">{c.text}</p>
              <p className="text-xs text-[var(--muted)] flex gap-2 items-start border-t-[1.5px] border-[var(--soft)] pt-3">
                <ShieldCheck size={15} className="flex-none mt-0.5 text-[var(--accent-text)]" /> {c.privy}
              </p>
            </div>
            <div className="grid gap-2">
              <Link href={c.href} className="btn-base btn-primary justify-center">{c.cta} <ArrowRight size={15} /></Link>
              {c.manage && <Link href={c.manage.href} className="btn-base btn-small btn-ghost justify-center">{c.manage.label}</Link>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
