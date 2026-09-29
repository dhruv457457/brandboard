import { keccak256, stringToBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Store proof files for a milestone before the creator calls submitProof. Only the listing's creator
 * may do this. Returns the hash to put on-chain; anyone can re-hash the stored JSON to verify it.
 * Body: { listingId, milestone, files: string[], note?, xUrl? } (xUrl: the creator's X post, x.com/<user>/status/<id>).
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json()) as { listingId?: number; milestone?: number; files?: string[]; note?: string; xUrl?: string };
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
  const xUrl = normalizeXUrl(body.xUrl);
  if (body.xUrl && !xUrl) return Response.json({ error: "Paste the link to your post, like x.com/you/status/123." }, { status: 400 });
  // The X post is only part of the hashed record when there is one, so older proofs hash the same way.
  const record = { chainId: CHAIN_ID, listingId, milestone, files, note, ...(xUrl ? { xUrl } : {}) };
  const proofHash = keccak256(stringToBytes(JSON.stringify(record)));
  const { error } = await supabaseAdmin().from("proof_files").upsert(
    { chain_id: CHAIN_ID, listing_id: listingId, milestone, files, note, x_url: xUrl, ai_check: null },
    { onConflict: "chain_id,listing_id,milestone" },
  );
  if (error) return Response.json({ error: "Couldn't save your proof. Try again." }, { status: 500 });
  return Response.json({ proofHash, proofURI: `patched://proof/${CHAIN_ID}/${listingId}/${milestone}` });
}

/** An X (or twitter.com) post link, normalised to https://x.com/<user>/status/<id>; null if it isn't one. */
function normalizeXUrl(v: unknown): string | null {
  const m = String(v ?? "").trim().match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}
