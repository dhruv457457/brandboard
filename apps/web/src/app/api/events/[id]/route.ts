import { keccak256, toBytes } from "viem";
import { revalidatePath } from "next/cache";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));

/**
 * Event page details (admins only, checked on-chain): slug, city, venue, description, cover image and links.
 * Body: any of { slug, city, venue, description, bannerUrl, website, x }.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized(user);
  const isAdmin = await serverClient()
    .readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, user.wallet as `0x${string}`] })
    .catch(() => false);
  if (!isAdmin) return Response.json({ error: "Only admins can edit events." }, { status: 403 });

  const id = Number((await params).id);
  const body = (await req.json()) as Record<string, string | null | undefined>;
  const text = (v: unknown, max: number) => (v == null ? null : String(v).trim().slice(0, max) || null);
  const url = (v: unknown) => {
    const u = text(v, 200);
    if (u && !/^https:\/\/[^\s]+$/.test(u)) throw new Error("Links have to start with https://");
    return u;
  };

  const patch: Record<string, unknown> = {};
  try {
    if ("slug" in body) {
      const slug = text(body.slug, 48)?.toLowerCase() ?? null;
      if (slug && !/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) throw new Error("A slug is letters, numbers and dashes.");
      patch.slug = slug;
    }
    if ("city" in body) patch.city = text(body.city, 60);
    if ("venue" in body) patch.venue = text(body.venue, 80);
    if ("description" in body) patch.description = text(body.description, 600);
    if ("bannerUrl" in body) {
      const b = text(body.bannerUrl, 400);
      if (b && !b.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) throw new Error("Upload the cover image first.");
      patch.banner_url = b;
    }
    if ("website" in body || "x" in body) patch.links = { website: url(body.website), x: url(body.x) };
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Check the details." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin().from("patched_events").update(patch)
    .eq("chain_id", CHAIN_ID).eq("event_id", id).select("event_id, slug").maybeSingle();
  if (error) return Response.json({ error: error.code === "23505" ? "That slug is taken." : "Couldn't save the event." }, { status: 400 });
  if (!data) return Response.json({ error: "No such event." }, { status: 404 });
  revalidatePath("/events");
  revalidatePath(`/e/${data.slug ?? data.event_id}`);
  return Response.json({ ok: true });
}
