import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { StudioEditor, type StudioEvent, type StudioOffer } from "./StudioEditor";

export const dynamic = "force-dynamic";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ event?: string; offer?: string }> }) {
  const params = await searchParams;
  const client = serverClient();
  const [minBond, newCreatorCap, events] = await Promise.all([
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "minBond" }),
    client.readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "newCreatorCap" }),
    supabase()
      .from("patched_events")
      .select("event_id, name, starts_at, ends_at")
      .eq("chain_id", CHAIN_ID)
      .eq("active", true)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);
  const list: StudioEvent[] = (events.data ?? []).map((e) => ({
    id: e.event_id,
    name: e.name,
    startsAt: new Date(e.starts_at).getTime(),
    endsAt: new Date(e.ends_at).getTime(),
  }));
  // Coming from an offer ("Patch anyone on X"): open on its event and say what's waiting.
  let offer: StudioOffer | null = null;
  if (params.offer && /^[0-9a-f-]{36}$/i.test(params.offer)) {
    const { data: o } = await supabase().from("brand_campaigns").select("id, brand, budget, event_id, status")
      .eq("id", params.offer).eq("kind", "x_offer").maybeSingle();
    if (o && (o.status === "active" || o.status === "funding")) {
      const { data: b } = await supabase().from("profiles").select("brand_name, display_name").eq("wallet", o.brand).maybeSingle();
      offer = { id: o.id, amount: Number(o.budget) / 1e6, brand: b?.brand_name ?? b?.display_name ?? "A brand", eventId: o.event_id };
    }
  }
  const initialEventId = Number(params.event) || offer?.eventId || undefined;
  return <StudioEditor events={list} minBond={minBond.toString()} newCreatorCap={newCreatorCap.toString()} initialEventId={initialEventId} offer={offer} />;
}
