"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { patchReceiptAbi } from "@patched/shared";
import { publicClient, RECEIPT } from "@/lib/config";
import { cardSvg, readTokenView, tokenPath, type TokenData } from "@/lib/nft/token";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const FRAME = "block rounded-[22px] overflow-hidden border-2 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)] [&>svg]:block [&>svg]:w-full [&>svg]:h-auto bg-[var(--soft)]";

/** A card already drawn as SVG markup (from lib/patchCard.ts, which escapes every name). */
export function SvgCard({ svg, label, className, glow = false }: { svg: string; label: string; className?: string; glow?: boolean }) {
  const card = <div role="img" aria-label={label} className={cn(FRAME, className)} dangerouslySetInnerHTML={{ __html: svg }} />;
  if (!glow) return card;
  // The big card on a patch page: a slow rainbow glow behind it and a light sweep across it, like a foil trading card.
  return (
    <div className="nft-glow">
      <div className="relative">
        {card}
        <span className="nft-sheen" aria-hidden="true" />
      </div>
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
 * Names for the card. The chain only knows a brand or creator name if that person saved one on-chain, which most
 * wallets never did, so the card would show a short address. The profile on Patched has the name; ask for it once per
 * wallet and keep it for this tab. The same cleaning the contract applies: letters, digits, space . - _
 */
interface Names { brand: string; person: string; logo: string | null; avatar: string | null }
const names = new Map<string, Promise<Names | null>>();
const clean = (v: string | null | undefined) => (v ?? "").replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 24);
function profileNames(wallet: string): Promise<Names | null> {
  const key = wallet.toLowerCase();
  if (!names.has(key)) {
    names.set(key, Promise.resolve(supabase().from("profiles").select("display_name, brand_name, handle, brand_logo_url, avatar_url").eq("wallet", key).maybeSingle())
      .then(({ data }) => (data ? { brand: clean(data.brand_name) || clean(data.display_name) || clean(data.handle), person: clean(data.handle) || clean(data.display_name), logo: data.brand_logo_url ?? null, avatar: data.avatar_url ?? null } : null))
      .catch(() => null));
  }
  return names.get(key)!;
}
/** A token with the profile names and pictures filled in (the chain has neither pictures nor, often, names). */
async function withNames(t: TokenData): Promise<TokenData> {
  const [b, c] = await Promise.all([profileNames(t.winner), profileNames(t.creator)]);
  return { ...t, brand: t.brand || b?.brand || "", creatorName: t.creatorName || c?.person || "", brandLogo: b?.logo ?? null, creatorAvatar: c?.avatar ?? null };
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

  if (data === undefined) return <div className={cn(FRAME, "aspect-square animate-pulse", className)} aria-label="Loading patch" />;
  if (data === null) {
    // eslint-disable-next-line @next/next/no-img-element
    return fallback ? <img src={fallback} alt="Patch receipt" className={cn(FRAME, "w-full", className)} /> : <div className={cn(FRAME, "aspect-square grid place-items-center text-sm muted", className)}>Patch unavailable</div>;
  }
  const card = <SvgCard svg={cardSvg(data, { id: `c${uid}` })} label={`${data.label} patch, ${data.stage}`} className={className} />;
  return link ? <Link href={tokenPath(tokenId)} className="block no-underline" aria-label={`Open patch ${data.listingId}-${data.patchId}`}>{card}</Link> : card;
}
