import "server-only";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { CARD_PROFILE_COLUMNS, readHolder, readTokenView, withProfiles, type CardProfile, type TokenData } from "@/lib/nft/token";
import { supabaseAdmin } from "@/lib/supabase";

export interface NftPage {
  token: TokenData;
  receipt: `0x${string}`;
  holder: `0x${string}`;
  resalePrice: bigint;
  /** Proofs posted so far, oldest first. `hash` is what the market holds on-chain for the proof. */
  proofs: { milestone: number; uri: string; cover: string; at: number; hash: `0x${string}` }[];
}

/** Everything the NFT page shows, straight from the chain. Null when no such token has been minted. */
export async function getNftPage(tokenId: bigint): Promise<NftPage | null> {
  const client = serverClient();
  let token: TokenData;
  try {
    token = await readTokenView(client, tokenId);
  } catch {
    return null;
  }
  if (token.winner === "0x0000000000000000000000000000000000000000") return null;
  const { receipt, holder } = await readHolder(client, tokenId, token.listingId);
  if (!holder) return null; // not minted yet: the listing is still open for bids

  const id = BigInt(token.listingId);
  const read = <T,>(p: Promise<T>) => p.then((v) => v, () => null);
  const [{ data: people }, resalePrice, ...rows] = await Promise.all([
    Promise.resolve(supabaseAdmin().from("profiles").select(CARD_PROFILE_COLUMNS).in("wallet", [token.winner.toLowerCase(), token.creator.toLowerCase()]))
      .catch(() => ({ data: null })),
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "resalePrice", args: [tokenId] }),
    ...Array.from({ length: token.proofsDone }, (_, m) =>
      Promise.all([
        read(client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "proofURIOf", args: [id, m] })),
        read(client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "proofCoverOf", args: [id, m] })),
        read(client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "proofAt", args: [id, m] })),
        read(client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getMilestone", args: [id, m] })),
      ]),
    ),
  ]);
  const proofs: NftPage["proofs"] = (rows as [string | null, string | null, number | null, { proofHash: `0x${string}` } | null][]).map(([uri, cover, at, ms], m) => ({
    milestone: m,
    uri: uri ?? "",
    cover: cover ?? "",
    at: at ? Number(at) : 0,
    hash: ms?.proofHash ?? "0x",
  }));
  const profileOf = (w: string) => (people as (CardProfile & { wallet: string })[] | null)?.find((p) => p.wallet === w.toLowerCase()) ?? null;
  return { token: withProfiles(token, profileOf(token.winner), profileOf(token.creator)), receipt, holder, resalePrice, proofs };
}

export interface TimelineEvent {
  kind: "won" | "proof" | "paid" | "delivered" | "refunded";
  milestone?: number;
  tx: string;
  time: string;
}

/** The listing's milestones in order, with the transaction that made each one happen. */
export async function getTimeline(listingId: number): Promise<TimelineEvent[]> {
  const { data } = await supabaseAdmin()
    .from("chain_events")
    .select("event_name, args, tx_hash, block_time")
    .eq("chain_id", CHAIN_ID)
    .in("event_name", ["BiddingClosed", "ProofSubmitted", "MilestoneReleased", "ListingCompleted", "ListingFailed"])
    .filter("args->>listingId", "eq", String(listingId))
    .order("block_number", { ascending: true })
    .order("log_index", { ascending: true })
    .limit(60);
  const kinds: Record<string, TimelineEvent["kind"]> = {
    BiddingClosed: "won", ProofSubmitted: "proof", MilestoneReleased: "paid", ListingCompleted: "delivered", ListingFailed: "refunded",
  };
  return (data ?? []).map((e) => ({
    kind: kinds[e.event_name as string],
    milestone: e.args?.milestone !== undefined ? Number(e.args.milestone) : undefined,
    tx: e.tx_hash as string,
    time: e.block_time as string,
  }));
}
