import "server-only";
import { CHAIN_ID } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase";

export interface ModItem {
  kind: "listing" | "post";
  id: string;
  title: string;
  subtitle: string;
  href: string | null;
  photo: string | null;
  /** Open reports on it: how many people, why, and what they wrote. */
  reports: number;
  reasons: string[];
  notes: string[];
  hidden: boolean;
}

/** What the admin's Reports section shows: open reports grouped by what was reported, then what is hidden. */
export async function fetchModeration(): Promise<{ reported: ModItem[]; hidden: ModItem[] }> {
  const db = supabaseAdmin();
  const [{ data: open }, { data: hiddenRows }, { data: hiddenPosts }] = await Promise.all([
    db.from("reports").select("target_kind, target_id, reason, note, created_at").eq("chain_id", CHAIN_ID).is("resolved_at", null).order("created_at", { ascending: false }).limit(300),
    db.from("hidden_listings").select("listing_id").eq("chain_id", CHAIN_ID).order("hidden_at", { ascending: false }).limit(30),
    db.from("posts").select("id").eq("chain_id", CHAIN_ID).eq("hidden", true).not("spotted_wallet", "is", null).order("created_at", { ascending: false }).limit(30),
  ]);

  const grouped = new Map<string, { kind: "listing" | "post"; id: string; reasons: string[]; notes: string[]; count: number }>();
  for (const r of open ?? []) {
    const key = `${r.target_kind}:${r.target_id}`;
    const g = grouped.get(key) ?? { kind: r.target_kind as "listing" | "post", id: r.target_id as string, reasons: [], notes: [], count: 0 };
    g.count++;
    if (!g.reasons.includes(r.reason)) g.reasons.push(r.reason);
    if (r.note) g.notes.push(r.note);
    grouped.set(key, g);
  }

  const listingIds = [...new Set([
    ...[...grouped.values()].filter((g) => g.kind === "listing").map((g) => Number(g.id)),
    ...(hiddenRows ?? []).map((h) => Number(h.listing_id)),
  ])];
  const postIds = [...new Set([...[...grouped.values()].filter((g) => g.kind === "post").map((g) => g.id), ...(hiddenPosts ?? []).map((p) => p.id as string)])];

  const [{ data: listings }, { data: posts }] = await Promise.all([
    listingIds.length ? db.from("listings").select("listing_id, creator, metadata_hash").eq("chain_id", CHAIN_ID).in("listing_id", listingIds) : Promise.resolve({ data: [] as { listing_id: number; creator: string; metadata_hash: string }[] }),
    postIds.length ? db.from("posts").select("id, body, media, author, listing_id").in("id", postIds) : Promise.resolve({ data: [] as { id: string; body: string; media: unknown; author: string; listing_id: number | null }[] }),
  ]);
  const hashes = (listings ?? []).map((l) => l.metadata_hash);
  const creators = [...new Set((listings ?? []).map((l) => l.creator))];
  const authors = [...new Set((posts ?? []).map((p) => p.author))];
  const [{ data: metas }, { data: byWallet }, { data: byId }] = await Promise.all([
    hashes.length ? db.from("listing_metadata").select("metadata_hash, metadata").in("metadata_hash", hashes) : Promise.resolve({ data: [] as { metadata_hash: string; metadata: { title?: string } }[] }),
    creators.length ? db.from("profiles").select("wallet, handle, display_name").in("wallet", creators) : Promise.resolve({ data: [] as { wallet: string; handle: string | null; display_name: string | null }[] }),
    authors.length ? db.from("profiles").select("id, handle, display_name").in("id", authors) : Promise.resolve({ data: [] as { id: string; handle: string | null; display_name: string | null }[] }),
  ]);
  const title = new Map((metas ?? []).map((m) => [m.metadata_hash, (m.metadata as { title?: string } | null)?.title ?? ""]));
  const person = new Map((byWallet ?? []).map((p) => [p.wallet, p]));
  const authorOf = new Map((byId ?? []).map((p) => [p.id, p]));
  const listingMap = new Map((listings ?? []).map((l) => [String(l.listing_id), l]));
  const postMap = new Map((posts ?? []).map((p) => [p.id, p]));

  const item = (kind: "listing" | "post", id: string, hidden: boolean, g?: { reasons: string[]; notes: string[]; count: number }): ModItem => {
    const base = { kind, id, hidden, reports: g?.count ?? 0, reasons: g?.reasons ?? [], notes: (g?.notes ?? []).slice(0, 3) };
    if (kind === "listing") {
      const l = listingMap.get(id);
      const p = l ? person.get(l.creator) : undefined;
      const who = p?.handle ? `@${p.handle}` : p?.display_name ?? (l ? l.creator.slice(0, 8) : "unknown");
      return { ...base, title: (l && title.get(l.metadata_hash)) || `Listing #${id}`, subtitle: `Listing #${id} by ${who}`, href: l ? `/${p?.handle ?? l.creator}/${id}` : null, photo: null };
    }
    const post = postMap.get(id);
    const a = post ? authorOf.get(post.author) : undefined;
    const photo = (post?.media as { url?: string }[] | null)?.[0]?.url ?? null;
    return { ...base, title: post && post.body !== "Spotted" ? post.body.slice(0, 80) : "Spotted photo", subtitle: `Photo by ${a?.handle ? `@${a.handle}` : a?.display_name ?? "someone"}`, href: null, photo };
  };

  const reported = [...grouped.values()].sort((a, b) => b.count - a.count).map((g) => item(g.kind, g.id, false, g));
  const hidden = [
    ...(hiddenRows ?? []).map((h) => item("listing", String(h.listing_id), true)),
    ...(hiddenPosts ?? []).map((p) => item("post", p.id as string, true)),
  ];
  return { reported, hidden };
}
