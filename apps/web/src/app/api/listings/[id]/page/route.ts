import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizePage } from "@/lib/market/page";

export const runtime = "nodejs";

/** Save the sponsor-page layer for a listing. Only its creator (per the indexed listing) may write it. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Unknown listing." }, { status: 404 });

  const db = supabaseAdmin();
  const { data: listing } = await db.from("listings").select("creator, patch_count").eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle();
  if (!listing) return Response.json({ error: "Unknown listing." }, { status: 404 });
  if (listing.creator.toLowerCase() !== user.wallet) return Response.json({ error: "Only the creator can edit this page." }, { status: 403 });

  const page = sanitizePage(await req.json().catch(() => ({})), listing.patch_count);
  const { error } = await db
    .from("listing_pages")
    .upsert({ chain_id: CHAIN_ID, listing_id: id, creator: user.wallet, page, updated_at: new Date().toISOString() }, { onConflict: "chain_id,listing_id" });
  if (error) return Response.json({ error: "Couldn't save your page. Try again." }, { status: 500 });
  return Response.json({ ok: true, page });
}
