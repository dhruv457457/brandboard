import { suggestStyles } from "@patched/ai";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Three outfit ideas for the person in the photo. Body: { photoUrl }. Returns { styles }. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const { photoUrl } = (await req.json()) as { photoUrl?: string };
  if (!photoUrl?.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!)) return Response.json({ styles: [] });
  if (!allow(`styles:${user.wallet}`, 10)) return Response.json({ styles: [] });
  try {
    return Response.json({ styles: await suggestStyles(photoUrl) });
  } catch (err) {
    console.error("styles failed", err);
    return Response.json({ styles: [] });
  }
}
