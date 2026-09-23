import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const FIELDS = "id, wallet, handle, display_name, x_handle, x_verified, avatar_url, banner_color, bio, brand_name, brand_logo_url, brand_website, is_admin";

/** The signed-in user's profile, created on first call from their Privy account (wallet + X handle). */
export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const db = supabaseAdmin();
  const { data: existing } = await db.from("profiles").select(FIELDS).eq("privy_did", user.did).maybeSingle();
  if (existing) {
    // Keep wallet and X link in sync with Privy (e.g. user linked X later).
    const patch: Record<string, unknown> = {};
    if (user.wallet && existing.wallet !== user.wallet) patch.wallet = user.wallet;
    if (user.xHandle && existing.x_handle !== user.xHandle) Object.assign(patch, { x_handle: user.xHandle, x_verified: true });
    if (Object.keys(patch).length) {
      const { data } = await db.from("profiles").update(patch).eq("privy_did", user.did).select(FIELDS).single();
      return Response.json(data);
    }
    return Response.json(existing);
  }
  const handle = await freeHandle(user.xHandle?.toLowerCase() ?? null);
  const { data, error } = await db
    .from("profiles")
    .insert({
      privy_did: user.did,
      wallet: user.wallet,
      handle,
      display_name: user.xHandle ?? null,
      x_handle: user.xHandle,
      x_verified: Boolean(user.xHandle),
    })
    .select(FIELDS)
    .single();
  if (error) return Response.json({ error: "Couldn't create your profile." }, { status: 500 });
  return Response.json(data);
}

/** Update your own profile. Body: any of displayName, handle, bio, bannerColor, brandName, brandLogoUrl, brandWebsite. */
export async function PATCH(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const body = (await req.json()) as Record<string, string | null | undefined>;
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
  }
  if ("brandLogoUrl" in body) {
    const u = body.brandLogoUrl;
    if (u && !u.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) return bad("Upload the logo first.");
    patch.brand_logo_url = u || null;
  }
  if ("handle" in body) {
    const h = String(body.handle ?? "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,30}$/.test(h)) return bad("Handles are 2–31 characters: letters, numbers, dots, dashes or underscores.");
    if (/^0x[0-9a-f]{40}$/.test(h)) return bad("That handle isn't allowed.");
    patch.handle = h;
  }

  const { data, error } = await supabaseAdmin().from("profiles").update(patch).eq("privy_did", user.did).select(FIELDS).single();
  if (error) {
    if (error.code === "23505") return bad("That handle is taken.");
    return Response.json({ error: "Couldn't save your profile." }, { status: 500 });
  }
  return Response.json(data);
}

function bad(error: string) {
  return Response.json({ error }, { status: 400 });
}

async function freeHandle(preferred: string | null): Promise<string | null> {
  if (!preferred || !/^[a-z0-9][a-z0-9._-]{1,30}$/.test(preferred)) return null;
  const { data } = await supabaseAdmin().from("profiles").select("id").eq("handle", preferred).maybeSingle();
  return data ? null : preferred;
}
