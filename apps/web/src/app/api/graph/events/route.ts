import { fetchGraphEvents } from "@/lib/graph/server";

export const runtime = "nodejs";

/** Events that have a Patchwork to show. */
export async function GET() {
  const events = await fetchGraphEvents();
  return Response.json({ events }, { headers: { "cache-control": "public, s-maxage=30, stale-while-revalidate=120" } });
}
