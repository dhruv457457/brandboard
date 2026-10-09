import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Circle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { SvgCard } from "@/components/nft/TokenCard";
import { VerifyProof, type ProofRow } from "@/components/nft/VerifyProof";
import { ResaleBox } from "@/components/nft/ResaleBox";
import { ShareRow } from "@/components/nft/ShareRow";
import { CHAIN_ID, EXPLORER, MARKET } from "@/lib/config";
import { formatShortAddress, formatUsdc } from "@/lib/format";
import { ipfsUrl } from "@/lib/ipfs";
import { cardSvg, displayBrand, displayCreator, facts, STAGE_LABEL } from "@/lib/nft/token";
import { getNftPage, getTimeline, type TimelineEvent } from "@/lib/server/nft";
import { supabase } from "@/lib/supabase";

// A token's stage changes when proofs land, so the page is rebuilt often; the card itself is read from the chain.
export const revalidate = 20;

const dayOf = (iso: string | number) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(typeof iso === "number" ? iso * 1000 : iso));

type Params = { params: Promise<{ tokenId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tokenId } = await params;
  const page = /^\d{1,30}$/.test(tokenId) ? await getNftPage(BigInt(tokenId)).catch(() => null) : null;
  if (!page) return { title: "Patch" };
  const t = page.token;
  const title = `${displayBrand(t)} on ${t.label}: ${t.sponsorNo > 0 ? `Sponsor No.${t.sponsorNo} of` : "sponsor of"} ${displayCreator(t)}`;
  const description = `${STAGE_LABEL[t.stage]}. A patch NFT that changes as ${displayCreator(t)} proves each step. Won for ${formatUsdc(t.amount)} on Patched.`;
  const image = `/patch/${tokenId}/card.png?v=${t.stage}${t.proofsDone}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1000, height: 1000 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PatchPage({ params }: Params) {
  const { tokenId } = await params;
  if (!/^\d{1,30}$/.test(tokenId)) notFound();
  const page = await getNftPage(BigInt(tokenId));
  if (!page) notFound();
  const { token: t, holder, proofs } = page;

  const db = supabase();
  const [timeline, { data: people }] = await Promise.all([
    getTimeline(t.listingId).catch(() => [] as TimelineEvent[]),
    db.from("profiles").select("wallet, handle, display_name, brand_name, brand_logo_url, avatar_url").in("wallet", [t.creator.toLowerCase(), holder.toLowerCase(), t.winner.toLowerCase()]),
  ]);
  const creator = people?.find((p) => p.wallet === t.creator.toLowerCase());
  const holderProfile = people?.find((p) => p.wallet === holder.toLowerCase());
  const creatorHref = `/${creator?.handle ?? t.creator.toLowerCase()}`;
  const listingHref = `${creatorHref}/${t.listingId}`;
  const holderHref = `/${holderProfile?.handle ?? holder.toLowerCase()}`;

  const photo = t.stage === "printed" || t.stage === "seen" || t.stage === "delivered" ? ipfsUrl(t.coverURI) : null;
  const winnerProfile = people?.find((p) => p.wallet === t.winner.toLowerCase());
  const svg = cardSvg(t, { id: "page", photo, brandLogo: winnerProfile?.brand_logo_url ?? null, creatorAvatar: creator?.avatar_url ?? null });
  const f = facts(t);
  const proofTx = new Map(timeline.filter((e) => e.kind === "proof").map((e) => [e.milestone, e.tx]));
  const rows: ProofRow[] = proofs.map((p) => ({ ...p, hash: p.hash, tx: proofTx.get(p.milestone) }));
  const won = timeline.find((e) => e.kind === "won");
  const end = timeline.find((e) => e.kind === "delivered" || e.kind === "refunded");
  const resaleOpen = t.stage === "won" || t.stage === "printed" || t.stage === "seen";

  const steps: { label: string; when: string | null; tx?: string; done: boolean }[] = [
    { label: "Won", when: won ? dayOf(won.time) : null, tx: won?.tx, done: true },
    ...Array.from({ length: Math.max(t.milestoneCount, 1) }, (_, m) => {
      const p = proofs[m];
      return { label: m === 0 ? "Printed" : `Seen, check-in ${m}`, when: p?.at ? dayOf(p.at) : null, tx: proofTx.get(m), done: !!p };
    }),
    t.stage === "refunded"
      ? { label: "Refunded", when: end ? dayOf(end.time) : null, tx: end?.tx, done: true }
      : { label: "Delivered", when: end?.kind === "delivered" ? dayOf(end.time) : null, tx: end?.tx, done: t.stage === "delivered" },
  ];

  const tokenUrl = `/patch/${tokenId}`;
  const shareText = t.sponsorNo === 1
    ? `${displayBrand(t)} is the first sponsor of ${displayCreator(t)} on Patched. The patch NFT updates as they deliver.`
    : `${displayBrand(t)} sponsors ${displayCreator(t)} on Patched. The patch NFT updates as they deliver.`;

  return (
    <main className="wrap pt-6 pb-24 grid gap-6">
      <nav className="flex items-center gap-2 flex-wrap" aria-label="Back">
        <Link href={listingHref} className="btn-base btn-small no-underline"><ArrowLeft size={14} /> Back to the listing</Link>
        <Link href={creatorHref} className="btn-base btn-small btn-ghost no-underline">{displayCreator(t)}&apos;s page</Link>
        <Link href="/explore" className="btn-base btn-small btn-ghost no-underline">Explore</Link>
      </nav>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,520px)_1fr] items-start">
        <div className="grid gap-4">
          <SvgCard svg={svg} label={`${t.label} patch, ${t.stage}`} glow />
          <ShareRow text={shareText} path={tokenUrl} />
        </div>

        <div className="grid gap-5">
          <div>
            <span className="eyebrow">Patch NFT · #{t.listingId}-{t.patchId}</span>
            <h1 className="font-extrabold text-3xl sm:text-4xl tracking-tight mt-1">
              {displayBrand(t)} on {t.label}
            </h1>
            <p className="mt-2 text-[var(--muted)]">
              {t.sponsorNo === 1 ? "First sponsor" : t.sponsorNo > 0 ? `Sponsor No.${t.sponsorNo}` : "Sponsor"} of{" "}
              <Link href={creatorHref} className="underline text-[var(--ink)]">{displayCreator(t)}</Link>
              {" · "}
              <Link href={listingHref} className="underline text-[var(--ink)]">Open the listing</Link>
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Pill variant={t.stage === "refunded" || t.stage === "disputed" ? "out" : t.stage === "delivered" ? "top" : "won"}>{STAGE_LABEL[t.stage]}</Pill>
              <Pill variant="wait">{f.thread} thread</Pill>
              <Pill variant="wait">{formatUsdc(t.amount)} USDC</Pill>
            </div>
          </div>

          <Card className="p-5 grid gap-3">
            <h2 className="font-bold text-lg">How it got here</h2>
            <ol className="grid gap-0 list-none m-0 p-0">
              {steps.map((s, i) => (
                <li key={`${s.label}-${i}`} className="flex gap-3 items-start">
                  <span className="flex flex-col items-center self-stretch">
                    <span className={`w-6 h-6 rounded-full grid place-items-center flex-none border-2 ${s.done ? "bg-[var(--accent)] border-[var(--ink)] text-white" : "border-[var(--line)] text-[var(--muted)]"}`}>
                      {s.done ? <Check size={13} /> : <Circle size={7} />}
                    </span>
                    {i < steps.length - 1 && <span className="w-0.5 flex-1 min-h-4 bg-[var(--soft)]" />}
                  </span>
                  <span className={`pb-3 grid ${s.done ? "" : "text-[var(--muted)]"}`}>
                    <b>{s.label}</b>
                    <span className="text-sm muted">
                      {s.when ?? (s.done ? "" : "Not yet")}
                      {s.tx && <> · <a className="underline inline-flex items-center gap-0.5" href={`${EXPLORER}/tx/${s.tx}`} target="_blank" rel="noreferrer">transaction <ExternalLink size={11} /></a></>}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5 grid gap-3">
            <h2 className="font-bold text-lg">Verify the proof</h2>
            <VerifyProof proofs={rows} explorer={EXPLORER} />
          </Card>

          <Card className="p-5 grid gap-3">
            <h2 className="font-bold text-lg">Holder</h2>
            <p className="text-sm">
              <Link href={holderHref} className="underline">{holderProfile?.brand_name || holderProfile?.display_name || formatShortAddress(holder)}</Link>
              <span className="muted"> holds this patch: refunds if the creator fails, and the right to dispute a proof.</span>
            </p>
            {resaleOpen && <ResaleBox tokenId={tokenId} holder={holder} price={page.resalePrice.toString()} label={t.label} />}
          </Card>

          <Card className="p-5 grid gap-2">
            <h2 className="font-bold text-lg">Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm m-0">
              {[
                ["Surface", t.surface],
                ["Event", t.eventName || "None"],
                ["Shape", f.shape],
                ["Art", f.fabric],
                ["Winning bid", formatUsdc(t.amount)],
                ["Proofs", `${t.proofsDone} of ${t.milestoneCount}`],
              ].map(([k, v]) => (
                <div key={k} className="contents"><dt className="muted">{k}</dt><dd className="m-0 font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="text-xs muted mt-1">
              Token {tokenId} on chain {CHAIN_ID}. The picture is drawn by the contract itself ·{" "}
              <a className="underline" href={`${EXPLORER}/address/${page.receipt}`} target="_blank" rel="noreferrer">receipt contract</a> ·{" "}
              <a className="underline" href={`${EXPLORER}/address/${MARKET}`} target="_blank" rel="noreferrer">market</a>
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
