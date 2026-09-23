import { supabase } from "@/lib/supabase";

/** Public: the off-chain JSON behind a listing's metadataHash (anyone can verify it against the chain). */
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) return Response.json({ error: "Not found" }, { status: 404 });
  const { data } = await supabase().from("listing_metadata").select("metadata").eq("metadata_hash", hash.toLowerCase()).maybeSingle();
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data.metadata, { headers: { "cache-control": "public, max-age=31536000, immutable" } });
}
