import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

/** Save a data: URL image returned by an AI model into the canvases bucket; returns its public URL. */
export async function storeDataUrl(dataUrl: string, wallet: string): Promise<string> {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("unexpected image format");
  const ext = m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
  const path = `${wallet}/${randomUUID()}.${ext}`;
  const db = supabaseAdmin();
  const { error } = await db.storage.from("canvases").upload(path, Buffer.from(m[2], "base64"), { contentType: m[1] });
  if (error) throw error;
  return db.storage.from("canvases").getPublicUrl(path).data.publicUrl;
}

/**
 * Cut the green screen out of an AI image (see @patched/ai/cutout) and store it as a transparent WebP.
 * If the model didn't produce a green screen, the original image is stored unchanged.
 */
export async function storeCutout(dataUrl: string, wallet: string): Promise<{ url: string; cut: boolean }> {
  const { cutoutGreen } = await import("@patched/ai/cutout");
  const res = await cutoutGreen(dataUrl);
  const ext = res.contentType === "image/webp" ? "webp" : res.contentType === "image/png" ? "png" : "jpg";
  const path = `${wallet}/${randomUUID()}.${ext}`;
  const db = supabaseAdmin();
  const { error } = await db.storage.from("canvases").upload(path, res.data, { contentType: res.contentType });
  if (error) throw error;
  return { url: db.storage.from("canvases").getPublicUrl(path).data.publicUrl, cut: res.cut };
}
