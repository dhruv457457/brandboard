// Cover images for events that have none. Generates a few wide illustrations per event in the Patched style (no text, no
// logos), crops them to the 3:1 cover box, and stores them in the canvases bucket. Nothing is applied until you say so.
//   npx tsx scripts/event-covers.mts                 make candidates, print their URLs
//   APPLY="2=1,3=0" npx tsx scripts/event-covers.mts apply   set event 2's cover to candidate 1 and event 3's to candidate 0
// The candidates are remembered in .event-covers.json (next to this script) between the two runs.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { makeEventCover } from "@patched/ai";

for (const line of readFileSync("../../.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const CHAIN = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const STATE = "scripts/.event-covers.json";

/** What each event looks like. Landmarks and places only: nothing here is anyone's logo. */
const SCENES: Record<number, { scene: string; mood: string }> = {
  1: { scene: "a bright hackathon hall with long tables, laptops, string lights and a stage, crowd of builders", mood: "bright and energetic" },
  2: { scene: "Buenos Aires: the white Obelisco tower on a wide avenue, colourful painted houses of La Boca, jacaranda trees, a tango dancer silhouette", mood: "warm golden afternoon" },
  3: { scene: "Singapore at dusk: the Gardens by the Bay Supertrees glowing, the Marina Bay Sands three towers with a ship-shaped roof, the harbour", mood: "dusk with soft purple and violet sky" },
  4: { scene: "Singapore waterfront in bright daylight: the Marina Bay Sands three towers with the ship-shaped skypark, the lotus-shaped ArtScience museum, the Helix bridge, a conference crowd outside", mood: "bright sunny morning" },
};

type Candidates = Record<string, string[]>;
const saved: Candidates = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};

async function store(buf: Buffer, event: number): Promise<string> {
  const path = `events/${CHAIN}-${event}-${randomUUID().slice(0, 8)}.webp`;
  const { error } = await db.storage.from("canvases").upload(path, buf, { contentType: "image/webp" });
  if (error) throw error;
  return db.storage.from("canvases").getPublicUrl(path).data.publicUrl;
}

/** 21:9 AI image to the cover's 3:1, keeping the middle band. */
async function toCover(dataUrl: string): Promise<Buffer> {
  const raw = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  const img = sharp(raw);
  const { width = 1, height = 1 } = await img.metadata();
  const cropH = Math.min(height, Math.round(width / 3));
  return sharp(raw).extract({ left: 0, top: Math.round((height - cropH) / 2), width, height: cropH }).resize({ width: 1800 }).webp({ quality: 82 }).toBuffer();
}

if (process.argv[2] === "apply") {
  for (const pair of (process.env.APPLY ?? "").split(",").filter(Boolean)) {
    const [ev, pick] = pair.split("=").map(Number);
    const url = saved[ev]?.[pick];
    if (!url) throw new Error(`no candidate ${pick} for event ${ev}`);
    const { error } = await db.from("patched_events").update({ banner_url: url }).eq("chain_id", CHAIN).eq("event_id", ev);
    if (error) throw error;
    console.log(`event ${ev}: cover set to candidate ${pick}`);
  }
} else {
  const only = process.env.EVENTS?.split(",").map(Number);
  const per = Number(process.env.PER ?? 2);
  for (const [evStr, { scene, mood }] of Object.entries(SCENES)) {
    const ev = Number(evStr);
    if (only && !only.includes(ev)) continue;
    saved[ev] = [];
    for (let i = 0; i < per; i++) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { image } = await makeEventCover(scene, mood);
          const url = await store(await toCover(image), ev);
          saved[ev].push(url);
          console.log(`event ${ev} candidate ${i}: ${url}`);
          break;
        } catch (err) {
          console.error(`event ${ev} candidate ${i} attempt ${attempt} failed:`, (err as Error).message);
        }
      }
    }
    writeFileSync(STATE, JSON.stringify(saved, null, 2));
  }
}
