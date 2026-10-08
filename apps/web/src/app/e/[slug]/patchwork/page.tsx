import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAIN_ID } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { EventPatchwork } from "./EventPatchwork";

export const revalidate = 60;
/** No pages at build time: each one is rendered on its first visit, then cached. */
export async function generateStaticParams() {
  return [];
}

async function findEvent(slug: string) {
  const q = supabase().from("patched_events").select("event_id, name, slug").eq("chain_id", CHAIN_ID);
  const { data } = /^\d+$/.test(slug) ? await q.eq("event_id", Number(slug)).maybeSingle() : await q.eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = await findEvent((await params).slug);
  return { title: event ? `${event.name} patchwork` : "Patchwork" };
}

/** The live on-chain graph of one event: /e/<slug>/patchwork. */
export default async function EventPatchworkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await findEvent(slug);
  if (!event) notFound();
  return <EventPatchwork eventId={event.event_id} slug={event.slug ?? String(event.event_id)} />;
}
