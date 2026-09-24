import { keccak256, stringToBytes } from "viem";
import type { ListingMetadata } from "@patched/shared";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const SURFACES = ["outfit", "car", "hoodie"] as const;
/** View ids a listing may use, with their labels. */
const VIEW_LABELS: Record<string, string> = { front: "Front", back: "Back", left: "Left side", right: "Right side", roof: "Roof" };
const num = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v) * 10) / 10;
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("bad number");
  return n;
};

/**
 * Store the off-chain listing JSON before createListing. The contract stores keccak256 of this exact
 * JSON string, and the indexer joins the two by that hash. Keys are built in a fixed order so the
 * hash is reproducible (docs/data-model.md).
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();

  let metadata: ListingMetadata;
  try {
    const body = (await req.json()) as ListingMetadata;
    if (!SURFACES.includes(body.surface)) throw new Error("surface");
    const title = String(body.title ?? "").trim().slice(0, 80);
    if (!title) throw new Error("title");
    if (!Array.isArray(body.patches) || body.patches.length < 1 || body.patches.length > 16) throw new Error("patches");
    if (!Array.isArray(body.milestones) || body.milestones.length < 1 || body.milestones.length > 8) throw new Error("milestones");
    const supa = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const img = (u?: string) => (u && u.startsWith(supa) ? u : undefined);
    // Views: known ids only, each once, images from our own storage.
    const views = (Array.isArray(body.views) ? body.views : [])
      .filter((v, i, all) => v && VIEW_LABELS[v.id] && img(v.image) && all.findIndex((x) => x?.id === v.id) === i)
      .slice(0, 5)
      .map((v) => ({ id: v.id, label: VIEW_LABELS[v.id], image: img(v.image)! }));
    const viewIds = views.length ? views.map((v) => v.id) : ["front", "back"];
    metadata = {
      version: 1,
      title,
      surface: body.surface,
      ...(body.eventSlug ? { eventSlug: String(body.eventSlug).slice(0, 64) } : {}),
      ...(img(body.sourceImage) ? { sourceImage: img(body.sourceImage) } : {}),
      ...(img(body.canvasImage) ? { canvasImage: img(body.canvasImage) } : {}),
      ...(img(body.canvasImageBack) ? { canvasImageBack: img(body.canvasImageBack) } : {}),
      ...(views.length ? { views } : {}),
      ...(body.style ? { style: String(body.style).slice(0, 900) } : {}),
      patches: body.patches.map((p, i) => ({
        id: i,
        name: String(p.name ?? "").trim().slice(0, 31) || `Patch ${i + 1}`,
        side: p.side && viewIds.includes(p.side) ? p.side : viewIds[0],
        x: num(p.x, 0, 100), y: num(p.y, 0, 100), w: num(p.w, 1, 100), h: num(p.h, 1, 100),
        rotation: num(p.rotation ?? 0, -45, 45),
      })),
      milestones: body.milestones.map((m) => ({ name: String(m.name ?? "").slice(0, 40), bps: Math.round(Number(m.bps)) })),
    };
    if (metadata.milestones.reduce((s, m) => s + m.bps, 0) !== 10_000) throw new Error("bps");
  } catch {
    return Response.json({ error: "Some listing details are invalid. Check the title, patches and payout plan." }, { status: 400 });
  }

  const json = JSON.stringify(metadata);
  const metadataHash = keccak256(stringToBytes(json));
  const { error } = await supabaseAdmin()
    .from("listing_metadata")
    .upsert({ metadata_hash: metadataHash, creator: user.wallet, metadata }, { onConflict: "metadata_hash" });
  if (error) return Response.json({ error: "Couldn't save the listing details. Try again." }, { status: 500 });

  return Response.json({ metadataHash, metadataURI: `patched://metadata/${metadataHash}` });
}
