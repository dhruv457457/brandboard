import type { ReactNode } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { EventCover, EventMark } from "@/components/events/EventCover";
import { eventDates } from "@/lib/events";

/**
 * The top of an event page: the cover, the event's own patch overlapping its edge, then the name, dates and place.
 * The admin form previews this same component, so a cover is judged where it will actually be seen.
 */
export function EventHeader({
  id, name, banner, startsAt, endsAt, city, venue, badge, actions,
}: {
  id: number; name: string; banner: string | null; startsAt: number; endsAt: number;
  city: string | null; venue: string | null; badge?: ReactNode; actions?: ReactNode;
}) {
  const place = [venue, city].filter(Boolean).join(", ");
  return (
    <header>
      <EventCover name={name} banner={banner} seed={id} variant="header">
        {badge && <div className="absolute left-4 sm:left-6 top-4">{badge}</div>}
      </EventCover>
      <div className="px-4 sm:px-6">
        <EventMark name={name} seed={id} size={84} className="-mt-11 sm:-mt-12" />
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="grid gap-2 min-w-0">
            <h1 className="font-extrabold text-4xl sm:text-5xl tracking-tight [overflow-wrap:anywhere]">{name || "Your event"}</h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> {startsAt && endsAt ? eventDates(startsAt, endsAt) : "Pick the dates"}</span>
              {place && <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {place}</span>}
            </p>
          </div>
          {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
        </div>
      </div>
    </header>
  );
}
