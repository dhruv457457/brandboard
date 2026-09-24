"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock, ExternalLink, Fuel, RotateCcw, ShieldCheck } from "lucide-react";
import { SurfaceFigure } from "@/components/surface/SurfaceFigure";
import type { PatchData, PatchHandle } from "@/components/surface/Patch";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Seg } from "@/components/ui/Seg";
import { toast } from "@/components/ui/Toast";
import { formatCountdown, formatShortAddress, formatTimeAgo, formatUsdc, parseUsdc } from "@/lib/format";
import { fromWire, type ListingView, type LivePatch, type Wire } from "@/lib/market/types";
import { useLiveListing } from "@/lib/market/useLiveListing";
import { useBid } from "@/lib/market/useBid";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { EXPLORER, GAS_SPONSORED, MARKET } from "@/lib/config";
import { encodeFunctionData } from "viem";
import { useRouter } from "next/navigation";
import { patchedMarketAbi } from "@patched/shared";
import { MilestoneList } from "@/components/market/MilestoneList";
import { DisputeSheet } from "@/components/market/DisputeSheet";
import { AutoBidPanel } from "@/components/market/AutoBidPanel";
import type { DeliveryView } from "@/lib/market/server";
import { useTx } from "@/lib/market/useTx";
import { friendlyError } from "@/lib/market/useBid";

const PASTELS = ["p2", "p3", "p1", "p4", "p5"] as const;
const STATUS_LABEL: Record<number, string> = {
  0: "Waiting for approval", 1: "Bidding live", 2: "Bidding closed", 3: "Completed",
  4: "Creator missed a deadline", 5: "Cancelled", 6: "Rejected", 7: "Closed with no bids",
};
const usd = (v: bigint) => formatUsdc(Number(v) / 1e6);

/** Same rule as the contract's _minNext, capped at buy-now. */
function minNextFor(p: LivePatch, minIncrement: bigint, minIncrementBps: number): bigint {
  if (p.topBid === 0n) return p.floor;
  let inc = (p.topBid * BigInt(minIncrementBps)) / 10_000n;
  if (inc < minIncrement) inc = minIncrement;
  const next = p.topBid + inc;
  return next > p.buyNow ? p.buyNow : next;
}

