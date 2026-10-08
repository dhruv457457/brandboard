"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { encodeFunctionData, erc20Abi } from "viem";
import { CalendarClock, Check, ChevronDown, Copy, ExternalLink, Gift, Loader2, ShieldCheck } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";
import { EXPLORER, USDC } from "@/lib/config";
import { formatShortAddress, formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markOfferSeen } from "@/components/market/OffersForYou";

export interface OfferInfo {
  id: string;
  brand: string;
  brandName: string | null;
  brandLogo: string | null;
  handle: string;
  name: string;
  avatar: string | null;
  targetWallet: string;
  amount: number;
  advance: number;
  message: string | null;
  eventId: number;
  eventName: string;
  eventHref: string;
  endsAt: number;
  walletAddress: string;
  status: "funding" | "active" | "paused" | "ending" | "ended";
  claimed: boolean;
  pregenerated: boolean;
  actions: { id: string; kind: string; text: string; txHash: string | null; at: string }[];
}

const STATUS: Record<OfferInfo["status"], { label: string; bg: string }> = {
  funding: { label: "Waiting for the money", bg: "bg-[var(--p3)]" },
  active: { label: "Open", bg: "bg-[var(--green-soft)] text-[var(--green)]" },
  paused: { label: "Paused", bg: "bg-[var(--soft)]" },
  ending: { label: "Closing", bg: "bg-[var(--soft)]" },
  ended: { label: "Closed", bg: "bg-[var(--soft)]" },
};

