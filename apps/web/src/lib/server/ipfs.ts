import "server-only";

// IPFS pinning on QuickNode (the plan includes it). Keep the provider behind these two functions so another chain's
// build, or another pinning service, only changes this file.
//   POST https://api.quicknode.com/ipfs/rest/v1/s3/put-object  (header x-api-key; multipart Body, Key, ContentType)
// The response carries `pin.cid`. One file per call; folders are not documented, so every file is pinned on its own.

const ENDPOINT = "https://api.quicknode.com/ipfs/rest/v1/s3/put-object";

/** True when proofs and NFT images can be pinned. Without it the app keeps its old behaviour (files in Supabase). */
export function ipfsEnabled(): boolean {
  return !!process.env.QUICKNODE_IPFS_API_KEY && !!process.env.NEXT_PUBLIC_IPFS_GATEWAY;
}

/** Pin bytes and return the content id. Throws if the service refuses; callers decide whether that is fatal. */
export async function pinFile(bytes: Uint8Array, name: string, contentType: string): Promise<string> {
  const key = process.env.QUICKNODE_IPFS_API_KEY;
  if (!key) throw new Error("QUICKNODE_IPFS_API_KEY is not set");
  const form = new FormData();
  form.set("Body", new Blob([bytes as BlobPart], { type: contentType }), name);
  form.set("Key", name);
  form.set("ContentType", contentType);
  const res = await fetch(ENDPOINT, { method: "POST", headers: { "x-api-key": key }, body: form, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`IPFS pin failed (${res.status})`);
  const json = (await res.json()) as { pin?: { cid?: string } };
  const cid = json.pin?.cid;
  if (!cid) throw new Error("IPFS pin returned no cid");
  return cid;
}
