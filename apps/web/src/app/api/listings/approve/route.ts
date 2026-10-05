import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { approveListings } from "@/lib/server/autoApprove";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Open a listing right after its creator published it: { listingId }. There is no review step, so this only asks the
 * approver wallet to do what the keeper would do within a minute anyway. Safe to call for any listing (the market
 * refuses one that is already live), and rate-limited per person.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!allow(`approve:${user.did}`, 200)) return Response.json({ error: "Too many requests today." }, { status: 429 });
  const { listingId } = (await req.json().catch(() => ({}))) as { listingId?: number };
  if (!Number.isInteger(listingId) || listingId! < 1) return Response.json({ error: "Send a listing id." }, { status: 400 });
  const [result] = await approveListings([listingId!]);
  return Response.json(result);
}
