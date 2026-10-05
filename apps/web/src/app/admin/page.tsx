import { CHAIN_ID } from "@/lib/config";
import { fetchAdminReview } from "@/lib/market/server";
import { fetchModeration } from "@/lib/server/moderationView";
import { supabase } from "@/lib/supabase";
import { AdminConsole, type AdminEvent } from "./AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [moderation, review, events] = await Promise.all([
    fetchModeration().catch(() => ({ reported: [], hidden: [] })),
    fetchAdminReview(),
    supabase().from("patched_events").select("event_id, name, starts_at, ends_at, active, slug, city, venue, description, banner_url, links").eq("chain_id", CHAIN_ID).order("event_id", { ascending: false }),
  ]);
  const list: AdminEvent[] = (events.data ?? []).map((e) => ({
    id: e.event_id, name: e.name, startsAt: e.starts_at, endsAt: e.ends_at, active: e.active,
    slug: e.slug, city: e.city, venue: e.venue, description: e.description, bannerUrl: e.banner_url,
    website: (e.links as { website?: string | null } | null)?.website ?? null,
    x: (e.links as { x?: string | null } | null)?.x ?? null,
  }));
  return <AdminConsole moderation={moderation} review={review} events={list} />;
}
