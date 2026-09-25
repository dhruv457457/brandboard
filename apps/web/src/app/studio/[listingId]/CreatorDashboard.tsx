"use client";

import { ListingTools } from "@/components/market/ListingTools";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { encodeFunctionData } from "viem";
import { Camera, X } from "lucide-react";
import { patchedMarketAbi } from "@patched/shared";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { MilestoneList } from "@/components/market/MilestoneList";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useAuthedFetch } from "@/lib/authedFetch";
import { EXPLORER, MARKET } from "@/lib/config";
import { formatCountdown, formatShortAddress, formatUsdc } from "@/lib/format";
import { fromWire, type ListingView, type Wire } from "@/lib/market/types";
import type { DeliveryView, MilestoneView } from "@/lib/market/server";
import { friendlyError } from "@/lib/market/useBid";
import { useTx } from "@/lib/market/useTx";

const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);
const STATUS: Record<number, string> = {
  0: "Waiting for approval", 1: "Bidding live", 2: "Delivering", 3: "Completed", 4: "Failed", 5: "Cancelled", 6: "Rejected", 7: "Closed with no bids",
};

export function CreatorDashboard({ listing: lw, delivery: dw }: { listing: Wire<ListingView>; delivery: Wire<DeliveryView> }) {
  const listing = useMemo(() => fromWire<ListingView>(lw), [lw]);
  const delivery = useMemo(() => fromWire<DeliveryView>(dw), [dw]);
  const router = useRouter();
  const { walletAddress } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const send = useTx();
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const isCreator = walletAddress?.toLowerCase() === listing.creator;
  const ended = mounted && Date.now() >= listing.biddingEndsAt;
  const paid = delivery.payouts.filter((p) => p.kind === "milestone" || p.kind === "dispute" || p.kind === "royalty").reduce((s, p) => s + p.amount, 0n);
  const publicHref = `/${listing.creatorHandle ?? listing.creator}/${listing.id}`;

  async function tx(key: string, label: string, data: `0x${string}`) {
    setBusy(key);
    try {
      await send(MARKET, data);
      await fetch("/api/indexer/sync", { method: "POST" });
      toast(label);
      router.refresh();
      return true;
    } catch (err) {
      toast(friendlyError(err).replace("The bid didn't", "That didn't"));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function upload(list: FileList) {
    setBusy("upload");
    try {
      for (const file of Array.from(list).slice(0, 8 - files.length)) {
        const form = new FormData();
        form.set("file", file);
        form.set("bucket", "proofs");
        const res = await authedFetch("/api/uploads", { method: "POST", body: form });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed.");
        setFiles((f) => [...f, json.url!]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitProof(m: MilestoneView) {
    if (!files.length) return toast("Add at least one photo as proof.");
    setBusy("proof");
    try {
      const res = await authedFetch("/api/proofs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ listingId: listing.id, milestone: m.idx, files, note }),
      });
      const json = (await res.json()) as { proofHash?: `0x${string}`; proofURI?: string; error?: string };
      if (!res.ok || !json.proofHash) throw new Error(json.error ?? "Couldn't save your proof.");
      setBusy(null);
      const ok = await tx("proof", "Proof submitted. Brands have 72 hours to review it.", encodeFunctionData({
        abi: patchedMarketAbi, functionName: "submitProof", args: [BigInt(listing.id), m.idx, json.proofHash, json.proofURI!],
      }));
      if (ok) {
        setFiles([]);
        setNote("");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't submit proof.");
      setBusy(null);
    }
  }

  function action(m: MilestoneView) {
    if (listing.status !== 2 || m.idx !== delivery.nextMilestone) return null;
    if (m.status === 0 && isCreator) {
      return (
        <div className="grid gap-2.5 mt-3 border-t-2 border-dashed border-[var(--soft)] pt-3">
          <p className="text-sm">
            {m.idx === 0 && listing.surface !== "car"
              ? "Upload photos of the printed patches (and your event ticket if you have one)."
              : "Upload photos showing the patches at the event or on the road."}
          </p>
          <div className="flex gap-2 flex-wrap">
            {files.map((f) => (
              <div key={f} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-[var(--line)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f} alt="Proof" className="w-full h-full object-cover" />
                <button aria-label="Remove photo" onClick={() => setFiles((x) => x.filter((y) => y !== f))}
                  className="absolute top-1 right-1 bg-[var(--ink)] text-[var(--paper)] rounded-full p-0.5"><X size={12} /></button>
              </div>
            ))}
            {files.length < 8 && (
              <button onClick={() => fileRef.current?.click()} disabled={!!busy}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center text-[var(--muted)]">
                <Camera size={20} />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden
            onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
          <textarea className="border-2 border-[var(--line)] rounded-xl px-3 py-2 bg-[var(--paper)] text-sm" rows={2} maxLength={500}
            placeholder="Optional note for the brands" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button variant="primary" className="justify-self-start" onClick={() => submitProof(m)} disabled={!!busy || !files.length}>
            {busy === "proof" ? "Submitting…" : busy === "upload" ? "Uploading…" : "Submit proof"}
          </Button>
        </div>
      );
    }
    if (m.status === 1 && m.reviewEndsAt && mounted && formatCountdown(m.reviewEndsAt).hasEnded) {
      return (
        <Button variant="primary" className="mt-3" disabled={!!busy}
          onClick={() => tx(`release${m.idx}`, "Payment released.", encodeFunctionData({ abi: patchedMarketAbi, functionName: "release", args: [BigInt(listing.id), m.idx] }))}>
          {busy === `release${m.idx}` ? "Releasing…" : "Release payment now"}
        </Button>
      );
    }
    return null;
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-6">
      <div className="flex justify-between items-end gap-4 flex-wrap">
        <div>
          <span className="eyebrow">Your listing · {STATUS[listing.status]}</span>
          <h1 className="font-extrabold text-4xl tracking-tight mt-1">{listing.title}</h1>
        </div>
        <ListingTools listingId={listing.id} pageHref={publicHref} status={listing.status} active="manage" />
      </div>

      <Card className="grid grid-cols-2 sm:grid-cols-4">
        <div className="kpi"><b>{usd(delivery.totalEscrow || listing.patches.reduce((s, p) => s + p.topBid, 0n))}</b><span>{listing.status === 1 ? "top bids so far" : "won in escrow"}</span></div>
        <div className="kpi"><b>{usd(paid)}</b><span>paid to you</span></div>
        <div className="kpi"><b>{delivery.receipts.length || listing.patches.filter((p) => p.topBidder).length}/{listing.patches.length}</b><span>patches won</span></div>
        <div className="kpi"><b>{usd(listing.bond)}</b><span>your bond</span></div>
      </Card>

      {listing.status === 1 && (
        <Card className="p-5 flex justify-between items-center gap-4 flex-wrap">
          <div>
            <b className="text-lg">{ended ? "Bidding has ended" : "Bidding is live"}</b>
            <p className="text-sm text-[var(--muted)]">
              {ended
                ? "The keeper closes it automatically within a minute. You can also close it now."
                : mounted ? `Ends in ${formatCountdown(listing.biddingEndsAt).text}. Winners are locked in when it closes.` : ""}
            </p>
          </div>
          {ended && (
            <Button variant="primary" disabled={!!busy}
              onClick={() => tx("close", "Bidding closed. Winners got their receipts.", encodeFunctionData({ abi: patchedMarketAbi, functionName: "closeBidding", args: [BigInt(listing.id)] }))}>
              {busy === "close" ? "Closing…" : "Close bidding"}
            </Button>
          )}
        </Card>
      )}

      <section className="grid gap-3">
        <h2 className="font-extrabold text-2xl">How you get paid</h2>
        <MilestoneList milestones={delivery.milestones} nextMilestone={delivery.nextMilestone} listingStatus={listing.status} mounted={mounted} renderAction={action} />
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-2">Winners</h3>
          {delivery.receipts.length ? (
            <ul className="ladder">
              {delivery.receipts.map((r) => (
                <li key={r.patchId}>
                  <span>{listing.patches.find((p) => p.id === r.patchId)?.label ?? `Patch ${r.patchId}`}</span>
                  <span className="font-mono">{formatShortAddress(r.owner)} · {usd(r.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--muted)]">Winners appear here when bidding closes.</p>}
        </Card>
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-2">Payments</h3>
          {delivery.payouts.length ? (
            <ul className="ladder">
              {delivery.payouts.map((p) => (
                <li key={p.tx + p.kind}>
                  <span className="capitalize">{p.kind === "milestone" ? `Milestone ${Number(p.milestone) + 1}` : p.kind}</span>
                  <a className="font-mono" href={`${EXPLORER}/tx/${p.tx}`} target="_blank" rel="noopener noreferrer">{usd(p.amount)}</a>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-[var(--muted)]">Nothing paid out yet. Payments arrive after each milestone&apos;s review window.</p>}
        </Card>
      </div>
    </main>
  );
}
