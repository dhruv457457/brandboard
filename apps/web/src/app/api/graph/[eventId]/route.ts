import { fetchEventGraph } from "@/lib/graph/server";

export const runtime = "nodejs";

/** One event's graph. eventId 0 is "On the road" (cars have no event). */
export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!/^\d{1,9}$/.test(eventId)) return Response.json({ error: "No such event." }, { status: 400 });
  const graph = await fetchEventGraph(Number(eventId));
  if (!graph) return Response.json({ error: "No such event." }, { status: 404 });
  return Response.json(graph, { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=60" } });
}
