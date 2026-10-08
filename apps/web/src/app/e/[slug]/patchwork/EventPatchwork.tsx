"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const Patchwork = dynamic(() => import("@/components/graph/Patchwork").then((m) => m.Patchwork), {
  ssr: false,
  loading: () => <div className="min-h-dvh grid place-items-center text-[var(--muted)] font-semibold">Loading the graph…</div>,
});

/** An event's Patchwork on its own page: open to anyone, no sign-in, and the link people share. */
export function EventPatchwork({ eventId, slug }: { eventId: number; slug: string }) {
  const router = useRouter();
  return (
    <Patchwork
      eventId={eventId}
      onEvent={(id) => router.push(id === 0 ? "/?view=patchwork&event=0" : `/e/${id}/patchwork`)}
      lead={
        <Link href={`/e/${slug}`} className="btn-base btn-small" aria-label="Back to the event">
          <ArrowLeft size={15} /> Event
        </Link>
      }
    />
  );
}
