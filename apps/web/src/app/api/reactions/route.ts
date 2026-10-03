import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import { KINDS, reactionsFor, type Kind } from "@/lib/server/reactions";

export const runtime = "nodejs";

/** GET ?ids=a,b,c gives each post's counts and which reactions the signed-in person has used (up to 40 posts). */
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 40);
  const me = (await getSessionUser(req))?.wallet ?? null;
  return Response.json(await reactionsFor(ids, me), { headers: { "cache-control": "no-store" } });
}

async function change(req: Request, on: boolean) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json().catch(() => null)) as { postId?: string; kind?: Kind } | null;
  const postId = String(body?.postId ?? "");
  const kind = body?.kind;
  if (!/^[0-9a-f-]{36}$/i.test(postId) || !kind || !KINDS.includes(kind)) return Response.json({ error: "Pick a reaction." }, { status: 400 });
  if (!allow(`react:${user.wallet}`, 500)) return Response.json({ error: "Too many reactions today." }, { status: 429 });
  const db = supabaseAdmin();
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
