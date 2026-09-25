"use client";

import PageLoading from "@/app/loading";
import { useEffect, useState } from "react";
import Link from "next/link";
import { erc20Abi } from "viem";
import { AlertCircle, Check, Copy, ExternalLink, Plus, Share2, Settings2, Wallet } from "lucide-react";
import { patchedMarketAbi, type ListingMetadata } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { CHAIN_ID, EXPLORER, MARKET, USDC, publicClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatShortAddress, formatTimeAgo, formatUsdc } from "@/lib/format";

const usd = (v: number | bigint | string) => formatUsdc(Number(v) / 1e6);

const STATUS: Record<number, { label: string; variant: "top" | "wait" | "won" | "out" }> = {
  0: { label: "Waiting for approval", variant: "wait" },
  1: { label: "Live auction", variant: "top" },
  2: { label: "Delivering", variant: "top" },
  3: { label: "Completed", variant: "won" },
  4: { label: "Failed", variant: "out" },
  5: { label: "Cancelled", variant: "out" },
  6: { label: "Rejected", variant: "out" },
  7: { label: "Unsold", variant: "wait" },
};

interface ListingRow {
  listing_id: number;
  status: number;
  surface: number;
  bidding_ends_at: string;
  patch_count: number;
  patches_with_bids: number;
  top_bids_total: number;
  total_escrow: number;
  next_milestone: number;
  metadata: ListingMetadata | null;
}
interface MilestoneRow { listing_id: number; idx: number; status: number; deadline: string; review_ends_at: string | null }
interface PayoutRow { listing_id: number; kind: string; milestone: number | null; amount: number; block_time: string; tx_hash: string }

const PAYOUT_LABEL: Record<string, string> = { milestone: "Milestone payout", dispute: "Dispute settled", royalty: "Resale royalty", bond: "Bond returned" };

