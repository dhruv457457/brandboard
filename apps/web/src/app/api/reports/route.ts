import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { AUTO_HIDE_AT, REASONS, hideTarget, type Reason, type TargetKind } from "@/lib/server/moderation";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Report a listing or a spotted photo: { kind: "listing" | "post", id, reason, note? }. One report per person per
 * thing. Nothing waits for approval, so this is how bad posts come down: an admin hides it from the Reports list, and
 * when AUTO_HIDE_AT different people report the same thing it is hidden at once.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!allow(`report:${user.did}`, 30)) return Response.json({ error: "Too many reports today." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { kind?: string; id?: string | number; reason?: string; note?: string };
  const kind = body.kind as TargetKind;
  const id = String(body.id ?? "");
  if ((kind !== "listing" && kind !== "post") || !id) return Response.json({ error: "Say what you are reporting." }, { status: 400 });
  if (!REASONS.includes(body.reason as Reason)) return Response.json({ error: "Pick a reason." }, { status: 400 });
  if (kind === "listing" && !/^\d{1,9}$/.test(id)) return Response.json({ error: "No such listing." }, { status: 404 });

  const db = supabaseAdmin();
  const [{ data: me }, exists] = await Promise.all([
    db.from("profiles").select("id").eq("privy_did", user.did).maybeSingle(),
    kind === "listing"
      ? db.from("listings").select("listing_id").eq("chain_id", CHAIN_ID).eq("listing_id", Number(id)).maybeSingle()
      : db.from("posts").select("id").eq("id", id).maybeSingle(),
  ]);
  if (!me) return Response.json({ error: "Set up your profile first." }, { status: 400 });
  if (!exists.data) return Response.json({ error: "That is already gone." }, { status: 404 });

  const { error } = await db.from("reports").insert({
    chain_id: CHAIN_ID, target_kind: kind, target_id: id, reporter: me.id, reason: body.reason,
    note: body.note ? String(body.note).trim().slice(0, 300) || null : null,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ ok: true, already: true });
    return Response.json({ error: "Couldn't send your report." }, { status: 500 });
  }

  const { count } = await db.from("reports").select("id", { count: "exact", head: true })
    .eq("chain_id", CHAIN_ID).eq("target_kind", kind).eq("target_id", id).is("resolved_at", null);
  if ((count ?? 0) >= AUTO_HIDE_AT) await hideTarget(kind, id, "reports", `${count} reports`);
  return Response.json({ ok: true, hidden: (count ?? 0) >= AUTO_HIDE_AT });
}