/** One offer: who it's for, the money, the claim button for them, and the share tools for the brand. */
export function OfferView({ offer: o }: { offer: OfferInfo }) {
  // Once you have looked at an offer, Home stops nudging you about it.
  useEffect(() => markOfferSeen(o.id), [o.id]);
  const router = useRouter();
  const { authenticated, walletAddress, xHandle, login } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const me = walletAddress?.toLowerCase();
  const isBrand = me === o.brand;
  const isTarget = me === o.targetWallet || (!!xHandle && xHandle.toLowerCase() === o.handle.toLowerCase());
  const open = o.status === "active" || o.status === "funding";
  const brand = o.brandName ?? formatShortAddress(o.brand);
  const url = typeof window === "undefined" ? `/offers/${o.id}` : `${window.location.origin}/offers/${o.id}`;
  const post = `@${o.handle} we'd like to patch you at ${o.eventName}. $${o.amount} in USDC is waiting for you on Patched: ${url}`;

  async function claim() {
    if (!authenticated) return login();
    setBusy("Claiming…");
    try {
      const res = await authedFetch(`/api/offers/${o.id}/claim`, { method: "POST" });
      const j = (await res.json()) as { advanced?: string; eventId?: number; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Couldn't claim the offer.");
      const advanced = Number(j.advanced ?? 0) / 1e6;
      toast(advanced > 0 ? `Claimed. ${advanced} USDC for your listing stake is in your wallet.` : "Claimed. Now list a spot at the event.");
      router.push(`/studio?event=${o.eventId}&offer=${o.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't claim the offer.");
    } finally {
      setBusy(null);
    }
  }

  async function fund() {
    setBusy(`Putting $${o.amount} in the offer…`);
    try {
      await send(USDC, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [o.walletAddress as `0x${string}`, BigInt(Math.round(o.amount * 1e6))] }));
      authedFetch(`/api/campaigns/${o.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ run: true }) }).catch(() => {});
      toast("Funded. The offer is open.");
      router.refresh();
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "The transfer didn't"));
    } finally {
      setBusy(null);
    }
  }

  async function end() {
    setBusy("Closing…");
    try {
      const res = await authedFetch(`/api/campaigns/${o.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "ending" }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't close the offer.");
      toast("Closed. What's left is on its way back to your wallet.");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't close the offer.");
    } finally {
      setBusy(null);
    }
  }

  const s = STATUS[o.status];
  const until = new Date(o.endsAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="px-4 sm:px-6 py-7 grid gap-6 max-w-[760px]">
      <div className="rounded-3xl border-[1.5px] border-[var(--soft)] bg-[var(--card)] p-6 sm:p-7 grid gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="eyebrow flex items-center gap-1.5"><Gift size={14} /> Offer</span>
          <span className={cn("inline-flex items-center gap-2 h-8 px-3 rounded-full text-sm font-bold", s.bg)}>
            {o.status === "active" && <span className="dot live" />}{s.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Avatar src={o.brandLogo} name={brand} wallet={o.brand} size={52} className="!rounded-2xl" />
          <span className="text-2xl font-extrabold text-[var(--muted)]" aria-hidden>→</span>
          <Avatar src={o.avatar} name={o.handle} size={52} />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          {brand} wants to patch <a href={`https://x.com/${o.handle}`} target="_blank" rel="noopener noreferrer" className="underline decoration-[var(--accent)] decoration-4 underline-offset-4">@{o.handle}</a>
        </h1>
        <div className="flex items-end gap-3 flex-wrap">
          <b className="font-mono text-5xl tabular-nums">${o.amount.toLocaleString("en-US")}</b>
          <span className="text-[var(--muted)] pb-1.5">USDC for a spot at <Link href={o.eventHref} className="font-semibold text-[var(--ink)] hover:underline">{o.eventName}</Link></span>
        </div>
        {o.message && <blockquote className="m-0 border-l-4 border-[var(--accent)] pl-4 text-[17px]">{o.message}</blockquote>}
        <p className="text-sm text-[var(--muted)] flex items-center gap-2"><CalendarClock size={15} /> Open until {until}. Unclaimed money goes back to {brand}.</p>

        {isTarget && open && (
          <div className="rounded-2xl bg-[var(--accent-soft)] p-4 grid gap-3">
            <b className="text-lg">This offer is for you</b>
            <p className="text-sm">
              Claim it, then list a spot at {o.eventName}. Price a spot&apos;s buy-now at ${o.amount} or less and the offer buys it as soon as your listing is approved.
              {o.advance > 0 && <> If your wallet is empty, the offer pays your {o.advance} USDC listing stake.</>}
            </p>
            <button type="button" onClick={claim} disabled={!!busy || o.status !== "active"} className="btn-base btn-primary justify-self-start">
              {busy ?? (o.status === "active" ? "Claim and list a spot" : "Waiting for the brand's money")}
            </button>
          </div>
        )}
        {!authenticated && open && (
          <div className="rounded-2xl bg-[var(--soft)] p-4 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm">Are you <b>@{o.handle}</b>? Sign in with that X account. Your Patched wallet is already set up.</span>
            <button type="button" onClick={login} className="btn-base btn-primary">Sign in with X</button>
          </div>
        )}

        {isBrand && (
          <div className="grid gap-3 border-t-[1.5px] border-[var(--soft)] pt-4">
            <b>Make sure @{o.handle} sees it</b>
            <div className="flex gap-2 flex-wrap">
              <a className="btn-base btn-primary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post)}`} target="_blank" rel="noopener noreferrer">
                Post on X <ExternalLink size={14} />
              </a>
              <button type="button" className="btn-base" onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
              </button>
              {o.status === "funding" && <button type="button" className="btn-base" onClick={fund} disabled={!!busy}>{busy ?? `Fund $${o.amount}`}</button>}
              {(o.status === "active" || o.status === "funding") && <button type="button" className="btn-base btn-ghost" onClick={end} disabled={!!busy}>Close offer</button>}
            </div>
            {busy && <span className="text-sm text-[var(--muted)] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> {busy}</span>}
          </div>
        )}
      </div>

      {/* The rules are there for anyone who wants them, but closed by default: most people only need the offer above. */}
      <details className="group rounded-2xl bg-[#0B0B0C] text-[#FAFAF7] px-4 py-3 sm:px-5 grid gap-3">
        <summary className="flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="w-7 h-7 rounded-lg bg-[var(--accent)] grid place-items-center flex-none"><ShieldCheck size={15} className="text-[#0B0B0C]" /></span>
          <b className="text-[15px] flex-1">How this money is protected</b>
          <ChevronDown size={16} className="text-[#A8A69E] transition-transform group-open:rotate-180" />
        </summary>
        <p className="text-[13px] text-[#A8A69E]">
          {o.pregenerated ? `Privy made @${o.handle}'s wallet when the offer was made. ` : ""}The money sits in its own Privy wallet with its own policy, so nobody has to trust us with it.
        </p>
        <ul className="grid gap-2 text-sm text-[#C9C7BF] list-none p-0 m-0">
          <li>It only bids for {brand}, only on @{o.handle}&apos;s spots, and never more than ${o.amount} in total. Privy adds up every bid it signs.</li>
          {o.advance > 0 && <li>It may send @{o.handle} their {o.advance} USDC listing stake, to their wallet only.</li>}
          <li>After {until}, what&apos;s left goes back to {brand}.</li>
        </ul>
        <a href={`${EXPLORER}/address/${o.walletAddress}`} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#A8A69E] hover:text-white inline-flex items-center gap-1">
          Offer wallet {formatShortAddress(o.walletAddress)} <ExternalLink size={12} />
        </a>
      </details>

      {o.actions.length > 0 && (
        <section className="grid gap-2">
          <h2 className="text-xl font-extrabold">What happened</h2>
          <ul className="grid gap-1.5 list-none p-0 m-0">
            {o.actions.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl bg-[var(--card)] border-[1.5px] border-[var(--soft)] px-3.5 py-2.5 text-sm">
                <span>{a.text}</span>
                <span className="flex items-center gap-2 text-[var(--muted)] flex-none">
                  {formatTimeAgo(a.at)}
                  {a.txHash && <a href={`${EXPLORER}/tx/${a.txHash}`} target="_blank" rel="noopener noreferrer" aria-label="View transaction"><ExternalLink size={12} /></a>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
