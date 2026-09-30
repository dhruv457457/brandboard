import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { lookupX, normalizeHandle } from "@/lib/server/xLookup";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Preview an X account before making an offer: GET ?handle=dhruv -> { username, name, avatar, followers, onPatched }. */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!allow(`xlookup:${user.did}`, 200)) return Response.json({ error: "Too many lookups today." }, { status: 429 });
  const handle = normalizeHandle(new URL(req.url).searchParams.get("handle") ?? "");
  if (!handle) return Response.json({ error: "Enter an X handle, like @dhruv." }, { status: 400 });
  try {
    const x = await lookupX(handle);
    if (!x) return Response.json({ error: `There's no X account @${handle}.` }, { status: 404 });
    const { data: profile } = await supabaseAdmin().from("profiles").select("handle").ilike("x_handle", x.username).maybeSingle();
    return Response.json({ username: x.username, name: x.name, avatar: x.avatar, followers: x.followers, onPatched: profile?.handle ?? null });
  } catch {
    return Response.json({ error: "Couldn't reach X to look that account up. Try again." }, { status: 502 });
  }
}
