import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { createCampaign } from "@/lib/server/campaigns";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Start a campaign: body { eventId, budget, maxPerSpot, goal, endsAt } (dollars; endsAt in unix seconds). Creates
 * the campaign's Privy policy and server wallet. Returns { id, walletAddress } for the brand to fund.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  if (!allow(`campaign:${user.wallet}`, 5)) return Response.json({ error: "You've started 5 campaigns today. Try again tomorrow." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { eventId?: number; budget?: number; maxPerSpot?: number; goal?: string; endsAt?: number };
  const budget = Math.round(Number(body.budget));
  const maxPerSpot = Math.round(Number(body.maxPerSpot));
  const endsAt = Math.floor(Number(body.endsAt));
  const goal = body.goal === "prime" ? "prime" : "most";
  if (!(budget >= 10 && budget <= 10_000)) return bad("Pick a budget between $10 and $10,000.");
  if (!(maxPerSpot >= 1 && maxPerSpot <= budget)) return bad("The most per spot has to be between $1 and your budget.");

  const { data: event } = await supabaseAdmin().from("patched_events").select("event_id, ends_at, active")
    .eq("chain_id", CHAIN_ID).eq("event_id", Number(body.eventId)).maybeSingle();
  if (!event?.active) return bad("Pick an event that's accepting listings.");
  const latest = Math.floor(new Date(event.ends_at).getTime() / 1000) + 86_400;
  if (!(endsAt > Date.now() / 1000 + 600 && endsAt <= latest)) return bad("The campaign has to end after now and by the day after the event.");

  try {
    const c = await createCampaign({
      brand: user.wallet.toLowerCase(),
      did: user.did,
      eventId: event.event_id,
      budget: BigInt(budget) * 1_000_000n,
      maxPerSpot: BigInt(maxPerSpot) * 1_000_000n,
      goal,
      endsAt,
    });
    return Response.json({ id: c.id, walletAddress: c.wallet_address });
  } catch (err) {
    console.error("campaign create failed", err);
    return Response.json({ error: "Privy couldn't set up the campaign wallet. Try again." }, { status: 502 });
  }
}

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}
