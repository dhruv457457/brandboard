import "server-only";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { readHolder, readTokenView, type TokenData } from "@/lib/nft/token";
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
  const calls = Array.from({ length: token.proofsDone }, (_, m) => [
    { address: MARKET, abi: patchedMarketAbi, functionName: "proofURIOf" as const, args: [id, m] as const },
    { address: MARKET, abi: patchedMarketAbi, functionName: "proofCoverOf" as const, args: [id, m] as const },
    { address: MARKET, abi: patchedMarketAbi, functionName: "proofAt" as const, args: [id, m] as const },
    { address: MARKET, abi: patchedMarketAbi, functionName: "getMilestone" as const, args: [id, m] as const },
  ]).flat();
  const [resalePrice, res] = await Promise.all([
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "resalePrice", args: [tokenId] }),
    calls.length ? client.multicall({ allowFailure: true, contracts: calls }) : Promise.resolve([]),
  ]);
  const proofs: NftPage["proofs"] = [];
  for (let m = 0; m < token.proofsDone; m++) {
    const [uri, cover, at, ms] = res.slice(m * 4, m * 4 + 4);
    proofs.push({
      milestone: m,
      uri: uri?.status === "success" ? (uri.result as string) : "",
      cover: cover?.status === "success" ? (cover.result as string) : "",
      at: at?.status === "success" ? Number(at.result) : 0,
      hash: ms?.status === "success" ? ((ms.result as { proofHash: `0x${string}` }).proofHash) : "0x",
    });
  }
  return { token, receipt, holder, resalePrice, proofs };
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
