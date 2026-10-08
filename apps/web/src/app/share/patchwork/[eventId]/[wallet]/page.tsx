import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchEventGraph } from "@/lib/graph/server";
import { standing } from "@/lib/graph/standing";
import { ToPatchwork } from "./ToPatchwork";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ eventId: string; wallet: string }> };

const valid = (eventId: string, wallet: string) => /^\d{1,9}$/.test(eventId) && /^0x[0-9a-fA-F]{40}$/.test(wallet);

/** The link in a "Post my spot" tweet: its preview is the share card; people who click it land in the graph. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { eventId, wallet } = await params;
  if (!valid(eventId, wallet)) return { title: "Patchwork" };
  const g = await fetchEventGraph(Number(eventId)).catch(() => null);
  if (!g) return { title: "Patchwork" };
  const s = standing(g, wallet);
  const title = s ? `${s.me.name} is in the ${g.event.name} patchwork` : `Join the ${g.event.name} patchwork`;
  const description = s
    ? `#${s.rank} most connected with ${s.degree} threads. Every bid, spot and payout is on Monad.`
    : `${g.stats.creators} creators, ${g.stats.spots} spots, ${g.stats.brands} brands: the live on-chain graph of ${g.event.name}.`;
  const image = `/share/patchwork/${eventId}/${wallet.toLowerCase()}/card.png`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharePatchworkPage({ params }: Params) {
  const { eventId, wallet } = await params;
  if (!valid(eventId, wallet)) notFound();
  const g = await fetchEventGraph(Number(eventId)).catch(() => null);
  if (!g) notFound();
  // The event page works for visitors who are not signed in; Home would show them the landing page instead.
  const to = eventId === "0" ? "/?view=patchwork&event=0" : `/e/${eventId}/patchwork`;
  return (
    <main className="min-h-dvh grid place-items-center p-6 gap-4 content-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/share/patchwork/${eventId}/${wallet.toLowerCase()}/card.png`} alt={`${g.event.name} patchwork`} width={1200} height={630} className="w-full max-w-[720px] h-auto rounded-2xl border-2 border-[var(--ink)] shadow-[4px_4px_0_var(--shadow)]" />
      <ToPatchwork to={to} />
    </main>
  );
}
