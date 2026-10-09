import { getSessionLite, getSessionWallet, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import { KINDS, reactionsFor, type Kind } from "@/lib/server/reactions";
import { CHAIN_ID } from "@/lib/config";

/** A listing is reacted to as "<chainId>:<listingId>", so the two chains' listing numbers never mix. */
const listingKey = (id: number | string) => `${CHAIN_ID}:${id}`;

export const runtime = "nodejs";

/**
 * GET ?ids=a,b,c gives each post's counts and which reactions the signed-in person has used (up to 40 posts);
 * ?listings=1,2,3 does the same for listings, keyed by listing id.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const me = await getSessionWallet(req);
  const listings = (url.searchParams.get("listings") ?? "").split(",").filter((x) => /^\d{1,9}$/.test(x)).slice(0, 40);
  if (listings.length) {
    const byKey = await reactionsFor(listings.map(listingKey), me, "listing");
    return Response.json(Object.fromEntries(listings.map((id) => [id, byKey[listingKey(id)]])), { headers: { "cache-control": "no-store" } });
  }
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 40);
  return Response.json(await reactionsFor(ids, me), { headers: { "cache-control": "no-store" } });
}

async function change(req: Request, on: boolean) {
  const user = await getSessionLite(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json().catch(() => null)) as { postId?: string; listingId?: number; kind?: Kind } | null;
  const kind = body?.kind;
  if (!kind || !KINDS.includes(kind)) return Response.json({ error: "Pick a reaction." }, { status: 400 });
  if (!allow(`react:${user.wallet}`, 500)) return Response.json({ error: "Too many reactions today." }, { status: 429 });
  const db = supabaseAdmin();

  // A listing.
  if (body?.listingId !== undefined) {
    const id = Number(body.listingId);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "No such listing." }, { status: 400 });
    const { data: listing } = await db.from("listings").select("listing_id").eq("chain_id", CHAIN_ID).eq("listing_id", id).maybeSingle();
    if (!listing) return Response.json({ error: "No such listing." }, { status: 404 });
    const key = listingKey(id);
    const { error } = on
      ? await db.from("reactions").upsert({ wallet: user.wallet, target_kind: "listing", target_id: key, kind }, { onConflict: "wallet,target_kind,target_id,kind", ignoreDuplicates: true })
      : await db.from("reactions").delete().eq("wallet", user.wallet).eq("target_kind", "listing").eq("target_id", key).eq("kind", kind);
    if (error) return Response.json({ error: "Couldn't save that. Try again." }, { status: 500 });
    return Response.json((await reactionsFor([key], user.wallet, "listing"))[key]);
  }

  // A spotted photo.
  const postId = String(body?.postId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return Response.json({ error: "Pick a reaction." }, { status: 400 });
  const { data: post } = await db.from("posts").select("id").eq("id", postId).eq("hidden", false).maybeSingle();
  if (!post) return Response.json({ error: "That photo isn't there any more." }, { status: 404 });
  const { error } = on
    ? await db.from("reactions").upsert({ wallet: user.wallet, target_kind: "post", target_id: postId, kind }, { onConflict: "wallet,target_kind,target_id,kind", ignoreDuplicates: true })
    : await db.from("reactions").delete().eq("wallet", user.wallet).eq("target_kind", "post").eq("target_id", postId).eq("kind", kind);
  if (error) return Response.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  return Response.json((await reactionsFor([postId], user.wallet))[postId]);
}

export const POST = (req: Request) => change(req, true);
export const DELETE = (req: Request) => change(req, false);
