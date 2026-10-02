import "server-only";
import { supabaseAdmin } from "@/lib/supabase";

export const KINDS = ["flame", "zap", "heart"] as const;
export type Kind = (typeof KINDS)[number];
export type ReactionCounts = Record<Kind, number>;

/** Counts per kind, and which kinds `me` has used, for some posts. */
export async function reactionsFor(ids: string[], me: string | null): Promise<Record<string, { counts: ReactionCounts; mine: Kind[] }>> {
  const out: Record<string, { counts: ReactionCounts; mine: Kind[] }> = {};
  for (const id of ids) out[id] = { counts: { flame: 0, zap: 0, heart: 0 }, mine: [] };
  if (!ids.length) return out;
  const { data } = await supabaseAdmin().from("reactions").select("wallet, target_id, kind").eq("target_kind", "post").in("target_id", ids).limit(5000);
  for (const r of data ?? []) {
    const o = out[r.target_id];
    if (!o || !KINDS.includes(r.kind)) continue;
    o.counts[r.kind as Kind]++;
    if (me && r.wallet === me) o.mine.push(r.kind as Kind);
  }
  return out;
}
