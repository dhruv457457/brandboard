import { randomUUID } from "node:crypto";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKETS = {
  canvases: { max: 10 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
  logos: { max: 2 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
  proofs: { max: 10 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp", "application/pdf"] },
  avatars: { max: 2 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
} as const;
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg", "application/pdf": "pdf",
};

/** Upload one file for the signed-in user. Body: multipart form with `file` and `bucket`. */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user?.wallet) return unauthorized();

  const form = await req.formData();
  const file = form.get("file");
  const bucket = String(form.get("bucket")) as keyof typeof BUCKETS;
  const rules = BUCKETS[bucket];
  if (!rules) return Response.json({ error: "Unknown upload type." }, { status: 400 });
  if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (!(rules.types as readonly string[]).includes(file.type)) {
    return Response.json({ error: "That file type isn't supported here." }, { status: 400 });
  }
  if (file.size > rules.max) {
    return Response.json({ error: `File is too large (max ${rules.max / 1024 / 1024} MB).` }, { status: 400 });
  }

  const path = `${user.wallet}/${randomUUID()}.${EXT[file.type]}`;
  const db = supabaseAdmin();
  const { error } = await db.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (error) return Response.json({ error: "Upload failed. Try again." }, { status: 500 });
  const { data } = db.storage.from(bucket).getPublicUrl(path);
  return Response.json({ url: data.publicUrl });
}
