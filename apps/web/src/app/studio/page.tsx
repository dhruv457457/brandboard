import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { StudioEditor, type StudioEvent } from "./StudioEditor";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
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
  return <StudioEditor events={list} minBond={minBond.toString()} newCreatorCap={newCreatorCap.toString()} />;
}
