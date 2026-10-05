import "server-only";
import { keccak256, toBytes } from "viem";
import { revalidatePath } from "next/cache";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, PLAY_MONEY, serverClient } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

export type TargetKind = "listing" | "post";
export const REASONS = ["spam", "scam", "inappropriate", "copyright", "other"] as const;
export type Reason = (typeof REASONS)[number];

/** This many different people reporting the same thing hides it until an admin looks. */
export const AUTO_HIDE_AT = 3;

const ADMIN_ROLE = keccak256(toBytes("ADMIN_ROLE"));

/** Who may hide and restore: a market admin, or anyone signed in while open admin is on (hackathon demo, play money). */
export async function canModerate(wallet: string | null | undefined): Promise<boolean> {
  if (process.env.OPEN_ADMIN === "true" && PLAY_MONEY) return true;
  if (!wallet) return false;
  return serverClient()
    .readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "hasRole", args: [ADMIN_ROLE, wallet as `0x${string}`] })
    .catch(() => false);
}

/** Take a listing or a spotted photo out of the app, and close the open reports about it. */
export async function hideTarget(kind: TargetKind, id: string, by: string, reason: string) {
  const db = supabaseAdmin();
  if (kind === "listing") {
    await db.from("hidden_listings").upsert({ chain_id: CHAIN_ID, listing_id: Number(id), reason, hidden_by: by }, { onConflict: "chain_id,listing_id" });
  } else {
    await db.from("posts").update({ hidden: true }).eq("id", id);
  }
  await db.from("reports").update({ resolved_at: new Date().toISOString(), resolution: "hidden" })
    .eq("chain_id", CHAIN_ID).eq("target_kind", kind).eq("target_id", id).is("resolved_at", null);
  refresh();
}

export async function restoreTarget(kind: TargetKind, id: string) {
  const db = supabaseAdmin();
  if (kind === "listing") await db.from("hidden_listings").delete().eq("chain_id", CHAIN_ID).eq("listing_id", Number(id));
  else await db.from("posts").update({ hidden: false }).eq("id", id);
  refresh();
}

export async function dismissReports(kind: TargetKind, id: string) {
  await supabaseAdmin().from("reports").update({ resolved_at: new Date().toISOString(), resolution: "dismissed" })
    .eq("chain_id", CHAIN_ID).eq("target_kind", kind).eq("target_id", id).is("resolved_at", null);
}

/** Pages are cached for a short while; show the change at once. */
function refresh() {
  revalidatePath("/", "layout");
}
