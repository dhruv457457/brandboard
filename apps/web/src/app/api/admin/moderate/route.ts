import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { canModerate, dismissReports, hideTarget, restoreTarget, type TargetKind } from "@/lib/server/moderation";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

/** Hide, restore or dismiss reports on one listing or spotted photo: { kind, id, action: "hide" | "restore" | "dismiss" }. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!(await canModerate(user.wallet))) return Response.json({ error: "Only admins can do that." }, { status: 403 });
  if (!allow(`moderate:${user.did}`, 300)) return Response.json({ error: "Too many actions today." }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { kind?: string; id?: string | number; action?: string };
  const kind = body.kind as TargetKind;
  const id = String(body.id ?? "");
  if ((kind !== "listing" && kind !== "post") || !id) return Response.json({ error: "Say what to moderate." }, { status: 400 });
  if (body.action === "hide") await hideTarget(kind, id, user.wallet ?? user.did, "hidden by an admin");
  else if (body.action === "restore") await restoreTarget(kind, id);
  else if (body.action === "dismiss") await dismissReports(kind, id);
  else return Response.json({ error: "Unknown action." }, { status: 400 });
  return Response.json({ ok: true });
}
