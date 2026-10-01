import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { OfferBuilder, type OfferEvent } from "./OfferBuilder";

export const metadata = { title: "Patch anyone on X · Patched" };
export const revalidate = 30;

/** Make an offer to any X account, for a spot at an event that's still coming up. */
export default async function NewOfferPage() {
  const { data } = await supabase().from("patched_events").select("event_id, name, starts_at, ends_at")
    .eq("chain_id", CHAIN_ID).eq("active", true).gte("ends_at", new Date().toISOString()).order("starts_at");
  const events: OfferEvent[] = (data ?? []).map((e) => ({ id: e.event_id, name: e.name, endsAt: new Date(e.ends_at).getTime() }));
  return <OfferBuilder events={events} />;
}
