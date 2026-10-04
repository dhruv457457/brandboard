import { keccak256, stringToBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ipfsEnabled, pinFile } from "@/lib/server/ipfs";

export const runtime = "nodejs";
// Pinning up to 8 photos and the record to IPFS can take a while.
export const maxDuration = 60;

/**
 * Store proof files for a milestone before the creator calls submitProof. Only the listing's creator
 * may do this. Returns the hash to put on-chain; anyone can re-hash the stored JSON to verify it.
 * With IPFS configured the photos and the proof record are pinned there, so the proof is something an outsider can open:
 * proofURI is ipfs://<record>, proofHash is keccak256 of the exact record bytes, coverURI is the first photo.
 * Body: { listingId, milestone, files: string[], note?, xUrl? } (xUrl: the creator's X post, x.com/<user>/status/<id>).
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json().catch(() => ({}))) as { listingId?: number; milestone?: number; files?: string[]; note?: string; xUrl?: string };
  const listingId = Number(body.listingId);
  const milestone = Number(body.milestone);
  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const files = (body.files ?? []).filter((f) => typeof f === "string" && f.startsWith(supa)).slice(0, 8);
  if (!Number.isInteger(listingId) || !Number.isInteger(milestone) || files.length === 0) {
    return Response.json({ error: "Add at least one photo." }, { status: 400 });
  }

  const client = serverClient();
  const listing = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getListing", args: [BigInt(listingId)] });
  if (listing.creator.toLowerCase() !== user.wallet) return Response.json({ error: "Only the creator can submit proof." }, { status: 403 });
  // Once a proof is on-chain its files are fixed: brands review what was hashed, not a later replacement.
  const m = await client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getMilestone", args: [BigInt(listingId), milestone] }).catch(() => null);
  if (!m) return Response.json({ error: "No such milestone." }, { status: 404 });
  if (m.status !== 0) return Response.json({ error: "Proof for this milestone is already in. It can't be changed." }, { status: 409 });

  const note = String(body.note ?? "").trim().slice(0, 500) || null;
  const xUrl = normalizeXUrl(body.xUrl);
  if (body.xUrl && !xUrl) return Response.json({ error: "Paste the link to your post, like x.com/you/status/123." }, { status: 400 });
  // The X post is only part of the hashed record when there is one, so older proofs hash the same way.
  const record = { chainId: CHAIN_ID, listingId, milestone, files, note, ...(xUrl ? { xUrl } : {}) };
  let proofHash = keccak256(stringToBytes(JSON.stringify(record)));
  let proofURI = `patched://proof/${CHAIN_ID}/${listingId}/${milestone}`;
  let coverURI: string | undefined;
  if (ipfsEnabled()) {
    try {
      const pinned = await pinProof(record);
      proofHash = pinned.hash;
      proofURI = pinned.uri;
      coverURI = pinned.cover;
    } catch (err) {
      // IPFS being down must not stop a creator from getting paid: fall back to the record kept by Patched.
      console.error("[proofs] IPFS pin failed, using the Patched-hosted record", err);
    }
  }
  const { error } = await supabaseAdmin().from("proof_files").upsert(
    { chain_id: CHAIN_ID, listing_id: listingId, milestone, files, note, x_url: xUrl, ai_check: null },
    { onConflict: "chain_id,listing_id,milestone" },
  );
  if (error) return Response.json({ error: "Couldn't save your proof. Try again." }, { status: 500 });
  return Response.json({ proofHash, proofURI, ...(coverURI ? { coverURI } : {}) });
}

/** An X (or twitter.com) post link, normalised to https://x.com/<user>/status/<id>; null if it isn't one. */
function normalizeXUrl(v: unknown): string | null {
  const m = String(v ?? "").trim().match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

/** Pin each photo (resized to a web-friendly JPEG), then the record that lists them; hash the record's exact bytes. */
async function pinProof(record: { chainId: number; listingId: number; milestone: number; files: string[]; note: string | null; xUrl?: string }) {
  const sharp = (await import("sharp")).default;
  const photos = await Promise.all(
    record.files.map(async (url, i) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`photo ${i} not readable (${res.status})`);
      const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
        .rotate()
        .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer();
      const cid = await pinFile(jpeg, `proof-${record.listingId}-${record.milestone}-${i}.jpg`, "image/jpeg");
      return `ipfs://${cid}`;
    }),
  );
  const json = JSON.stringify({ name: "Patched proof", market: MARKET, ...record, files: photos });
  const bytes = new TextEncoder().encode(json);
  const cid = await pinFile(bytes, `proof-${record.listingId}-${record.milestone}.json`, "application/json");
  return { hash: keccak256(bytes), uri: `ipfs://${cid}`, cover: photos[0] };
}
