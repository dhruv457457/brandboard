// Make the images for a listing from a real photo, the same way Studio does: a front and back full-body shot in a
// plain white outfit (AI, on a green screen, cut out), stored in our canvases bucket, plus AI-suggested logo spots on
// each view. Prints JSON for onchain-cycle.mts.
//   PHOTO=path/to/photo.jpg STYLE=blazer OWNER=0x... SPOTS=3 npx tsx scripts/model-shots.mts > shots.json
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { makeModelShot, suggestLayout } from "@patched/ai";
import { cutoutGreen } from "@patched/ai/cutout";

for (const line of readFileSync("../../.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const PHOTO = process.env.PHOTO!;
const STYLE = process.env.STYLE ?? "tee";
const OWNER = (process.env.OWNER ?? "").toLowerCase();
const SPOTS = Number(process.env.SPOTS ?? 3);
if (!PHOTO || !OWNER) throw new Error("set PHOTO and OWNER");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const log = (...a: unknown[]) => console.error(...a);

async function store(data: Buffer, contentType: string): Promise<string> {
  const ext = contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  const path = `${OWNER}/${randomUUID()}.${ext}`;
  const { error } = await db.storage.from("canvases").upload(path, data, { contentType });
  if (error) throw error;
  return db.storage.from("canvases").getPublicUrl(path).data.publicUrl;
}

// The source photo goes to our storage first, as an upload in Studio would.
const ext = PHOTO.toLowerCase().endsWith(".png") ? "png" : "jpeg";
const photoUrl = await store(readFileSync(PHOTO), `image/${ext}`);
log("photo", photoUrl);

async function shot(side: "front" | "back", front?: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { image, model } = await makeModelShot({ photo: photoUrl, style: STYLE, side, front });
      const cut = await cutoutGreen(image);
      const url = await store(cut.data, cut.contentType);
      log(side, model, cut.cut ? "cut out" : "not cut", url);
      return url;
    } catch (err) {
      log(`${side} attempt ${attempt} failed:`, (err as Error).message);
    }
  }
  throw new Error(`${side} shot failed`);
}

const front = await shot("front");
const back = await shot("back", front);
const frontSpots = await suggestLayout(front, "outfit", Math.max(1, SPOTS - 1), "front");
const backSpots = await suggestLayout(back, "outfit", 1, "back");
log("spots", frontSpots.length, "front,", backSpots.length, "back");

console.log(JSON.stringify({ photoUrl, style: STYLE, front, back, spots: [
  ...frontSpots.map((s) => ({ ...s, side: "front" })),
  ...backSpots.map((s) => ({ ...s, side: "back" })),
] }, null, 2));
