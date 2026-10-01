import "server-only";

export interface XAccount {
  /** Numeric X user id: Privy links an X account by this, not by the handle. */
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  followers: number | null;
}

/** "@Dhruv", "dhruv", "https://x.com/dhruv/status/1" -> "dhruv"; null if it can't be an X handle. */
export function normalizeHandle(input: string): string | null {
  let s = input.trim();
  const url = s.match(/^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([^/?#\s]+)/i);
  if (url) s = url[1];
  s = s.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(s) ? s : null;
}

/**
 * Look up an X account by handle. Uses the official X API when X_BEARER_TOKEN is set, otherwise the free public
 * FxTwitter API (api.fxtwitter.com). Returns null when the account doesn't exist; throws when the lookup failed.
 */
export async function lookupX(handle: string): Promise<XAccount | null> {
  const h = normalizeHandle(handle);
  if (!h) return null;
  const token = process.env.X_BEARER_TOKEN;
  if (token) {
    const res = await fetch(`https://api.x.com/2/users/by/username/${h}?user.fields=profile_image_url,public_metrics`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null;
    const json = (await res.json().catch(() => ({}))) as {
      data?: { id: string; username: string; name: string; profile_image_url?: string; public_metrics?: { followers_count?: number } };
      errors?: { title?: string }[];
    };
    if (!json.data) {
      if (json.errors?.some((e) => /not found/i.test(e.title ?? ""))) return null;
      throw new Error(`X lookup failed (${res.status})`);
    }
    const d = json.data;
    return { id: d.id, username: d.username, name: d.name, avatar: d.profile_image_url ?? null, followers: d.public_metrics?.followers_count ?? null };
  }

  const res = await fetch(`https://api.fxtwitter.com/${h}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (res.status === 404) return null;
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    user?: { id?: string; screen_name?: string; name?: string; avatar_url?: string; followers?: number };
  };
  if (json.code === 404) return null;
  const u = json.user;
  if (!res.ok || !u?.id || !/^\d+$/.test(String(u.id))) throw new Error(`X lookup failed (${res.status})`);
  return { id: String(u.id), username: u.screen_name ?? h, name: u.name ?? h, avatar: u.avatar_url ?? null, followers: u.followers ?? null };
}
