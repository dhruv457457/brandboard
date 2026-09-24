import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { matchingDomain, websiteDomain } from "@/lib/brandDomain";

export const runtime = "nodejs";

/**
 * Verify the signed-in brand: one of their Privy-verified emails (email login/link, or Google) must be on the
 * same domain as their brand website. Emails come from Privy's API on the server, never from the client.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("brand_website").eq("privy_did", user.did).maybeSingle();
  const site = websiteDomain(profile?.brand_website);
  if (!site) return Response.json({ error: "Add your brand website (https://…) and save it first." }, { status: 400 });
  if (!user.emails.length) return Response.json({ error: "Link your work email first.", needsEmail: true }, { status: 400 });

  const domain = user.emails.map((e) => matchingDomain(e, profile?.brand_website)).find(Boolean) ?? null;
  if (!domain) {
    return Response.json(
      { error: `None of your verified emails is on ${site}. Link an email like you@${site}.`, needsEmail: true },
      { status: 400 },
    );
  }
  const { error } = await db.from("profiles").update({ brand_verified_domain: domain }).eq("privy_did", user.did);
  if (error) return Response.json({ error: "Couldn't save the verification. Try again." }, { status: 500 });
  return Response.json({ ok: true, domain });
}
