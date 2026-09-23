import { randomUUID } from "node:crypto";
import { makeCanvas, type Surface } from "@patched/ai";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const SURFACES: Surface[] = ["outfit", "car", "hoodie"];

/** Photo → clean white canvas. Body: { imageUrl, surface }. Returns { canvasUrl }. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();
  const { imageUrl, surface } = (await req.json()) as { imageUrl?: string; surface?: Surface };
  if (!imageUrl?.startsWith(process.env.NEXT_PUBLIC_SUPABASE_URL!) || !surface || !SURFACES.includes(surface)) {
    return Response.json({ error: "Upload a photo first." }, { status: 400 });
  }
  if (!allow(`canvas:${user.wallet}`, 6)) {
    return Response.json({ error: "You've made 6 canvases today. Try again tomorrow." }, { status: 429 });
  }

  try {
    const { image, model } = await makeCanvas(imageUrl, surface);
    const m = image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!m) throw new Error("unexpected image format");
    const bytes = Buffer.from(m[2], "base64");
    const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
    const path = `${user.wallet}/${randomUUID()}.${ext}`;
    const db = supabaseAdmin();
    const { error } = await db.storage.from("canvases").upload(path, bytes, { contentType: m[1] });
    if (error) throw error;
    return Response.json({ canvasUrl: db.storage.from("canvases").getPublicUrl(path).data.publicUrl, model });
  } catch (err) {
    console.error("canvas failed", err);
    return Response.json({ error: "The AI couldn't make a canvas from this photo. Try a clearer, well-lit photo." }, { status: 502 });
  }
}
