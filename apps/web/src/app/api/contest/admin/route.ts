import { CONTEST, TRACKS, type TrackId } from "@/lib/contest";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { canModerate } from "@/lib/server/moderation";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

async function admin(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return { error: unauthorized() };
  if (!(await canModerate(user.wallet))) return { error: Response.json({ error: "Only admins can do that." }, { status: 403 }) };
  return { user };
}

/** Every entry with its private fields (email, Telegram, links, feedback), for the team to review. */
export async function GET(req: Request) {
  const a = await admin(req);
  if (a.error) return a.error;
  const { data } = await supabaseAdmin().from("contest_entries")
    .select("id, x_handle, email, telegram, tracks, post_url, feedback_url, feedback_text, valid, created_at, updated_at")
    .eq("contest", CONTEST).order("created_at").order("id").limit(5000);
  return Response.json({ entries: data ?? [] }, { headers: { "cache-control": "no-store" } });
}

/**
 * { id, valid: true | false | null }: rule an entry in or out.
 * { winner: { track, handle, note?, tx? } }: record a winner and the prize transaction (shown on the page).
 * { clearWinner: track }: take one back.
 */
export async function POST(req: Request) {
  const a = await admin(req);
  if (a.error) return a.error;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; valid?: boolean | null; winner?: { track?: string; handle?: string; note?: string; tx?: string }; clearWinner?: string;
  };
  const db = supabaseAdmin();
  if (body.id && "valid" in body) {
    if (!/^[0-9a-f-]{36}$/i.test(body.id) || (body.valid !== null && typeof body.valid !== "boolean")) return Response.json({ error: "Bad request." }, { status: 400 });
    await db.from("contest_entries").update({ valid: body.valid }).eq("contest", CONTEST).eq("id", body.id);
    return Response.json({ ok: true });
  }
  if (body.winner) {
    const track = body.winner.track as TrackId;
    const handle = String(body.winner.handle ?? "").trim().replace(/^@/, "");
    const tx = String(body.winner.tx ?? "").trim();
    if (!TRACKS.some((t) => t.id === track) || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return Response.json({ error: "Pick a track and an X handle." }, { status: 400 });
    if (tx && !/^0x[0-9a-fA-F]{64}$/.test(tx)) return Response.json({ error: "That isn't a transaction hash." }, { status: 400 });
    await db.from("contest_winners").upsert({ contest: CONTEST, track, x_handle: handle, note: String(body.winner.note ?? "").slice(0, 200) || null, tx_hash: tx || null }, { onConflict: "contest,track" });
    return Response.json({ ok: true });
  }
  if (body.clearWinner && TRACKS.some((t) => t.id === body.clearWinner)) {
    await db.from("contest_winners").delete().eq("contest", CONTEST).eq("track", body.clearWinner);
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Nothing to do." }, { status: 400 });
}
