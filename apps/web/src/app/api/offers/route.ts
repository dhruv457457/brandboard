import { CHAIN_ID } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { createCampaign } from "@/lib/server/campaigns";
import { allow } from "@/lib/server/rateLimit";
import { lookupX, normalizeHandle } from "@/lib/server/xLookup";
import { minListingBond, privyUserForX } from "@/lib/server/xOffers";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

const OFFER_FIELDS = "id, brand, event_id, budget, status, ends_at, target_x_handle, target_x_name, target_x_avatar, target_wallet, message, claimed_at, created_at";

/** Offers you sent (as a brand) and offers made to you (your X account), on this chain. */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const db = supabaseAdmin();
  const mine = [...new Set([...user.wallets, user.wallet].filter(Boolean) as string[])];
  const [sent, received] = await Promise.all([
    db.from("brand_campaigns").select(OFFER_FIELDS).eq("chain_id", CHAIN_ID).eq("kind", "x_offer").eq("privy_did", user.did)
      .order("created_at", { ascending: false }).limit(50),
    db.from("brand_campaigns").select(OFFER_FIELDS).eq("chain_id", CHAIN_ID).eq("kind", "x_offer")
      .or([`target_privy_did.eq."${user.did}"`, ...(mine.length ? [`target_wallet.in.(${mine.join(",")})`] : [])].join(","))
      .order("created_at", { ascending: false }).limit(50),
  ]);
  return Response.json({ sent: sent.data ?? [], received: received.data ?? [] });
}

/**
 * Make an offer to any X account: body { handle, amount (dollars), eventId, message }. Looks up the X account, finds
 * or creates its Privy user and wallet, and sets up the offer's campaign wallet and policy. Returns { id, walletAddress }
 * for the brand to fund.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  if (!allow(`offer:${user.wallet}`, 10)) return bad("You've made 10 offers today. Try again tomorrow.", 429);

  const body = (await req.json().catch(() => ({}))) as { handle?: string; amount?: number; eventId?: number; message?: string };
  const handle = normalizeHandle(String(body.handle ?? ""));
  if (!handle) return bad("Enter an X handle, like @dhruv.");
  const amount = Math.round(Number(body.amount));
  if (!(amount >= 5 && amount <= 10_000)) return bad("Offer between $5 and $10,000.");
  const message = String(body.message ?? "").trim().slice(0, 280) || null;

  const { data: event } = await supabaseAdmin().from("patched_events").select("event_id, name, ends_at, active")
    .eq("chain_id", CHAIN_ID).eq("event_id", Number(body.eventId)).maybeSingle();
  if (!event?.active || new Date(event.ends_at).getTime() < Date.now()) return bad("Pick an event that's still coming up.");
  // The offer stays open until the day after the event, then what's left goes back to the brand.
  const endsAt = Math.floor(new Date(event.ends_at).getTime() / 1000) + 86_400;

  let x;
  try {
    x = await lookupX(handle);
  } catch (err) {
    console.error("x lookup failed", err);
    return bad("Couldn't reach X to look that account up. Try again.", 502);
  }
  if (!x) return bad(`There's no X account @${handle}.`, 404);

  try {
    const target = await privyUserForX(x);
    if ([user.wallet.toLowerCase(), ...user.wallets].includes(target.wallet) || target.did === user.did) return bad("That's your own X account.");
    const advance = await minListingBond();
    const budget = BigInt(amount) * 1_000_000n;
    if (budget <= advance) return bad(`Offer more than the ${Number(advance) / 1e6} USDC listing stake.`);
    const c = await createCampaign({
      brand: user.wallet.toLowerCase(), did: user.did, eventId: event.event_id, budget, maxPerSpot: budget, goal: "most", endsAt,
      offer: { xId: x.id, handle: x.username, name: x.name, avatar: x.avatar, wallet: target.wallet, privyDid: target.did, pregenerated: target.pregenerated, message, advance },
    });
    return Response.json({ id: c.id, walletAddress: c.wallet_address, pregenerated: target.pregenerated });
  } catch (err) {
    console.error("offer create failed", err);
    return bad(err instanceof Error && /X account|wallet/.test(err.message) ? err.message : "Privy couldn't set up the offer. Try again.", 502);
  }
}

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}
