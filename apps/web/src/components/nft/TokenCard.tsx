"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { patchReceiptAbi } from "@patched/shared";
import { publicClient, RECEIPT } from "@/lib/config";
import { CARD_PROFILE_COLUMNS, cardSvg, readTokenView, tokenPath, withProfiles, type CardProfile, type TokenData } from "@/lib/nft/token";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Tilt } from "./Tilt";

const FRAME = "block rounded-[22px] overflow-hidden border-2 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)] [&>svg]:block [&>svg]:w-full [&>svg]:h-auto bg-[var(--soft)]";

/** A card already drawn as SVG markup (from lib/patchCard.ts, which escapes every name). */
export function SvgCard({ svg, label, className, glow = false }: { svg: string; label: string; className?: string; glow?: boolean }) {
  const card = <div role="img" aria-label={label} className={cn(FRAME, className)} dangerouslySetInnerHTML={{ __html: svg }} />;
  if (!glow) return <Tilt>{card}</Tilt>;
  // The big card on a patch page: a slow rainbow glow behind it and a light sweep across it, like a foil trading card.
  return (
    <div className="nft-glow">
      <Tilt max={10}>
        {card}
        <span className="nft-sheen" aria-hidden="true" />
      </Tilt>
    </div>
  );
}

/** Token state is one RPC call each; keep what this tab already fetched. */
const cache = new Map<string, Promise<TokenData | null>>();
export function loadToken(tokenId: string): Promise<TokenData | null> {
  if (!cache.has(tokenId)) {
    cache.set(tokenId, readTokenView(publicClient, BigInt(tokenId)).catch(() => {
      cache.delete(tokenId);
      return null;
    }));
  }
  return cache.get(tokenId)!;
}

/**
 * The Patched profile behind a wallet, asked for once per wallet and kept for this tab. It has the pictures, and the
 * right name for each role (the chain keeps one name per wallet), so the card prefers it to the on-chain name.
 */
const profiles = new Map<string, Promise<CardProfile | null>>();
function profileOf(wallet: string): Promise<CardProfile | null> {
  const key = wallet.toLowerCase();
  if (!profiles.has(key)) {
    profiles.set(key, Promise.resolve(supabase().from("profiles").select(CARD_PROFILE_COLUMNS).eq("wallet", key).maybeSingle())
      .then(({ data }) => (data as CardProfile | null) ?? null)
      .catch(() => null));
  }
  return profiles.get(key)!;
}
async function withNames(t: TokenData): Promise<TokenData> {
  const [winner, creator] = await Promise.all([profileOf(t.winner), profileOf(t.creator)]);
  return withProfiles(t, winner, creator);
}

/**
 * Before a market is upgraded to the Living Patch it cannot describe a token, so fall back to the picture the first
 * receipt contract draws itself.
 */
const oldArt = new Map<string, Promise<string | null>>();
function receiptImage(tokenId: string): Promise<string | null> {
  if (!oldArt.has(tokenId)) {
    oldArt.set(tokenId, publicClient.readContract({ address: RECEIPT, abi: patchReceiptAbi, functionName: "tokenURI", args: [BigInt(tokenId)] })
      .then((uri) => (JSON.parse(atob(uri.replace("data:application/json;base64,", ""))).image as string) ?? null)
      .catch(() => null));
  }
  return oldArt.get(tokenId)!;
}

/**
 * The Living Patch for a token id: reads its stage from the market and draws the card. Pass `token` when the server
 * already has it. Links to the token's page unless `link` is false.
 */
export function TokenCard({ tokenId, token, link = true, className }: { tokenId: string; token?: TokenData | null; link?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const [data, setData] = useState<TokenData | null | undefined>(token);
  const [fallback, setFallback] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // Show the token as soon as it is read, then again with profile names once those arrive.
    const show = async (t: TokenData | null) => {
      if (!live) return;
      setData(t);
      if (!t) return setFallback(await receiptImage(tokenId));
      const named = await withNames(t);
      if (live && named !== t) setData(named);
    };
    if (token) void show(token);
    else void loadToken(tokenId).then(show);
    return () => { live = false; };
  }, [tokenId, token]);

  if (data === undefined) return <Tilt><div className={cn(FRAME, "aspect-square animate-pulse", className)} aria-label="Loading patch" /></Tilt>;
  if (data === null) {
    // eslint-disable-next-line @next/next/no-img-element
    return <Tilt>{fallback ? <img src={fallback} alt="Patch receipt" className={cn(FRAME, "w-full", className)} /> : <div className={cn(FRAME, "aspect-square grid place-items-center text-sm muted", className)}>Patch unavailable</div>}</Tilt>;
  }
  const card = <SvgCard svg={cardSvg(data, { id: `c${uid}` })} label={`${data.label} patch, ${data.stage}`} className={className} />;
  return link ? <Link href={tokenPath(tokenId)} className="block no-underline" aria-label={`Open patch ${data.listingId}-${data.patchId}`}>{card}</Link> : card;
}
