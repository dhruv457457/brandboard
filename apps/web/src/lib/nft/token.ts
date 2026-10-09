// Living Patch NFTs on the website: read a token's state from the market and turn it into the card.
// Everything here is safe in the browser and on the server.
import { hexToString, type PublicClient } from "viem";
import { patchedMarketAbi, patchReceiptAbi } from "@patched/shared";
import { MARKET } from "@/lib/config";
import { ipfsUrl } from "@/lib/ipfs";
import { patchCard, shapeName, shortAddress, tierOf, FABRIC, type CardInput, type CardSurface, type PatchStage } from "@/lib/patchCard";

export const STAGES: PatchStage[] = ["won", "printed", "seen", "delivered", "refunded", "disputed"];
const SURFACES: CardSurface[] = ["Outfit", "Car", "Team hoodie"];

/** What `PatchedMarket.tokenView` returns. */
export interface TokenData {
  tokenId: bigint;
  /** Pictures from the profiles (not on-chain): the winning brand's logo and the creator's photo. */
  brandLogo?: string | null;
  creatorAvatar?: string | null;
  listingId: number;
  patchId: number;
  surface: CardSurface;
  stage: PatchStage;
  proofsDone: number;
  milestoneCount: number;
  sponsorNo: number;
  /** Winning bid, 6-decimal USDC. */
  amount: bigint;
  printedAt: number;
  seenAt: number;
  winner: `0x${string}`;
  creator: `0x${string}`;
  brand: string;
  creatorName: string;
  label: string;
  eventName: string;
  proofURI: string;
  coverURI: string;
}

/** The same cleaning the contract applies to names: letters, digits, space . - _ ; anything else becomes "?". */
function text(v: `0x${string}`): string {
  let s: string;
  try {
    s = hexToString(v, { size: 32 }).replace(/\0+$/, "");
  } catch {
    return "";
  }
  return s.replace(/[^A-Za-z0-9 ._-]/g, "?");
}

export function parseTokenView(tokenId: bigint, raw: unknown): TokenData {
  const v = raw as {
    listingId: bigint; patchId: number; surface: number; stage: number; proofsDone: number; milestoneCount: number;
    sponsorNo: number; amount: bigint; printedAt: number; seenAt: number; winner: `0x${string}`; creator: `0x${string}`;
    brand: `0x${string}`; creatorName: `0x${string}`; label: `0x${string}`; eventName: `0x${string}`; proofURI: string; coverURI: string;
  };
  return {
    tokenId,
    listingId: Number(v.listingId),
    patchId: Number(v.patchId),
    surface: SURFACES[Number(v.surface)] ?? "Outfit",
    stage: STAGES[Number(v.stage)] ?? "won",
    proofsDone: Number(v.proofsDone),
    milestoneCount: Number(v.milestoneCount),
    sponsorNo: Number(v.sponsorNo),
    amount: BigInt(v.amount),
    printedAt: Number(v.printedAt),
    seenAt: Number(v.seenAt),
    winner: v.winner,
    creator: v.creator,
    brand: text(v.brand),
    creatorName: text(v.creatorName),
    label: text(v.label),
    eventName: text(v.eventName),
    proofURI: v.proofURI,
    coverURI: v.coverURI,
  };
}

export async function readTokenView(client: PublicClient, tokenId: bigint): Promise<TokenData> {
  const raw = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "tokenView", args: [tokenId] });
  return parseTokenView(tokenId, raw);
}

/** Many tokens read in parallel (the Monad chain config has no multicall address); a token that can't be read is left out. */
export async function readTokenViews(client: PublicClient, tokenIds: bigint[]): Promise<Map<string, TokenData>> {
  const out = new Map<string, TokenData>();
  const res = await Promise.all(tokenIds.map((id) => readTokenView(client, id).catch(() => null)));
  res.forEach((t, i) => t && out.set(tokenIds[i].toString(), t));
  return out;
}

