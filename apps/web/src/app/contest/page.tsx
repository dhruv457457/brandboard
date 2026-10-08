import type { Metadata } from "next";
import { CHAIN_ID } from "@/lib/config";
import { CONTEST_EVENT_SLUG } from "@/lib/contest";
import { supabase } from "@/lib/supabase";
import { ContestView } from "./ContestView";

// The cover rarely changes; the live counters come from /api/contest.
export const revalidate = 300;

async function cover() {
  const { data } = await supabase().from("patched_events").select("banner_url").eq("chain_id", CHAIN_ID).eq("slug", CONTEST_EVENT_SLUG).maybeSingle();
  return (data?.banner_url as string | null) ?? null;
}

export async function generateMetadata(): Promise<Metadata> {
  const image = await cover();
  const title = "Get Patched Week: $30 USDC contest";
  const description = "3 days, 3 winners, $10 USDC each. Use Patched, post about it, get paid on Monad. Even with 12 followers.";
  return {
    title,
    description,
    openGraph: { title, description, ...(image ? { images: [{ url: image, width: 1800, height: 600 }] } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function ContestPage() {
  return <ContestView cover={await cover()} />;
}
