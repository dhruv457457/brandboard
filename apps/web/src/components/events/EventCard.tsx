import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EventCover, EventMark } from "@/components/events/EventCover";
import { eventDates } from "@/lib/events";

export interface EventCardData {
  id: number;
  name: string;
  slug: string | null;
  startsAt: string;
  endsAt: string;
  city: string | null;
  venue: string | null;
  banner: string | null;
  description: string | null;
  /** Listings taking bids now, and all listings for the event. */
  live: number;
  listings: number;
}

/** One event on the Events list. `preview` draws the same card without a link (the admin form's live preview). */
export function EventCard({ event: e, preview = false }: { event: EventCardData; preview?: boolean }) {
  const place = [e.venue, e.city].filter(Boolean).join(", ");
  const card = (
    <Card className="!p-0 overflow-hidden grid h-full hover:bg-[var(--soft)]">
      <EventCover name={e.name} banner={e.banner} seed={e.id} variant="card" />
      <div className="px-5 pb-5 grid gap-2 content-start">
        <div className="flex items-end justify-between gap-2 -mt-8">
          <EventMark name={e.name} seed={e.id} size={52} />
          {e.live > 0 && <Chip variant="green" className="mb-0.5">{e.live} live</Chip>}
        </div>
        <h3 className="text-xl font-extrabold leading-tight">{e.name || "Your event"}</h3>
        <p className="text-sm text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {e.startsAt && e.endsAt ? eventDates(e.startsAt, e.endsAt) : "Pick the dates"}</span>
          {place && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {place}</span>}
        </p>
        {e.description && <p className="text-sm line-clamp-2">{e.description}</p>}
        <p className="text-sm font-semibold mt-auto">
          {e.listings === 0 ? "No listings yet. Be the first." : `${e.listings} ${e.listings === 1 ? "listing" : "listings"}`}
        </p>
      </div>
    </Card>
  );
  return preview ? <div>{card}</div> : <Link href={`/e/${e.slug ?? e.id}`} className="no-underline">{card}</Link>;
}
