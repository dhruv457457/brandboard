import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
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
  description: string | null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Every event creators can sell spots for, with how many listings each has. */
export default async function EventsPage() {
  const db = supabase();
  const [{ data: events }, { data: listings }] = await Promise.all([
    db.from("patched_events").select("event_id, name, slug, starts_at, ends_at, city, description")
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
      <Link key={e.event_id} href={`/e/${e.slug ?? e.event_id}`} className="no-underline">
        <Card className="p-5 grid gap-2 h-full hover:bg-[var(--soft)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-extrabold leading-tight">{e.name}</h3>
            {n.live > 0 && <Chip variant="green">{n.live} live</Chip>}
          </div>
          <p className="text-sm text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {day(e.starts_at)}{e.ends_at.slice(0, 10) !== e.starts_at.slice(0, 10) ? ` – ${day(e.ends_at)}` : ""}</span>
            {e.city && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {e.city}</span>}
          </p>
          {e.description && <p className="text-sm line-clamp-2">{e.description}</p>}
          <p className="text-sm font-semibold mt-auto">{n.all === 0 ? "No listings yet. Be the first." : `${n.all} ${n.all === 1 ? "listing" : "listings"}`}</p>
        </Card>
      </Link>
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