export function ListingRoom({ initial, delivery: dw }: { initial: Wire<ListingView>; delivery: Wire<DeliveryView> | null }) {
  const listing = useMemo(() => fromWire<ListingView>(initial), [initial]);
  const delivery = useMemo(() => (dw ? fromWire<DeliveryView>(dw) : null), [dw]);
  const router = useRouter();
  const send = useTx();
  const [disputeTarget, setDisputeTarget] = useState<{ milestone: number; milestoneName: string; reviewEndsAt: number | null; patchId: number; label: string } | null>(null);
  const { walletAddress, authenticated, login } = usePatchedAuth();
  const me = walletAddress?.toLowerCase();
  // The market rejects bids from a listing's own creator, so they get no bid controls.
  const isCreator = !!me && me === listing.creator.toLowerCase();
  const minNext = (p: LivePatch) => minNextFor(p, listing.minIncrement, listing.minIncrementBps);
  const patchRefs = useRef<Record<string | number, PatchHandle | null>>({});

  const { patches, bids, endsAt, status } = useLiveListing(listing, (bid, prevLeader) => {
    const ref = patchRefs.current[bid.patchId];
    ref?.ping();
    ref?.bump();
    if (prevLeader && prevLeader === me && bid.bidder !== me) {
      ref?.shake();
      toast(`You got outbid on ${bid.label}. Your USDC is back in your wallet.`, {
        action: { label: "Bid again", onClick: () => openSheet(bid.patchId) },
      });
    }
  });

  const [selectedId, setSelectedId] = useState<number>(() => (patches.find((p) => p.topBidder) ?? patches[0]).id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewSide, setViewSide] = useState<"front" | "back">("front");
  const [amountText, setAmountText] = useState("");
  // Time-based text (countdown, "2m ago") differs between server and browser, so render it after mount.
  const [mounted, setMounted] = useState(false);
  // The patch drop-in animation plays once on load; later bids only ping/bump.
  const [intro, setIntro] = useState(true);
  const [, tick] = useState(0);
  const { bid, status: txStatus, error, hash, reset } = useBid();

  useEffect(() => {
    setMounted(true);
    const introTimer = setTimeout(() => setIntro(false), 1600);
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      clearInterval(t);
      clearTimeout(introTimer);
    };
  }, []);

  const selected = patches.find((p) => p.id === selectedId) ?? patches[0];
  const countdown = formatCountdown(endsAt);
  const ago = (t: number) => (mounted ? formatTimeAgo(t) : "");
  const biddingOpen = status === 1 && !countdown.hasEnded;
  const escrow = patches.reduce((s, p) => s + p.topBid, 0n);
  const withBids = patches.filter((p) => p.topBidder).length;

  function openSheet(patchId: number) {
    const p = patches.find((x) => x.id === patchId);
    if (!p) return;
    setSelectedId(patchId);
    setViewSide(p.side);
    setAmountText(String(Number(minNext(p)) / 1e6));
    reset();
    setSheetOpen(true);
  }

  async function placeBid() {
    const amount = parseUsdc(amountText);
    if (amount < minNext(selected)) {
      toast(`Bid at least ${usd(minNext(selected))} to take the lead.`);
      return;
    }
    const ok = await bid(listing.id, selected.id, amount);
    if (ok) {
      setSheetOpen(false);
      const bought = amount >= selected.buyNow;
      toast(bought ? `${selected.label} is yours. Receipt NFT comes when bidding closes.` : `You lead ${selected.label} · ${usd(amount)} locked in escrow`);
      if (bought) patchRefs.current[selected.id]?.stamp();
    }
  }

  const figurePatches: PatchData[] = patches.filter((p) => !listing.canvasImageBack || p.side === viewSide).map((p) => ({
    id: p.id,
    name: p.label,
    x: p.x, y: p.y, w: p.w, h: p.h, r: p.r,
    floor: Number(p.floor) / 1e6,
    buyNow: Number(p.buyNow) / 1e6,
    topBid: Number(p.topBid) / 1e6,
    brand: p.topBidder ? (p.brandName ?? (p.topBidder === me ? "You" : formatShortAddress(p.topBidder))) : null,
    logo: p.logoUrl,
    c: PASTELS[p.id % PASTELS.length],
    bought: p.bought,
    mine: Boolean(me && p.topBidder === me),
  }));

  const creatorLabel = listing.creatorName ?? (listing.creatorHandle ? `@${listing.creatorHandle}` : formatShortAddress(listing.creator));
  const busy = txStatus === "signing" || txStatus === "confirming";

  return (
    <main className="wrap pt-6 pb-24">
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Link href="/explore" className="btn-base btn-ghost btn-small"><ArrowLeft size={14} /> Explore</Link>
        <span className="muted">/</span>
        <b>{listing.eventName ?? listing.title}</b>
        <Chip variant="monad" className="ml-auto">USDC · Monad</Chip>
      </div>

      <div className="grid gap-7 lg:grid-cols-[1.1fr_.9fr] items-start">
        <Card className="p-5">
          {listing.canvasImageBack && (
            <div className="flex justify-center mb-3">
              <Seg options={[{ value: "front", label: "Front" }, { value: "back", label: "Back" }]} value={viewSide} onChange={(v) => setViewSide(v as "front" | "back")} />
            </div>
          )}
          <div className={listing.surface === "car" ? "w-full" : listing.surface === "hoodie" ? "max-w-[480px] mx-auto" : "max-w-[400px] mx-auto"}>
            <SurfaceFigure
              surface={listing.surface}
              imageUrl={viewSide === "back" && listing.canvasImageBack ? listing.canvasImageBack : listing.canvasImage}
              patches={figurePatches}
              mode={biddingOpen ? "interactive" : "static"}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(Number(id))}
              patchRefs={patchRefs}
              animateDrop={intro}
            />
          </div>
          <div className="flex gap-4 justify-center flex-wrap text-[13px] muted mt-3">
            <span className="inline-flex items-center gap-1.5"><i className="sw-legend filled" />Leading bid</span>
            <span className="inline-flex items-center gap-1.5"><i className="sw-legend open" />Open</span>
            <span>Tap a patch to see its auction</span>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-4 flex gap-3.5 items-center">
            <div className="avatar-lg">{creatorLabel.replace("@", "").slice(0, 1).toUpperCase()}</div>
            <div className="min-w-0">
              <h3 className="text-[22px] font-extrabold truncate">{creatorLabel}</h3>
              <p className="muted text-sm">{listing.title}</p>
              {listing.creatorVerified && <Chip variant="green" className="mt-1.5"><Check size={12} /> X verified</Chip>}
            </div>
          </Card>

          <Card className="grid grid-cols-3">
            <div className="kpi">
              <b className={countdown.isUrgent ? "text-[var(--accent-text)]" : ""}>{!mounted ? " " : biddingOpen ? countdown.text : "—"}</b>
              <span>{biddingOpen ? "bidding ends" : STATUS_LABEL[status] ?? "Closed"}</span>
            </div>
            <div className="kpi"><b>{usd(escrow)}</b><span>top bids in escrow</span></div>
            <div className="kpi"><b>{withBids}/{patches.length}</b><span>patches with bids</span></div>
          </Card>

          <Card className="p-5">
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className="eyebrow">Patch · live auction</span>
                <h3 className="text-[26px] font-extrabold mt-1">{selected.label}</h3>
              </div>
              {selected.bought ? <Pill variant="won">Bought</Pill>
                : selected.topBidder === me && me ? <Pill variant="top">You lead</Pill>
                : selected.topBidder ? <Pill variant="top">Leading: {formatShortAddress(selected.topBidder)}</Pill>
                : <Pill variant="wait">No bids yet</Pill>}
            </div>
            <div className="font-mono text-[40px] font-semibold tracking-tight mt-2.5 tabular-nums">
              {usd(selected.topBid > 0n ? selected.topBid : selected.floor)}
            </div>
            <p className="muted text-[13px]">
              {selected.topBid > 0n ? `top bid · next bid at least ${usd(minNext(selected))}` : "floor price"} · buy now {usd(selected.buyNow)}
            </p>
            <ul className="ladder">
              {bids.filter((b) => b.patchId === selected.id).slice(0, 4).map((b) => (
                <li key={b.id}>
                  <span>{b.bidder === me ? "You" : formatShortAddress(b.bidder)}{b.isBuyNow ? " · buy now" : ""}</span>
                  <span className="font-mono">{usd(b.amount)} · {ago(b.time)}</span>
                </li>
              ))}
              {!bids.some((b) => b.patchId === selected.id) && <li><span className="muted">Be the first to bid on this patch</span></li>}
            </ul>
            {biddingOpen && !selected.bought ? (
              <div className="flex gap-2.5 flex-wrap">
                <Button variant="primary" onClick={() => openSheet(selected.id)}>Bid {usd(minNext(selected))}+</Button>
                <Button onClick={() => { openSheet(selected.id); setAmountText(String(Number(selected.buyNow) / 1e6)); }}>
                  Buy now {usd(selected.buyNow)}
                </Button>
              </div>
            ) : (
              <p className="muted text-sm">{STATUS_LABEL[status]}</p>
            )}
            <p className="text-xs muted flex items-center gap-1.5 mt-3"><Clock size={13} /> A bid in the last 5 minutes adds 5 minutes to the clock</p>
          </Card>

          <Card>
            <div className="flex justify-between items-center px-4 pt-3.5 pb-1">
              <h3 className="text-lg font-bold">Live activity</h3><span className="dot live" />
            </div>
            <ul className="feed">
              {bids.slice(0, 12).map((b) => {
                const label = patches.find((p) => p.id === b.patchId)?.label ?? `Patch ${b.patchId}`;
                return (
                  <li key={b.id}>
                    <span><b>{b.bidder === me ? "You" : formatShortAddress(b.bidder)}</b> bid on {label}</span>
                    <span className="font-mono">{usd(b.amount)} · {ago(b.time)}</span>
                  </li>
                );
              })}
              {bids.length === 0 && <li><span className="muted">No bids yet. The first bid shows up here instantly.</span></li>}
            </ul>
          </Card>
        </div>
      </div>

      {delivery && (
        <section className="mt-10 grid gap-3">
          <div className="flex justify-between items-end gap-3 flex-wrap">
            <h2 className="font-extrabold text-2xl">Delivery</h2>
            {me && me === listing.creator && <Link href={`/studio/${listing.id}`} className="btn-base btn-small">Manage your listing</Link>}
          </div>
          <p className="text-sm text-[var(--muted)] max-w-[70ch]">
            The winning bids sit in escrow. The creator gets paid in steps after posting proof, and each patch holder
            has 72 hours to dispute a proof for their own patch.
          </p>
          <MilestoneList
            milestones={delivery.milestones}
            nextMilestone={delivery.nextMilestone}
            listingStatus={status}
            mounted={mounted}
            renderAction={(m) => {
              const inReview = m.status === 1 && m.reviewEndsAt && mounted && Date.now() < m.reviewEndsAt;
              const mine = delivery.receipts.filter((r) => me && r.owner === me);
              if (!inReview || !mine.length) return null;
              return (
                <div className="flex gap-2 flex-wrap mt-3">
                  {mine.map((r) => {
                    const disputed = (m.disputedMask & (1 << r.patchId)) !== 0;
                    const key = `${m.idx}:${r.patchId}`;
                    const label = patches.find((p) => p.id === r.patchId)?.label ?? `Patch ${r.patchId}`;
                    return disputed ? (
                      <Pill key={key} variant="out">You disputed {label}</Pill>
                    ) : (
                      <Button key={key} size="small" variant="ghost"
                        onClick={() => setDisputeTarget({ milestone: m.idx, milestoneName: m.name, reviewEndsAt: m.reviewEndsAt, patchId: r.patchId, label })}>
                        Dispute {label}
                      </Button>
                    );
                  })}
                </div>
              );
            }}
          />
        </section>
      )}

      {disputeTarget && (
        <DisputeSheet
          open
          onClose={() => setDisputeTarget(null)}
          label={disputeTarget.label}
          milestoneName={disputeTarget.milestoneName}
          reviewEndsAt={disputeTarget.reviewEndsAt}
          onSubmit={async (reasonURI) => {
            try {
              await send(MARKET, encodeFunctionData({
                abi: patchedMarketAbi, functionName: "dispute",
                args: [BigInt(listing.id), disputeTarget.milestone, disputeTarget.patchId, reasonURI],
              }));
            } catch (err) {
              throw new Error(friendlyError(err).replace("The bid didn't", "That didn't"));
            }
            await fetch("/api/indexer/sync", { method: "POST" });
            toast(`Dispute opened for ${disputeTarget.label}. That payment is on hold until an admin decides.`);
            router.refresh();
          }}
        />
      )}

      <Sheet open={sheetOpen} onClose={() => !busy && setSheetOpen(false)} title={selected.label} description={
        selected.topBid > 0n ? `Top bid ${usd(selected.topBid)} · next bid at least ${usd(minNext(selected))}` : `No bids yet · floor ${usd(selected.floor)}`
      }>
        <div className="flex flex-col gap-4">
          {!isCreator && (
            <>
              <label className="field-label" htmlFor="bid-amount">Your bid</label>
              <div className="amt">
                <span>$</span>
                <input id="bid-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} disabled={busy} />
                <span>USDC</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[1, 5, 10].map((n) => (
                  <Button key={n} size="small" disabled={busy} onClick={() => setAmountText((v) => String((parseFloat(v) || 0) + n))}>+{n}</Button>
                ))}
                <Button size="small" variant="ghost" disabled={busy} onClick={() => setAmountText(String(Number(selected.buyNow) / 1e6))}>
                  Buy now {usd(selected.buyNow)}
                </Button>
              </div>
              <div className="perks">
                <div><span className="pi"><Fuel size={12} /></span>{GAS_SPONSORED ? "No gas needed. Patched pays the network fee." : "You pay a tiny network fee in MON."}</div>
                <div><span className="pi"><ShieldCheck size={12} /></span>Your USDC goes into escrow, not to the creator.</div>
                <div><span className="pi"><RotateCcw size={12} /></span>Outbid? Your USDC comes back instantly.</div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-[var(--red)]" role="alert">{error}</p>}
          {isCreator ? (
            <p className="rounded-xl bg-[var(--soft)] p-3 text-sm">
              This is your listing, so you can&apos;t bid on it. Share it so brands see it:{" "}
              <Link href={`/share/${listing.id}`} className="font-semibold underline">open the share kit</Link>.
            </p>
          ) : !authenticated ? (
            <Button variant="primary" onClick={login}>Sign in to bid</Button>
          ) : (
            <Button variant="primary" onClick={placeBid} disabled={busy}>
              {txStatus === "signing" ? "Approving USDC…" : txStatus === "confirming" ? "Placing bid…" : "Place bid"}
            </Button>
          )}
          {hash && (
            <a className="text-xs muted inline-flex items-center gap-1" href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
              View transaction <ExternalLink size={12} />
            </a>
          )}
          {authenticated && !isCreator && !selected.bought && biddingOpen && (
            <AutoBidPanel
              listingId={listing.id}
              patchId={selected.id}
              label={selected.label}
              minNext={minNext(selected)}
              buyNow={selected.buyNow}
              disabled={busy}
            />
          )}
        </div>
      </Sheet>
    </main>
  );
}
