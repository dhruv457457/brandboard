import { keccak256 } from "viem";
import { CHAIN_ID, MARKET } from "@/lib/config";
import { getSessionLite, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { ipfsEnabled, pinFile } from "@/lib/server/ipfs";

export const runtime = "nodejs";
// Pinning the photo and its record can take a while.
export const maxDuration = 60;

const PHOTOS = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/proofs/`;

/**
 * Step one of spotting someone on-chain: turn an uploaded photo into the two values PatchSpotter.spot needs.
 * With IPFS configured the (resized) photo and a small record are pinned: photoURI is ipfs://<record> and photoHash is
 * keccak256 of the record's exact bytes, so anyone can fetch it and check. Without IPFS the record stays with Patched.
 * Body: { listingId, photo (an uploaded proofs image), caption? }. Returns { photoHash, photoURI }.
 */
export async function POST(req: Request) {
  const user = await getSessionLite(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json().catch(() => null)) as { listingId?: number; photo?: string; caption?: string } | null;
  const listingId = Number(body?.listingId);
  const photo = String(body?.photo ?? "");
  const caption = String(body?.caption ?? "").trim().slice(0, 200);
  if (!Number.isInteger(listingId) || listingId < 1 || !photo.startsWith(PHOTOS())) {
    return Response.json({ error: "Add a photo of who you spotted." }, { status: 400 });
  }
  if (!allow(`spot-pin:${user.wallet}`, 30)) return Response.json({ error: "Too many tries. Wait a little and try again." }, { status: 429 });

  let photoRef = photo;
  let uri = `patched://spot/${CHAIN_ID}/${listingId}/${user.wallet}`;
  let record = { name: "Patched spot", chainId: CHAIN_ID, market: MARKET, listingId, spotter: user.wallet, photo: photoRef, caption };
  let bytes = new TextEncoder().encode(JSON.stringify(record));
  if (ipfsEnabled()) {
    try {
      const sharp = (await import("sharp")).default;
      const res = await fetch(photo, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`photo not readable (${res.status})`);
      const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 84 })
        .toBuffer();
      photoRef = `ipfs://${await pinFile(jpeg, `spot-${listingId}-${user.wallet.slice(2, 10)}.jpg`, "image/jpeg")}`;
      record = { ...record, photo: photoRef };
      bytes = new TextEncoder().encode(JSON.stringify(record));
      uri = `ipfs://${await pinFile(bytes, `spot-${listingId}-${user.wallet.slice(2, 10)}.json`, "application/json")}`;
    } catch (err) {
      // IPFS being down must not stop someone from posting: keep the record with Patched instead.
      console.error("[spotted/pin] IPFS pin failed, using the Patched-hosted record", err);
      record = { ...record, photo };
      bytes = new TextEncoder().encode(JSON.stringify(record));
      uri = `patched://spot/${CHAIN_ID}/${listingId}/${user.wallet}`;
    }
  }
  return Response.json({ photoHash: keccak256(bytes), photoURI: uri });
}
