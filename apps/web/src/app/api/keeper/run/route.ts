import { runKeeper } from "@/lib/server/keeper";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Keeper tick. Called every minute by the scheduler (Supabase pg_cron in production) with
 * `Authorization: Bearer <KEEPER_SECRET>`. Returns what it did.
 */
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.KEEPER_SECRET || token !== process.env.KEEPER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const actions = await runKeeper();
    return Response.json({ ok: true, actions });
  } catch (err) {
    console.error("keeper failed", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
