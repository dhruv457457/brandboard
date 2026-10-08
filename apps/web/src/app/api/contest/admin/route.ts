import { CONTEST, TRACKS, type TrackId } from "@/lib/contest";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { keccak256, toBytes } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, serverClient } from "@/lib/config";
import type { SessionUser } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { contestFunnel } from "@/lib/server/contest";

export const runtime = "nodejs";

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));

/**
 * Who may read entries (emails, Telegram names) and rule on them. NOT the app's "open admin" (which lets any signed-in
 * person act as an admin on the play-money site): entries are private, so this needs one of
 * - an X handle listed in CONTEST_ADMINS (comma separated, no @; defaults to the two Patched accounts), checked against the
 *   handle Privy verified on the signed-in account,
 * - a wallet listed in CONTEST_ADMIN_WALLETS, or
 * - a wallet that holds the market's real ADMIN_ROLE.
 */
async function isContestAdmin(user: SessionUser): Promise<boolean> {
  const handles = (process.env.CONTEST_ADMINS ?? "dhruvpanch0li,Patched_world").toLowerCase().split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
  if (user.xHandle && handles.includes(user.xHandle.toLowerCase())) return true;
  const wallets = (process.env.CONTEST_ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const mine = [user.wallet, ...user.wallets].filter(Boolean).map((w) => String(w).toLowerCase());
  if (mine.some((w) => wallets.includes(w))) return true;
  if (!user.wallet) return false;
  return serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, user.wallet] }).catch(() => false);
}

async function admin(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return { error: unauthorized() };
  if (!(await isContestAdmin(user))) return { error: Response.json({ error: "Only the contest team can do that." }, { status: 403 }) };
  return { user };
}

/** Every entry with its private fields (email, Telegram, links, feedback), for the team to review. */
export async function GET(req: Request) {
  const a = await admin(req);
  if (a.error) return a.error;
  const { data } = await supabaseAdmin().from("contest_entries")
    .select("id, x_handle, email, telegram, tracks, post_url, feedback_url, feedback_text, valid, created_at, updated_at")
    .eq("contest", CONTEST).order("created_at").order("id").limit(5000);
  const [funnel, { data: joined }] = await Promise.all([
    contestFunnel(),
    supabaseAdmin().from("contest_signups").select("x_handle, wallet, created_at").eq("contest", CONTEST).order("created_at", { ascending: false }).limit(1000),
  ]);
  return Response.json({ entries: data ?? [], funnel, joined: joined ?? [] }, { headers: { "cache-control": "no-store" } });
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
