import { CAR_VIEWS, describeCar, makeCarView, type CarView } from "@patched/ai";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { storeCutout } from "@/lib/server/storeImage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * One view of a creator's car, wrapped in white and cut out. Body: { photoUrl, view, description?, referenceUrl? }.
 * The first call (no description) also describes the car and returns that description; the Studio sends it back
 * with the other views so every view shows the same car.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const { photoUrl, view, description, referenceUrl } = (await req.json()) as {
    photoUrl?: string; view?: string; description?: string; referenceUrl?: string;
  };
  const ours = (u?: string) => Boolean(u?.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!));
  if (!ours(photoUrl) || !view || !(view in CAR_VIEWS) || (referenceUrl && !ours(referenceUrl))) {
    return Response.json({ error: "Upload a photo of your car first." }, { status: 400 });
  }
  // 5 views per car, so allow a few cars (or re-rolls) a day without burning the AI budget.
  if (!allow(`carviews:${user.wallet}`, 16)) {
    return Response.json({ error: "You've generated a lot of car views today. Try again tomorrow." }, { status: 429 });
  }
  try {
    const desc = description?.trim().slice(0, 900) || (await describeCar(photoUrl!));
    const { image } = await makeCarView({ photo: photoUrl!, description: desc, view: view as CarView, reference: referenceUrl });
    const { url, cut } = await storeCutout(image, user.wallet);
    return Response.json({ url, description: desc, cut });
  } catch (err) {
    console.error("car view failed", err);
    return Response.json({ error: "The AI couldn't draw this view. Try again, or use a clearer photo of the car." }, { status: 502 });
  }
}
