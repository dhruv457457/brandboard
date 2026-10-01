import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { runCampaigns } from "@/lib/server/campaigns";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The owner controls a campaign: body { status: "active" | "paused" | "ending" } to resume, pause or end it
 * (ending sends what's left back), or { run: true } to let it act now instead of waiting for the next keeper tick.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: c } = await db.from("brand_campaigns").select("id, privy_did, status").eq("id", id).maybeSingle();
  if (!c || c.privy_did !== user.did) return Response.json({ error: "Not your campaign." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { status?: string; run?: boolean };
  if (body.status) {
    const next = body.status;
    const ok = (c.status === "active" && (next === "paused" || next === "ending"))
      || (c.status === "paused" && (next === "active" || next === "ending"))
      || (c.status === "funding" && next === "ending");
    if (!ok) return Response.json({ error: "That change isn't possible right now." }, { status: 400 });
    await db.from("brand_campaigns").update({ status: next }).eq("id", id);
    if (next === "paused") await db.from("brand_campaign_actions").insert({ campaign_id: id, kind: "skip", text: "Paused. No new bids until you resume." });
    if (next === "active") await db.from("brand_campaign_actions").insert({ campaign_id: id, kind: "skip", text: "Resumed." });
  }
  if (body.run && !allow(`campaign-run:${user.did}`, 60)) return Response.json({ error: "Too many runs today. The campaign still acts every minute on its own." }, { status: 429 });
  if (body.run || body.status === "ending") await runCampaigns();
  return Response.json({ ok: true });
}
