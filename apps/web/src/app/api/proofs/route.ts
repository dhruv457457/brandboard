import { keccak256, stringToBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Store proof files for a milestone before the creator calls submitProof. Only the listing's creator
 * may do this. Returns the hash to put on-chain; anyone can re-hash the stored JSON to verify it.
 * Body: { listingId, milestone, files: string[], note? }
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const body = (await req.json()) as { listingId?: number; milestone?: number; files?: string[]; note?: string };
  const listingId = Number(body.listingId);
  const milestone = Number(body.milestone);
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const files = (body.files ?? []).filter((f) => typeof f === "string" && f.startsWith(supa)).slice(0, 8);
  if (!Number.isInteger(listingId) || !Number.isInteger(milestone) || files.length === 0) {
    return Response.json({ error: "Add at least one photo." }, { status: 400 });
  }

  const listing = await serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getListing", args: [BigInt(listingId)] });
  if (listing.creator.toLowerCase() !== user.wallet) return Response.json({ error: "Only the creator can submit proof." }, { status: 403 });

  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  const record = { chainId: CHAIN_ID, listingId, milestone, files, note };
  const proofHash = keccak256(stringToBytes(JSON.stringify(record)));
  const { error } = await supabaseAdmin().from("proof_files").upsert(
    { chain_id: CHAIN_ID, listing_id: listingId, milestone, files, note, ai_check: null },
    { onConflict: "chain_id,listing_id,milestone" },
  );
  if (error) return Response.json({ error: "Couldn't save your proof. Try again." }, { status: 500 });
  return Response.json({ proofHash, proofURI: `patched://proof/${CHAIN_ID}/${listingId}/${milestone}` });
}
