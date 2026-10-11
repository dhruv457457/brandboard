import { CHAIN_ID } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * The exact proof record for a milestone whose proof was posted before IPFS pinning (its on-chain proofURI is
 * patched://proof/...). The bytes are rebuilt the way /api/proofs hashed them, so the browser can hash them and compare
 * with the hash the market holds on-chain. Proofs pinned to IPFS don't use this: they are checked against the gateway.
 * Query: ?listingId=4&milestone=0
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const listingId = Number(url.searchParams.get("listingId"));
  const milestone = Number(url.searchParams.get("milestone"));
  if (!Number.isInteger(listingId) || !Number.isInteger(milestone)) return Response.json({ error: "Bad request." }, { status: 400 });

  const { data } = await supabaseAdmin()
    .from("proof_files")
    .select("files, note, x_url")
    .eq("chain_id", CHAIN_ID)
    .eq("listing_id", listingId)
    .eq("milestone", milestone)
    .maybeSingle();
  if (!data) return Response.json({ error: "No proof record kept for this milestone." }, { status: 404 });

  // Same field order as /api/proofs, so the bytes (and their hash) are identical.
  const record = { chainId: CHAIN_ID, listingId, milestone, files: data.files, note: data.note, ...(data.x_url ? { xUrl: data.x_url } : {}) };
  return new Response(JSON.stringify(record), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
}
