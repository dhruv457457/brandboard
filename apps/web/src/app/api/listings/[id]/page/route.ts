import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizePage } from "@/lib/market/page";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, serverClient } from "@/lib/config";

const ZERO = "0x0000000000000000000000000000000000000000";

async function onChain(id: number) {
  const L = await serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "getListing", args: [BigInt(id)] }).catch(() => null);
  return L && L.creator !== ZERO ? { creator: L.creator.toLowerCase(), patch_count: Number(L.patchCount) } : null;
}

export const runtime = "nodejs";

/** Save the sponsor-page layer for a listing. Only its creator (per the indexed listing) may write it. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown listing." }, { status: 404 });

  const db = supabaseAdmin();
  const { data: row } = await db.from("listings").select("creator, patch_count").eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle();
  // A brand-new listing may not be indexed yet: the contract is the source of truth, so ask it.
  const listing = row ?? (await onChain(id));
  if (!listing) return Response.json({ error: "Unknown listing." }, { status: 404 });
  if (listing.creator.toLowerCase() !== user.wallet) return Response.json({ error: "Only the creator can edit this page." }, { status: 403 });

  const page = sanitizePage(await req.json().catch(() => ({})), listing.patch_count);
  const { error } = await db
    .from("listing_pages")
    .upsert({ chain_id: CHAIN_ID, listing_id: id, creator: user.wallet, page, updated_at: new Date().toISOString() }, { onConflict: "chain_id,listing_id" });
  if (error) return Response.json({ error: "Couldn't save your page. Try again." }, { status: 500 });
  return Response.json({ ok: true, page });
}