/** The creator's home: wallet, earnings, what needs doing, every listing with manage/share, payouts. */
export default function DashboardPage() {
  const { ready, authenticated, login, walletAddress } = usePatchedAuth();
  const { profile } = useProfile();
  const wallet = walletAddress?.toLowerCase();
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [openDisputes, setOpenDisputes] = useState<{ listing_id: number; patch_id: number }[]>([]);
  const [bidCount, setBidCount] = useState(0);
  const [earned, setEarned] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    (async () => {
      const db = supabase();
      const { data: rows } = await db.from("listing_cards")
        .select("listing_id, status, surface, bidding_ends_at, patch_count, patches_with_bids, top_bids_total, total_escrow, next_milestone, metadata")
        .eq("chain_id", CHAIN_ID).eq("creator", wallet).order("created_block", { ascending: false });
      const ids = (rows ?? []).map((r) => r.listing_id);
      const [ms, pay, disp, bids, rep, bal] = await Promise.all([
        ids.length ? db.from("milestones").select("listing_id, idx, status, deadline, review_ends_at").eq("chain_id", CHAIN_ID).in("listing_id", ids) : { data: [] },
        ids.length ? db.from("payouts").select("listing_id, kind, milestone, amount, block_time, tx_hash").eq("chain_id", CHAIN_ID).in("listing_id", ids).in("kind", ["milestone", "dispute", "royalty", "bond"]).order("block_time", { ascending: false }) : { data: [] },
        ids.length ? db.from("disputes").select("listing_id, patch_id").eq("chain_id", CHAIN_ID).eq("resolved", false).in("listing_id", ids) : { data: [] },
        ids.length ? db.from("bids").select("*", { count: "exact", head: true }).eq("chain_id", CHAIN_ID).in("listing_id", ids) : { count: 0 },
        publicClient.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "reputation", args: [wallet as `0x${string}`] }).catch(() => null),
        publicClient.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet as `0x${string}`] }).catch(() => null),
      ]);
      if (!alive) return;
      setListings((rows ?? []) as ListingRow[]);
      setMilestones((ms.data ?? []) as MilestoneRow[]);
      setPayouts((pay.data ?? []) as PayoutRow[]);
      setOpenDisputes((disp.data ?? []) as { listing_id: number; patch_id: number }[]);
      setBidCount(("count" in bids ? bids.count : 0) ?? 0);
      setEarned(rep ? rep[2] : null);
      setBalance(bal);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [wallet]);

  if (!ready) return <PageLoading />;
  if (!authenticated || !wallet) {
    return (
      <main className="wrap py-16 grid place-items-center text-center gap-4">
        <h1 className="text-4xl font-extrabold">Your dashboard</h1>
        <p className="muted max-w-md">Sign in to see your listings, earnings, payouts and share links.</p>
        <Button variant="primary" onClick={login}>Sign in</Button>
      </main>
    );
  }

  const pageHref = `/${profile?.handle ?? wallet}`;
  const hrefOf = (id: number) => `${pageHref}/${id}`;
  const titleOf = (l: ListingRow) => l.metadata?.title ?? `Listing #${l.listing_id}`;
  const live = listings.filter((l) => l.status === 1);
  const inEscrow = listings.filter((l) => l.status === 1 || l.status === 2).reduce((s, l) => s + Number(l.status === 1 ? l.top_bids_total : l.total_escrow), 0);

  // What needs the creator's attention, most urgent first.
  const todo: { text: string; href: string; action: string }[] = [];
  for (const l of listings) {
    if (l.status === 0) todo.push({ text: `${titleOf(l)} is waiting for approval by the Patched team.`, href: hrefOf(l.listing_id), action: "View" });
    if (l.status === 2) {
      const m = milestones.find((x) => x.listing_id === l.listing_id && x.idx === l.next_milestone);
      if (m && m.status === 0) {
        const name = l.metadata?.milestones?.[m.idx]?.name ?? `Milestone ${m.idx + 1}`;
        todo.push({ text: `Upload proof for "${name}" on ${titleOf(l)} by ${new Date(m.deadline).toLocaleDateString()}.`, href: `/studio/${l.listing_id}`, action: "Upload proof" });
      }
    }
  }
  for (const d of openDisputes) {
    const l = listings.find((x) => x.listing_id === d.listing_id);
    todo.push({ text: `A brand disputed a patch on ${l ? titleOf(l) : `listing #${d.listing_id}`}. An admin will decide.`, href: `/studio/${d.listing_id}`, action: "See details" });
  }

  return (
    <main className="wrap py-8 grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1 className="text-4xl font-extrabold tracking-tight mt-1">{profile?.display_name ?? (profile?.handle ? `@${profile.handle}` : "Your listings")}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm muted flex-wrap">
            <Wallet size={14} />
            <span className="font-mono">{formatShortAddress(wallet)}</span>
            <button
              className="inline-flex items-center gap-1 hover:text-[var(--ink)]"
              onClick={() => { navigator.clipboard.writeText(wallet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
            </button>
            <a className="inline-flex items-center gap-1 hover:text-[var(--ink)]" href={`${EXPLORER}/address/${wallet}`} target="_blank" rel="noopener noreferrer">
              Explorer <ExternalLink size={12} />
            </a>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href={pageHref} className="btn-base">View my page</Link>
          <Link href="/studio" className="btn-base btn-primary"><Plus size={16} /> New listing</Link>
        </div>
      </header>

      <Card className="grid grid-cols-2 md:grid-cols-5 p-0">
        <div className="kpi"><b>{earned === null ? "…" : usd(earned)}</b><span>Earned so far</span></div>
        <div className="kpi"><b>{loading ? "…" : usd(inEscrow)}</b><span>In escrow for you</span></div>
        <div className="kpi"><b>{loading ? "…" : live.length}</b><span>Live auctions</span></div>
        <div className="kpi"><b>{loading ? "…" : bidCount}</b><span>Bids received</span></div>
        <div className="kpi"><b>{balance === null ? "…" : usd(balance)}</b><span>Wallet balance</span></div>
      </Card>

      {todo.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-2xl font-extrabold">Needs your attention</h2>
          {todo.map((t, i) => (
            <Card key={i} className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="flex items-center gap-2.5 text-sm"><AlertCircle size={18} className="text-[var(--accent-text)] flex-none" />{t.text}</span>
              <Link href={t.href} className="btn-base btn-small">{t.action}</Link>
            </Card>
          ))}
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-2xl font-extrabold">Your listings</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : listings.length === 0 ? (
          <Card className="p-6 grid gap-3 justify-items-start">
            <p>You haven&apos;t listed anything yet. Put patches on your outfit, car or team hoodie and let brands bid.</p>
            <Link href="/studio" className="btn-base btn-primary"><Plus size={16} /> Create your first listing</Link>
          </Card>
        ) : (
          <div className="grid gap-3">
            {listings.map((l) => {
              const s = STATUS[l.status] ?? { label: "Unknown", variant: "wait" as const };
              return (
                <Card key={l.listing_id} className="p-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {l.metadata?.canvasImage && <img src={l.metadata.canvasImage} alt="" className="w-14 h-20 object-cover rounded-lg border-2 border-[var(--line)] flex-none" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <b className="text-lg truncate">{titleOf(l)}</b>
                        <Pill variant={s.variant}>{s.label}</Pill>
                      </div>
                      <p className="text-sm muted mt-0.5">
                        {l.patches_with_bids}/{l.patch_count} patches with bids · {usd(l.status === 1 ? l.top_bids_total : l.total_escrow)}{" "}
                        {l.status === 1 ? `in top bids · ends ${new Date(l.bidding_ends_at).toLocaleString()}` : "in escrow"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Link href={hrefOf(l.listing_id)} className="btn-base btn-small">Open</Link>
                    <Link href={`/studio/${l.listing_id}`} className="btn-base btn-small"><Settings2 size={13} /> Manage</Link>
                    <Link href={`/share/${l.listing_id}`} className="btn-base btn-small btn-primary"><Share2 size={13} /> Share</Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-2xl font-extrabold">Payouts</h2>
        {payouts.length === 0 ? (
          <Card className="p-5"><p className="muted text-sm">No payouts yet. After bidding closes and you post proof, milestone payments land here.</p></Card>
        ) : (
          <Card className="p-0">
            <ul className="ladder m-0 px-4">
              {payouts.map((p) => {
                const l = listings.find((x) => x.listing_id === p.listing_id);
                return (
                  <li key={`${p.tx_hash}:${p.kind}:${p.milestone}`}>
                    <span>{PAYOUT_LABEL[p.kind] ?? p.kind} · {l ? titleOf(l) : `#${p.listing_id}`}</span>
                    <span className="font-mono inline-flex gap-2 items-center">
                      {usd(p.amount)} · {formatTimeAgo(p.block_time)}
                      <a href={`${EXPLORER}/tx/${p.tx_hash}`} target="_blank" rel="noopener noreferrer" aria-label="View transaction"><ExternalLink size={12} /></a>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <Card className="p-5 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm">Bidding as a brand? Your bids, won patches and receipt NFTs are on My bids.</span>
        <Link href="/bids" className="btn-base btn-small">Go to My bids</Link>
      </Card>
    </main>
  );
}
