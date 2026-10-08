import { DEADLINE } from "@/lib/contest";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { joinContest } from "@/lib/server/contest";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

/** "Count me in": put the signed-in person on the joined list, before they enter anything. Safe to call twice. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (Date.now() >= DEADLINE) return Response.json({ error: "The contest is over." }, { status: 403 });
  if (!allow(`contest-join:${user.did}`, 20)) return Response.json({ error: "Too many tries today." }, { status: 429 });
  try {
    await joinContest(user);
  } catch {
    return Response.json({ error: "Couldn't count you in. Try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
