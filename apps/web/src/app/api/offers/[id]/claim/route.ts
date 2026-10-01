import { getSessionUser, unauthorized } from "@/lib/server/auth";
import type { CampaignRow } from "@/lib/server/campaigns";
import { ClaimError, claimOffer } from "@/lib/server/xOffers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The person an offer is for claims it (signed in with that X account). If their wallet can't cover the listing stake,
 * the offer sends it. Returns { advanced (USDC, 6 decimals, as a string), eventId } so the app can open Create.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req, { fresh: true });
  if (!user) return unauthorized();
  const { id } = await params;
  const { data } = await supabaseAdmin().from("brand_campaigns").select("*").eq("id", id).eq("kind", "x_offer").maybeSingle();
  const c = data as CampaignRow | null;
  if (!c) return Response.json({ error: "No such offer." }, { status: 404 });
  if (c.status === "ended" || c.status === "ending") return Response.json({ error: "This offer has closed." }, { status: 410 });
  try {
    const { advanced } = await claimOffer(c, { did: user.did, wallets: [...user.wallets, ...(user.wallet ? [user.wallet] : [])] });
    return Response.json({ advanced: advanced.toString(), eventId: c.event_id });
  } catch (err) {
    if (err instanceof ClaimError) return Response.json({ error: err.message }, { status: 403 });
    console.error("offer claim failed", err);
    return Response.json({ error: "Couldn't claim the offer. Try again." }, { status: 502 });
  }
}
