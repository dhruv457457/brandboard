import { notFound } from "next/navigation";
import { isAddress } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { MARKET, serverClient } from "@/lib/config";
import { fetchListingCards } from "@/lib/market/server";
import { toWire } from "@/lib/market/types";
import { supabase } from "@/lib/supabase";
import { ProfileView, type PublicProfile } from "./ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();
  const db = supabase();
  const { data: profile } = isAddress(handle)
    ? await db.from("profiles").select("*").eq("wallet", handle).maybeSingle()
    : await db.from("profiles").select("*").eq("handle", handle).maybeSingle();

  const wallet = (profile?.wallet ?? (isAddress(handle) ? handle : null)) as `0x${string}` | null;
  if (!wallet) notFound();

  const [cards, rep] = await Promise.all([
    fetchListingCards({ creator: wallet, statuses: [1, 2, 3, 4] }),
    serverClient().readContract({ address: MARKET, abi: patchedMarketAbi, functionName: "reputation", args: [wallet] }),
  ]);
  const [completed, failed, earned] = rep;

  const view: PublicProfile = {
    wallet,
    handle: profile?.handle ?? null,
    displayName: profile?.display_name ?? null,
    xHandle: profile?.x_handle ?? null,
    xVerified: Boolean(profile?.x_verified),
    bio: profile?.bio ?? null,
    bannerColor: profile?.banner_color ?? "#FF5A1F",
    completed,
    failed,
    earned: earned.toString(),
  };
  return <ProfileView profile={view} cards={toWire(cards)} />;
}
