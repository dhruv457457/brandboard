import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** The app's error screens report the crash here (message, where, which browser) so it can be read later. */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(`client-error:${ip}`, 30)) return Response.json({ ok: false }, { status: 429 });
  const b = (await req.json().catch(() => null)) as { message?: string; stack?: string; digest?: string; path?: string; stale?: boolean } | null;
  if (!b?.message) return Response.json({ ok: false }, { status: 400 });
  await supabaseAdmin().from("client_errors").insert({
    message: String(b.message).slice(0, 500),
    stack: b.stack ? String(b.stack).slice(0, 2000) : null,
    digest: b.digest ? String(b.digest).slice(0, 80) : null,
    path: b.path ? String(b.path).slice(0, 200) : null,
    user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    stale_build: !!b.stale,
  });
  return Response.json({ ok: true });
}
