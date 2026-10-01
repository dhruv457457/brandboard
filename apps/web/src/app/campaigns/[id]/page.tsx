import { notFound } from "next/navigation";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { CampaignView, type CampaignInfo, type HeldSpot } from "./CampaignView";

export const metadata = { title: "Campaign · Patched" };
export const dynamic = "force-dynamic";

/** One campaign: its rules, what it spent, the spots it holds and everything it did. */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = supabase();
  const { data: c } = await db.from("brand_campaigns").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: event }, { data: brand }, { data: listings }] = await Promise.all([
    db.from("patched_events").select("name, slug, ends_at").eq("chain_id", c.chain_id).eq("event_id", c.event_id).maybeSingle(),
    db.from("profiles").select("brand_name, brand_logo_url, handle").eq("wallet", c.brand).maybeSingle(),
    db.from("listing_cards").select("listing_id, metadata, creator, creator_handle, creator_name").eq("chain_id", c.chain_id).eq("event_id", c.event_id),
  ]);
  const ids = (listings ?? []).map((l) => l.listing_id);
  const { data: patches } = ids.length
    ? await db.from("patches").select("listing_id, patch_id, label, top_bid").eq("chain_id", CHAIN_ID).eq("top_bidder", c.brand).in("listing_id", ids)
    : { data: [] as { listing_id: number; patch_id: number; label: string; top_bid: number }[] };

  const held: HeldSpot[] = (patches ?? []).map((p) => {
    const l = listings?.find((x) => x.listing_id === p.listing_id);
    const meta = l?.metadata as { title?: string; patches?: { id: number; name: string }[] } | null;
    return {
      key: `${p.listing_id}:${p.patch_id}`,
      label: meta?.patches?.find((m) => m.id === p.patch_id)?.name ?? p.label,
      title: meta?.title ?? `Listing #${p.listing_id}`,
      who: l?.creator_name ?? (l?.creator_handle ? `@${l.creator_handle}` : "a creator"),
      href: `/${l?.creator_handle ?? l?.creator}/${p.listing_id}`,
      amount: Number(p.top_bid) / 1e6,
    };
  });

  const info: CampaignInfo = {
    id: c.id,
    brand: c.brand,
    brandName: brand?.brand_name ?? null,
    brandLogo: brand?.brand_logo_url ?? null,
    eventId: c.event_id,
    eventName: event?.name ?? `Event ${c.event_id}`,
    eventHref: `/e/${event?.slug ?? c.event_id}`,
    budget: Number(c.budget) / 1e6,
    maxPerSpot: Number(c.max_per_spot) / 1e6,
    goal: c.goal,
    endsAt: Math.floor(new Date(c.ends_at).getTime() / 1000),
    walletAddress: c.wallet_address,
    policyId: c.policy_id,
    aggregationId: c.aggregation_id ?? null,
    startsAt: Math.floor(new Date(c.created_at).getTime() / 1000),
    status: c.status,
  };
  return <CampaignView campaign={info} held={held} />;
}
