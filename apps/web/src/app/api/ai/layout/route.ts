import { suggestLayout, type Surface } from "@patched/ai";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Suggest patch spots on a canvas image. Body: { canvasUrl, surface, count }. Returns { patches }. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const { canvasUrl, surface, count } = (await req.json()) as { canvasUrl?: string; surface?: Surface; count?: number };
  if (!canvasUrl?.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!) || !surface) {
    return Response.json({ error: "Make a canvas first." }, { status: 400 });
  }
  if (!allow(`layout:${user.wallet}`, 20)) return Response.json({ patches: [] });
  try {
    return Response.json({ patches: await suggestLayout(canvasUrl, surface, Math.min(Math.max(count ?? 5, 1), 8)) });
  } catch (err) {
    console.error("layout failed", err);
    return Response.json({ patches: [] });
  }
}
