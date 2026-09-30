import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { OfferView, type OfferInfo } from "./OfferView";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = supabase();
  const { data: c } = await db.from("brand_campaigns").select("*").eq("id", id).eq("kind", "x_offer").maybeSingle();
  if (!c) return null;
  const [{ data: brand }, { data: event }, { data: actions }] = await Promise.all([
    db.from("profiles").select("brand_name, brand_logo_url, display_name, handle").eq("wallet", c.brand).maybeSingle(),
    db.from("patched_events").select("name, slug").eq("chain_id", c.chain_id).eq("event_id", c.event_id).maybeSingle(),
    db.from("brand_campaign_actions").select("id, kind, text, amount, tx_hash, created_at").eq("campaign_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const info: OfferInfo = {
    id: c.id,
    brand: c.brand,
    brandName: brand?.brand_name ?? brand?.display_name ?? null,
    brandLogo: brand?.brand_logo_url ?? null,
    handle: c.target_x_handle,
    name: c.target_x_name ?? c.target_x_handle,
    avatar: c.target_x_avatar,
    targetWallet: c.target_wallet,
    amount: Number(c.budget) / 1e6,
    advance: c.advance ? Number(c.advance) / 1e6 : 0,
    message: c.message,
    eventId: c.event_id,
    eventName: event?.name ?? `Event ${c.event_id}`,
    eventHref: `/e/${event?.slug ?? c.event_id}`,
    endsAt: Math.floor(new Date(c.ends_at).getTime() / 1000),
    walletAddress: c.wallet_address,
    status: c.status,
    claimed: !!c.claimed_at,
    pregenerated: !!c.pregenerated,
    actions: (actions ?? []).map((a) => ({ id: String(a.id), kind: a.kind, text: a.text, txHash: a.tx_hash, at: a.created_at })),
  };
  return info;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const o = await load((await params).id);
  if (!o) return { title: "Offer · Patched" };
  const title = `${o.brandName ?? "A brand"} wants to patch @${o.handle} · $${o.amount}`;
  return { title, description: `$${o.amount} in USDC for a spot at ${o.eventName}. Sign in with X to claim it on Patched.`, openGraph: { title } };
}

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const o = await load((await params).id);
  if (!o) notFound();
  return <OfferView offer={o} />;
}
