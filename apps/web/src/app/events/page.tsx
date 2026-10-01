import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EventCard } from "@/components/events/EventCard";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";

// Cached for 30s and rebuilt in the background.
export const revalidate = 30;
export const metadata = { title: "Events · Patched" };

interface EventRow {
  event_id: number;
  name: string;
  slug: string | null;
  starts_at: string;
  ends_at: string;
  city: string | null;
  venue: string | null;
  banner_url: string | null;
  description: string | null;
}

/** Every event creators can sell spots for, with how many listings each has. */
export default async function EventsPage() {
  const db = supabase();
  const [{ data: events }, { data: listings }] = await Promise.all([
    db.from("patched_events").select("event_id, name, slug, starts_at, ends_at, city, venue, banner_url, description")
      .eq("chain_id", CHAIN_ID).eq("active", true).order("starts_at", { ascending: true }),
    db.from("listing_cards").select("event_id, status").eq("chain_id", CHAIN_ID).in("status", [1, 2, 3]),
  ]);

  const count = (id: number) => {
    const rows = (listings ?? []).filter((l) => l.event_id === id);
    return { all: rows.length, live: rows.filter((l) => l.status === 1).length };
  };
  const now = Date.now();
  const all = (events ?? []) as EventRow[];
  const upcoming = all.filter((e) => new Date(e.ends_at).getTime() >= now);
  const past = all.filter((e) => new Date(e.ends_at).getTime() < now).reverse();

  const card = (e: EventRow) => {
    const n = count(e.event_id);
    return (
      <EventCard key={e.event_id} event={{
        id: e.event_id, name: e.name, slug: e.slug, startsAt: e.starts_at, endsAt: e.ends_at, city: e.city, venue: e.venue,
        banner: e.banner_url, description: e.description, live: n.live, listings: n.all,
      }} />
    );
  };

  return (
    <main className="wrap pt-8 pb-24 grid gap-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="eyebrow">Events</span>
          <h1 className="font-extrabold text-4xl tracking-tight mt-1">Where creators get patched</h1>
          <p className="text-[var(--muted)] mt-1 max-w-xl">Pick an event to see every outfit, car and team hoodie selling logo spots for it.</p>
        </div>
        <Link href="/studio" className="btn-base btn-primary">List your spots</Link>
      </div>

      <section className="grid gap-3">
        <h2 className="text-2xl font-extrabold">Coming up</h2>
        {upcoming.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map(card)}</div>
        ) : (
          <Card className="p-6"><p className="muted">No upcoming events yet. <Link href="/explore" className="underline">Browse live listings</Link> instead.</p></Card>
        )}
      </section>

      {past.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-2xl font-extrabold">Past events</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-80">{past.map(card)}</div>
        </section>
      )}
    </main>
  );
}
