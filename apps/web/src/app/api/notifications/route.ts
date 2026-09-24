import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Mark the signed-in user's notifications read: all of them, or `{ ids: [...] }`. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  let q = supabaseAdmin()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("chain_id", CHAIN_ID)
    .eq("wallet", user.wallet)
    .is("read_at", null);
  if (Array.isArray(body.ids)) q = q.in("id", body.ids.filter((x): x is string => typeof x === "string").slice(0, 100));
  const { error } = await q;
  if (error) return Response.json({ error: "Couldn't update notifications." }, { status: 500 });
  return Response.json({ ok: true });
}
