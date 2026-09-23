import { CHAIN_ID } from "@/lib/config";
import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { supabase } from "@/lib/supabase";
import { AdminConsole, type AdminEvent } from "./AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [pending, events] = await Promise.all([
    fetchListingCards({ statuses: [0] }),
    supabase().from("patched_events").select("event_id, name, starts_at, ends_at, active").eq("chain_id", CHAIN_ID).order("event_id", { ascending: false }),
  ]);
  const list: AdminEvent[] = (events.data ?? []).map((e) => ({
    id: e.event_id, name: e.name, startsAt: e.starts_at, endsAt: e.ends_at, active: e.active,
  }));
  return <AdminConsole pending={toWire(pending)} events={list} />;
}
