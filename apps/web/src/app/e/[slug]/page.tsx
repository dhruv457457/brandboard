import { notFound } from "next/navigation";
import { CHAIN_ID } from "@/lib/config";
import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { supabase } from "@/lib/supabase";
import { EventView } from "./EventView";

export const dynamic = "force-dynamic";

/** Event page. The URL is the event's slug, or its on-chain id (/e/1). */
export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = supabase();
  const q = db.from("patched_events").select("event_id, name, starts_at, ends_at, active, city, description").eq("chain_id", CHAIN_ID);
  const { data: event } = /^\d+$/.test(slug) ? await q.eq("event_id", Number(slug)).maybeSingle() : await q.eq("slug", slug).maybeSingle();
  if (!event) notFound();
  const cards = await fetchListingCards({ eventId: event.event_id, statuses: [1, 2, 3] });
  return (
    <EventView
      event={{
        id: event.event_id,
        name: event.name,
        startsAt: new Date(event.starts_at).getTime(),
        endsAt: new Date(event.ends_at).getTime(),
        city: event.city,
        description: event.description,
        active: event.active,
      }}
      cards={toWire(cards)}
    />
  );
}
