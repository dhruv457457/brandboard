import { CONTEST, FUNNEL_STEPS, type FunnelStep } from "@/lib/contest";
import { allowRate } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * One anonymous funnel step from the contest page: { visitor, step }. `visitor` is a random id the browser keeps, so a
 * person counts once per step; nothing personal is stored. Counts are for the team (see /api/contest/admin).
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRate(`contest-track:${ip}`, 30, 60_000)) return new Response(null, { status: 204 });
  const body = (await req.json().catch(() => null)) as { visitor?: string; step?: string } | null;
  const visitor = String(body?.visitor ?? "");
  const step = body?.step as FunnelStep;
  if (!/^[a-z0-9]{12,40}$/.test(visitor) || !FUNNEL_STEPS.includes(step)) return new Response(null, { status: 204 });
  await supabaseAdmin().from("contest_funnel").upsert({ contest: CONTEST, visitor, step }, { onConflict: "contest,visitor,step", ignoreDuplicates: true });
  return new Response(null, { status: 204 });
}
