import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type Kind = "profile" | "event";
const ADDRESS = /^0x[0-9a-f]{40}$/;
const EVENT = new RegExp(`^${CHAIN_ID}:\\d{1,6}$`);

/** Is this a thing that can be followed? A profile that exists (by wallet), or an event on this chain. */
async function validTarget(kind: Kind, id: string): Promise<boolean> {
  if (kind === "event") return EVENT.test(id);
  if (!ADDRESS.test(id)) return false;
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("wallet", id).maybeSingle();
  return !!data;
}

async function status(kind: Kind, id: string, me: string | null) {
  const db = supabaseAdmin();
  const [{ count }, mine] = await Promise.all([
    db.from("follows").select("follower", { count: "exact", head: true }).eq("target_kind", kind).eq("target_id", id),
    me
      ? db.from("follows").select("follower").eq("follower", me).eq("target_kind", kind).eq("target_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return { count: count ?? 0, following: !!mine.data };
}

/**
 * GET ?kind=profile|event&id=...  gives { count, following } (following needs a sign-in, else false).
 * GET ?mine=1                      gives { profiles: [wallet], events: [id] }: what the signed-in person follows.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getSessionUser(req);
  const me = user?.wallet ?? null;
  if (url.searchParams.get("mine")) {
    if (!me) return Response.json({ profiles: [], events: [] });
    const { data } = await supabaseAdmin().from("follows").select("target_kind, target_id").eq("follower", me).limit(500);
    const rows = data ?? [];
    return Response.json({
      profiles: rows.filter((r) => r.target_kind === "profile").map((r) => r.target_id),
      events: rows.filter((r) => r.target_kind === "event").map((r) => Number(r.target_id.split(":")[1])),
    });
  }
  const kind = url.searchParams.get("kind") as Kind;
  const id = (url.searchParams.get("id") ?? "").toLowerCase();
  if ((kind !== "profile" && kind !== "event") || !id) return Response.json({ error: "Say what to look up." }, { status: 400 });
  return Response.json(await status(kind, id, me), { headers: { "cache-control": "no-store" } });
}

async function change(req: Request, follow: boolean) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const body = (await req.json().catch(() => null)) as { kind?: Kind; id?: string } | null;
  const kind = body?.kind;
  const id = String(body?.id ?? "").toLowerCase();
  if ((kind !== "profile" && kind !== "event") || !id) return Response.json({ error: "Say what to follow." }, { status: 400 });
  if (!allow(`follow:${user.wallet}`, 300)) return Response.json({ error: "Too many follows today. Try again tomorrow." }, { status: 429 });
  if (kind === "profile" && id === user.wallet) return Response.json({ error: "You can't follow yourself." }, { status: 400 });
  if (!(await validTarget(kind, id))) return Response.json({ error: "That can't be followed." }, { status: 404 });

  const db = supabaseAdmin();
  const { error } = follow
    ? await db.from("follows").upsert({ follower: user.wallet, target_kind: kind, target_id: id }, { onConflict: "follower,target_kind,target_id", ignoreDuplicates: true })
    : await db.from("follows").delete().eq("follower", user.wallet).eq("target_kind", kind).eq("target_id", id);
  if (error) return Response.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  return Response.json(await status(kind, id, user.wallet));
}

export const POST = (req: Request) => change(req, true);
export const DELETE = (req: Request) => change(req, false);
