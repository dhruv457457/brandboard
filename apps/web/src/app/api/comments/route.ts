import { CHAIN_ID } from "@/lib/config";
import { getSessionLite, getSessionWallet, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import type { ListingComment } from "@/lib/comments";

export const runtime = "nodejs";

const NOT_READY = "Comments aren't switched on yet. Try again soon.";

/** The newest comments on a listing (at most 60), oldest first so they read like a thread. GET ?listingId= */
export async function GET(req: Request) {
  const listingId = Number(new URL(req.url).searchParams.get("listingId"));
  if (!Number.isInteger(listingId) || listingId < 1) return Response.json({ error: "Say which listing." }, { status: 400 });
  const me = await getSessionWallet(req);
  const db = supabaseAdmin();
  const { data, error } = await db.from("listing_comments")
    .select("id, patch_id, body, created_at, author")
    .eq("chain_id", CHAIN_ID).eq("listing_id", listingId).eq("hidden", false)
    .order("created_at", { ascending: false }).limit(60);
  // The table arrives with a database update: until then there are simply no comments.
  if (error) return Response.json({ comments: [], ready: false }, { headers: { "cache-control": "no-store" } });

  const ids = [...new Set((data ?? []).map((r) => r.author))];
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, display_name, handle, avatar_url, wallet").in("id", ids)
    : { data: [] as { id: string; display_name: string | null; handle: string | null; avatar_url: string | null; wallet: string | null }[] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p]));
  const comments: ListingComment[] = (data ?? []).reverse().map((r) => {
    const a = who.get(r.author);
    const wallet = a?.wallet ?? null;
    return {
      id: r.id,
      patchId: r.patch_id,
      body: r.body,
      createdAt: r.created_at,
      author: { name: a?.display_name ?? (a?.handle ? `@${a.handle}` : "Someone"), handle: a?.handle ?? null, avatar: a?.avatar_url ?? null, wallet },
      mine: Boolean(me && wallet && wallet.toLowerCase() === me),
    };
  });
  return Response.json({ comments, ready: true }, { headers: { "cache-control": "no-store" } });
}

/** Post a comment. Body: { listingId, patchId?, body } */
export async function POST(req: Request) {
  const user = await getSessionLite(req);
  if (!user?.wallet) return unauthorized(user);
  const input = (await req.json().catch(() => null)) as { listingId?: number; patchId?: number | null; body?: string } | null;
  const listingId = Number(input?.listingId);
  const body = String(input?.body ?? "").trim().slice(0, 280);
  const patchId = input?.patchId == null ? null : Number(input.patchId);
  if (!Number.isInteger(listingId) || listingId < 1 || !body) return Response.json({ error: "Write a comment first." }, { status: 400 });
  if (patchId !== null && (!Number.isInteger(patchId) || patchId < 0 || patchId > 63)) return Response.json({ error: "No such spot." }, { status: 400 });
  if (!allow(`comment:${user.wallet}`, 60)) return Response.json({ error: "That's a lot of comments today. Try again tomorrow." }, { status: 429 });

  const db = supabaseAdmin();
  const [{ data: author }, { data: listing }] = await Promise.all([
    db.from("profiles").select("id").eq("privy_did", user.did).maybeSingle(),
    db.from("listings").select("status").eq("chain_id", CHAIN_ID).eq("listing_id", listingId).maybeSingle(),
  ]);
  if (!author) return Response.json({ error: "Finish your profile first." }, { status: 400 });
  if (!listing || listing.status === 0 || listing.status === 6) return Response.json({ error: "That listing isn't live." }, { status: 404 });

  const { data: row, error } = await db.from("listing_comments")
    .insert({ chain_id: CHAIN_ID, listing_id: listingId, patch_id: patchId, author: author.id, body })
    .select("id").single();
  if (error || !row) return Response.json({ error: /listing_comments/.test(error?.message ?? "") ? NOT_READY : "Couldn't post that. Try again." }, { status: 500 });
  return Response.json({ id: row.id });
}

/** Hide a comment: its author, or the creator of the listing. DELETE ?id= */
export async function DELETE(req: Request) {
  const user = await getSessionLite(req);
  if (!user?.wallet) return unauthorized(user);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "No such comment." }, { status: 400 });
  const db = supabaseAdmin();
  const { data: c } = await db.from("listing_comments").select("id, author, listing_id").eq("id", id).maybeSingle();
  if (!c) return Response.json({ error: "No such comment." }, { status: 404 });
  const [{ data: me }, { data: listing }] = await Promise.all([
    db.from("profiles").select("id").eq("privy_did", user.did).maybeSingle(),
    db.from("listings").select("creator").eq("chain_id", CHAIN_ID).eq("listing_id", c.listing_id).maybeSingle(),
  ]);
  const own = me?.id === c.author;
  const creator = String(listing?.creator ?? "").toLowerCase() === user.wallet;
  if (!own && !creator) return Response.json({ error: "Only the author or the creator can remove this." }, { status: 403 });
  await db.from("listing_comments").update({ hidden: true }).eq("id", id);
  return Response.json({ ok: true });
}
