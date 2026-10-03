import { CHAIN_ID } from "@/lib/config";
import { getSessionLite, getSessionWallet, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import { reactionsFor } from "@/lib/server/reactions";
import type { SpottedPost } from "@/lib/spotted";

export const runtime = "nodejs";

const PHOTOS = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/proofs/`;

/**
 * Spotted photos, newest first. GET ?eventId=, ?listingId= or ?wallet= (the creator who was spotted); at most 40.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = supabaseAdmin();
  const mePromise = getSessionWallet(req); // runs while the queries below do
  let q = db.from("posts")
    .select("id, body, media, created_at, listing_id, event_id, spotted_wallet, author")
    .eq("chain_id", CHAIN_ID).eq("hidden", false).not("spotted_wallet", "is", null)
    .order("created_at", { ascending: false }).limit(40);
  const eventId = Number(url.searchParams.get("eventId"));
  const listingId = Number(url.searchParams.get("listingId"));
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  if (eventId) q = q.eq("event_id", eventId);
  else if (listingId) q = q.eq("listing_id", listingId);
  else if (wallet && /^0x[0-9a-f]{40}$/.test(wallet)) q = q.eq("spotted_wallet", wallet);
  else return Response.json({ error: "Say which event, listing or creator." }, { status: 400 });
  const { data } = await q;
  const rows = data ?? [];

  const ids = [...new Set(rows.map((r) => r.author))];
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, display_name, handle, avatar_url, wallet").in("id", ids)
    : { data: [] as { id: string; display_name: string | null; handle: string | null; avatar_url: string | null; wallet: string | null }[] };
  const who = new Map((profiles ?? []).map((p) => [p.id, p]));

  const reactions = await reactionsFor(rows.map((r) => r.id), await mePromise);
  const posts: SpottedPost[] = rows.flatMap((r) => {
    const photo = (r.media as { url?: string }[] | null)?.[0]?.url;
    if (!photo) return [];
    const a = who.get(r.author);
    return [{
      id: r.id, photo, caption: r.body === "Spotted" ? null : r.body, createdAt: r.created_at,
      listingId: r.listing_id, eventId: r.event_id, creator: r.spotted_wallet, reactions: reactions[r.id],
      author: { name: a?.display_name ?? (a?.handle ? `@${a.handle}` : "Someone"), handle: a?.handle ?? null, avatar: a?.avatar_url ?? null, wallet: a?.wallet ?? null },
    }];
  });
  return Response.json({ posts }, { headers: { "cache-control": "no-store" } });
}

/** Post a spotted photo. Body: { listingId, photo (an uploaded proofs image), caption? }. */
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
  if (!allow(`spotted:${user.wallet}`, 20)) return Response.json({ error: "That's 20 spots today. Try again tomorrow." }, { status: 429 });

  const db = supabaseAdmin();
  const [{ data: author }, { data: listing }] = await Promise.all([
    db.from("profiles").select("id, display_name, handle").eq("privy_did", user.did).maybeSingle(),
    db.from("listings").select("creator, event_id, status").eq("chain_id", CHAIN_ID).eq("listing_id", listingId).maybeSingle(),
  ]);
  if (!author) return Response.json({ error: "Finish your profile first." }, { status: 400 });
  if (!listing || listing.status === 0 || listing.status === 6) return Response.json({ error: "That listing isn't live." }, { status: 404 });
  if (String(listing.creator).toLowerCase() === user.wallet) return Response.json({ error: "Spot someone else: this is your own listing." }, { status: 400 });

  const { data: post, error } = await db.from("posts").insert({
    author: author.id, chain_id: CHAIN_ID, listing_id: listingId, event_id: listing.event_id || null,
    spotted_wallet: String(listing.creator).toLowerCase(), body: caption || "Spotted", media: [{ url: photo }],
  }).select("id").single();
  if (error || !post) return Response.json({ error: "Couldn't post that. Try again." }, { status: 500 });

  // Tell the person who was spotted.
  await db.from("notifications").upsert({
    chain_id: CHAIN_ID, tx_hash: `spotted:${post.id}`, log_index: 0, wallet: String(listing.creator).toLowerCase(), kind: "spotted",
    payload: { listingId: String(listingId), by: author.display_name ?? (author.handle ? `@${author.handle}` : "Someone"), photo, caption },
  }, { onConflict: "chain_id,tx_hash,log_index,wallet,kind", ignoreDuplicates: true });
  return Response.json({ id: post.id });
}

/** Hide a spotted post: its author, or the creator it shows. DELETE ?id= */
export async function DELETE(req: Request) {
  const user = await getSessionLite(req);
  if (!user?.wallet) return unauthorized(user);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "No such post." }, { status: 400 });
  const db = supabaseAdmin();
  const [{ data: post }, { data: me }] = await Promise.all([
    db.from("posts").select("author, spotted_wallet").eq("id", id).maybeSingle(),
    db.from("profiles").select("id").eq("privy_did", user.did).maybeSingle(),
  ]);
  if (!post) return Response.json({ error: "No such post." }, { status: 404 });
  if (post.spotted_wallet !== user.wallet && post.author !== me?.id) return Response.json({ error: "Only the person who posted it, or the creator it shows, can remove it." }, { status: 403 });
  await db.from("posts").update({ hidden: true }).eq("id", id);
  return Response.json({ ok: true });
}