/** The receipt contract holding a token (listings from before the Living Patch upgrade use the first receipt) and its holder. */
export async function readHolder(client: PublicClient, tokenId: bigint, listingId: number): Promise<{ receipt: `0x${string}`; holder: `0x${string}` | null }> {
  const receipt = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "receiptFor", args: [BigInt(listingId)] });
  const holder = await client.readContract({ address: receipt, abi: patchReceiptAbi, functionName: "ownerOf", args: [tokenId] }).catch(() => null);
  return { receipt, holder };
}

/** The profile columns the card's names and pictures come from. */
export const CARD_PROFILE_COLUMNS = "wallet, display_name, brand_name, handle, brand_logo_url, avatar_url";
export interface CardProfile {
  display_name: string | null;
  brand_name: string | null;
  handle: string | null;
  brand_logo_url: string | null;
  avatar_url: string | null;
}

/** The same cleaning the contract applies to names (letters, digits, space . - _), so the card draws the same text. */
const cleanName = (v: string | null | undefined) => (v ?? "").replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 24);

/**
 * A token with the Patched profile names and pictures filled in. The chain keeps one name per wallet, shared by the
 * creator and brand roles, so a creator who also sponsors shows their brand name as the creator. The profile knows
 * which is which: the creator is their handle, the winner their brand. The on-chain name is only the fallback.
 */
export function withProfiles(t: TokenData, winner?: CardProfile | null, creator?: CardProfile | null): TokenData {
  const brand = winner ? cleanName(winner.brand_name) || cleanName(winner.display_name) || cleanName(winner.handle) : "";
  const person = creator ? cleanName(creator.handle) || cleanName(creator.display_name) : "";
  return {
    ...t,
    brand: brand || t.brand,
    creatorName: person || t.creatorName,
    brandLogo: t.brandLogo ?? winner?.brand_logo_url ?? null,
    creatorAvatar: t.creatorAvatar ?? creator?.avatar_url ?? null,
  };
}

/** The card's name for the brand or creator: the chosen name, else a short address. */
export function displayBrand(t: TokenData) {
  return t.brand || shortAddress(t.winner);
}
export function displayCreator(t: TokenData) {
  return t.creatorName || shortAddress(t.creator);
}

/** What the card draws. `photo` is only used by the website, never on-chain. */
export function toCardInput(t: TokenData, opts: { id: string; photo?: string | null; system?: boolean; brandLogo?: string | null; creatorAvatar?: string | null } ): CardInput {
  return {
    id: opts.id,
    brandLogo: opts.brandLogo ?? t.brandLogo ?? null,
    creatorAvatar: opts.creatorAvatar ?? t.creatorAvatar ?? null,
    brand: displayBrand(t),
    label: t.label,
    event: t.eventName || t.surface,
    creator: displayCreator(t),
    surface: t.surface,
    amount: t.amount,
    listing: t.listingId,
    patchId: t.patchId,
    sponsorNo: t.sponsorNo,
    stage: t.stage,
    seen: Math.max(t.proofsDone - 1, 0),
    seenOf: Math.max(t.milestoneCount - 1, 0),
    printedAt: t.printedAt || undefined,
    seenAt: t.seenAt || undefined,
    photo: opts.photo ?? ipfsUrl(t.coverURI) ?? undefined,
    system: opts.system,
  };
}

export const cardSvg = (t: TokenData, opts: { id: string; photo?: string | null; system?: boolean; brandLogo?: string | null; creatorAvatar?: string | null }) => patchCard(toCardInput(t, opts));

/** Short facts for the page and the traits list. */
export function facts(t: TokenData) {
  return {
    thread: tierOf(t.amount),
    shape: shapeName(t.patchId),
    fabric: FABRIC[t.surface].name,
  };
}

export const STAGE_LABEL: Record<PatchStage, string> = {
  won: "Won",
  printed: "Printed",
  seen: "Seen",
  delivered: "Delivered",
  refunded: "Refunded",
  disputed: "In review",
};

export const tokenPath = (tokenId: bigint | string) => `/patch/${tokenId}`;
