import { makeModelShot } from "@patched/ai";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { storeDataUrl } from "@/lib/server/storeImage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Generate one full-body shot. Body: { photoUrl, style, side: "front" | "back", frontUrl? }.
 * The front costs one generation from the daily budget; the matching back view is included.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const { photoUrl, style, side, frontUrl } = (await req.json()) as {
    photoUrl?: string; style?: string; side?: "front" | "back"; frontUrl?: string;
  };
  const ours = (u?: string) => Boolean(u?.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!));
  if (!ours(photoUrl) || !style || (side !== "front" && side !== "back") || (side === "back" && !ours(frontUrl))) {
    return Response.json({ error: "Upload a photo and pick a style first." }, { status: 400 });
  }
  if (side === "front" && !allow(`shots:${user.wallet}`, 3)) {
    return Response.json({ error: "You've generated 3 outfits today. Try again tomorrow." }, { status: 429 });
  }
  try {
    const { image } = await makeModelShot({ photo: photoUrl!, style, side, front: frontUrl });
    return Response.json({ url: await storeDataUrl(image, user.wallet) });
  } catch (err) {
    console.error("model shot failed", err);
    return Response.json({ error: "The AI couldn't create this shot. Try a clearer photo of your face." }, { status: 502 });
  }
}
