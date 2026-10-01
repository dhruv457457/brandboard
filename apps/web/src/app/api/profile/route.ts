import { after } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { lookupX } from "@/lib/server/xLookup";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { handleProblem } from "@/lib/handles";

export const runtime = "nodejs";

const FIELDS = "id, wallet, handle, display_name, x_handle, x_verified, x_followers, avatar_url, banner_color, bio, brand_name, brand_logo_url, brand_website, brand_verified_domain, is_admin";
/** Read every column (so a column a pending migration adds can't break sign-in) and return only these. */
const pick = (row: Record<string, unknown> | null) => row && Object.fromEntries(FIELDS.split(", ").map((k) => [k, row[k] ?? null]));
const DAY = 86_400_000;

/** Refresh the follower count from X (at most once a day), after the response is sent. */
function syncFollowers(did: string, xHandle: string | null, syncedAt: string | null) {
  if (!xHandle || (syncedAt && Date.now() - new Date(syncedAt).getTime() < DAY)) return;
  after(async () => {
    try {
      const x = await lookupX(xHandle);
      if (x) await supabaseAdmin().from("profiles").update({ x_followers: x.followers, x_synced_at: new Date().toISOString() }).eq("privy_did", did);
    } catch (err) {
      console.warn("x follower sync failed", err instanceof Error ? err.message : err);
    }
  });
}

/** The signed-in user's profile, created on first call from their Privy account (wallet + X handle). */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const db = supabaseAdmin();
  const { data: existing } = await db.from("profiles").select("*").eq("privy_did", user.did).maybeSingle();
  if (existing) {
    // Keep wallet and X link in sync with Privy (e.g. user linked X later).
    const patch: Record<string, unknown> = {};
    if (user.wallet && existing.wallet !== user.wallet) patch.wallet = user.wallet;
    if (user.xHandle && existing.x_handle !== user.xHandle) Object.assign(patch, { x_handle: user.xHandle, x_verified: true });
    // The X profile picture follows X; the X name only fills a name the person hasn't set themselves.
    if (user.xAvatar && existing.avatar_url !== user.xAvatar) patch.avatar_url = user.xAvatar;
    if (user.xName && (!existing.display_name || existing.display_name === existing.x_handle)) patch.display_name = user.xName;
    syncFollowers(user.did, user.xHandle, existing.x_synced_at);
    if (Object.keys(patch).length) {
      const { data } = await db.from("profiles").update(patch).eq("privy_did", user.did).select("*").single();
      return Response.json(pick(data));
    }
    return Response.json(pick(existing));
  }
  const handle = await freeHandle(user.xHandle?.toLowerCase() ?? null);
  const { data, error } = await db
    .from("profiles")
    .insert({
      privy_did: user.did,
      wallet: user.wallet,
      handle,
      display_name: user.xName ?? user.xHandle ?? null,
      avatar_url: user.xAvatar,
      x_handle: user.xHandle,
      x_verified: Boolean(user.xHandle),
    })
    .select("*")
    .single();
  if (error) return Response.json({ error: "Couldn't create your profile." }, { status: 500 });
  syncFollowers(user.did, user.xHandle, null);
  return Response.json(pick(data));
}

/** Update your own profile. Body: any of displayName, handle, bio, bannerColor, brandName, brandLogoUrl, brandWebsite. */
export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  const text = (v: unknown, max: number) => (v == null ? null : String(v).trim().slice(0, max) || null);

  if ("displayName" in body) patch.display_name = text(body.displayName, 40);
  if ("bio" in body) patch.bio = text(body.bio, 200);
  if ("bannerColor" in body) {
    if (body.bannerColor && !/^#[0-9a-fA-F]{6}$/.test(body.bannerColor)) return bad("Pick a valid color.");
    patch.banner_color = body.bannerColor;
  }
  if ("brandName" in body) patch.brand_name = text(body.brandName, 31);
  if ("brandWebsite" in body) {
    const w = text(body.brandWebsite, 120);
    if (w && !/^https:\/\/[^\s]+$/.test(w)) return bad("The website has to start with https://");
    patch.brand_website = w;
    // A new website needs a new check: the badge only covers the domain that was verified.
    const { data: current } = await supabaseAdmin().from("profiles").select("brand_website").eq("privy_did", user.did).maybeSingle();
    if ((current?.brand_website ?? null) !== w) patch.brand_verified_domain = null;
  }
  if ("brandLogoUrl" in body) {
    const u = body.brandLogoUrl;
    if (u && !u.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) return bad("Upload the logo first.");
    patch.brand_logo_url = u || null;
  }
  if ("handle" in body) {
    const h = String(body.handle ?? "").trim().toLowerCase();
    const problem = handleProblem(h);
    if (problem) return bad(problem);
    patch.handle = h;
  }

  if (Object.keys(patch).length === 0) return bad("Nothing to save.");
  const { data, error } = await supabaseAdmin().from("profiles").update(patch).eq("privy_did", user.did).select("*").single();
  if (error) {
    if (error.code === "23505") return bad("That handle is taken.");
    return Response.json({ error: "Couldn't save your profile." }, { status: 500 });
  }
  // Profile pages are cached; show the change right away.
  if (data.handle) revalidatePath(`/${data.handle}`);
  if (data.wallet) revalidatePath(`/${data.wallet}`);
  return Response.json(pick(data));
}

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}

async function freeHandle(preferred: string | null): Promise<string | null> {
  if (!preferred || handleProblem(preferred)) return null;
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("handle", preferred).maybeSingle();
  return data ? null : preferred;
}
