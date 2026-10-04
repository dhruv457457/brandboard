"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { patchReceiptAbi } from "@patched/shared";
import { publicClient, RECEIPT } from "@/lib/config";
import { cardSvg, readTokenView, tokenPath, type TokenData } from "@/lib/nft/token";
import { cn } from "@/lib/utils";

const FRAME = "block rounded-[22px] overflow-hidden border-2 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)] [&>svg]:block [&>svg]:w-full [&>svg]:h-auto bg-[var(--soft)]";

/** A card already drawn as SVG markup (from lib/patchCard.ts, which escapes every name). */
export function SvgCard({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return <div role="img" aria-label={label} className={cn(FRAME, className)} dangerouslySetInnerHTML={{ __html: svg }} />;
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
    if (token) return setData(token);
    let live = true;
    void loadToken(tokenId).then(async (t) => {
      if (!live) return;
      setData(t);
      if (!t) setFallback(await receiptImage(tokenId));
    });
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
