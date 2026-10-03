// All AI in Patched goes through OpenRouter, using the cheapest model that does each job well.
// Models are set by env vars (see .env.example) so they can be swapped without code changes.
// Server-only: never import this from browser code (it reads OPENROUTER_API_KEY).

import sharp from "sharp";

export type Surface = "outfit" | "car" | "hoodie";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

interface ChatMessage {
  role: "system" | "user";
  content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
}

async function chat(body: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env("OPENROUTER_API_KEY")}`,
      "content-type": "application/json",
      "x-title": "Patched",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, any>;
  if (!res.ok || json.error) throw new Error(`OpenRouter: ${json.error?.message ?? res.status}`);
  return json;
}

const CANVAS_PROMPTS: Record<Surface, string> = {
  outfit:
    "Edit this photo. Keep the same person, face, pose, framing, background and lighting exactly. " +
    "Replace only their outfit with the same cut of garment in plain matte white fabric: no logos, text, prints, " +
    "patterns or accessories on it. Natural fabric folds and shadows. Return only the edited photo.",
  car:
    "Edit this photo. Keep the same car, angle, framing, background and lighting exactly. " +
    "Repaint the car body in plain clean white with no decals, logos, text or stripes. Keep windows, wheels and " +
    "lights unchanged. Return only the edited photo.",
  hoodie:
    "Edit this photo. Keep the same hoodie shape, framing, background and lighting exactly. " +
    "Make the hoodie plain white with no logos, text, prints or patterns. Natural fabric folds and shadows. " +
    "Return only the edited photo.",
};

/**
 * Photo → clean white canvas (same subject, blank surface) for placing patches.
 * @param image a data: URL or public https URL of the source photo
 * @returns a data: URL (PNG/JPEG) of the edited image
 */
/** An own-idea surface (a laptop lid, a booth wall, a skateboard): whitewash the thing so logos can go on it. */
function ideaPrompt(what: string) {
  return (
    `Edit this photo. It shows ${what.replace(/[^\w\s,.'-]/g, "").slice(0, 60)}. Keep the same object, angle, framing, background and ` +
    "lighting exactly. Make the object's visible surfaces plain clean white with no logos, text, stickers or prints, so " +
    "logos can be placed on it. Return only the edited photo."
  );
}

export async function makeCanvas(image: string, surface: Surface, idea?: string): Promise<{ image: string; model: string }> {
  const models = [env("AI_IMAGE_MODEL", "google/gemini-3.1-flash-lite-image"), env("AI_IMAGE_FALLBACK_MODEL", "google/gemini-2.5-flash-image")];
  let lastError: unknown;
  for (const model of models) {
    try {
      const json = await chat({
        model,
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: idea ? ideaPrompt(idea) : CANVAS_PROMPTS[surface] },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ] satisfies ChatMessage[],
      });
      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
      if (url) return { image: url, model };
      lastError = new Error("model returned no image");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("canvas generation failed");
}

/**
 * Where the visible subject of a cutout (non-transparent pixels) sits in the image, as percent boxes, plus the subject
 * cropped onto white. The vision model places spots far more accurately on a tight crop than on a full-height frame with
 * the person in a narrow strip. Null when the image has no transparency to measure or the subject already fills it.
 */
async function subjectCrop(image: string): Promise<{ x: number; y: number; w: number; h: number; crop: string } | null> {
  try {
    const bytes = image.startsWith("data:")
      ? Buffer.from(image.slice(image.indexOf(",") + 1), "base64")
      : Buffer.from(await (await fetch(image)).arrayBuffer());
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H } = info;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < x0 || y1 < y0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if ((w * h) / (W * H) > 0.8) return null;
    const png = await sharp(bytes).extract({ left: x0, top: y0, width: w, height: h }).flatten({ background: "#ffffff" }).png().toBuffer();
    return { x: (x0 / W) * 100, y: (y0 / H) * 100, w: (w / W) * 100, h: (h / H) * 100, crop: `data:image/png;base64,${png.toString("base64")}` };
  } catch {
    return null;
  }
}

export interface SuggestedPatch {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Suggest where patches should go on a canvas image (percent boxes), using a cheap vision model.
 * Returns [] if the model's answer can't be parsed; callers fall back to the default layout.
 */
export async function suggestLayout(image: string, surface: Surface, count = 5, view?: string): Promise<SuggestedPatch[]> {
  // Ask about the subject alone, then map the boxes back onto the full image.
  const box = await subjectCrop(image);
  const patches = await suggestOn(box ? box.crop : image, surface, count, view, !!box);
  if (!box) return patches;
  return patches.map((p) => ({
    ...p,
    x: Math.round((box.x + (p.x * box.w) / 100) * 10) / 10,
    y: Math.round((box.y + (p.y * box.h) / 100) * 10) / 10,
    w: Math.round(((p.w * box.w) / 100) * 10) / 10,
    h: Math.round(((p.h * box.h) / 100) * 10) / 10,
  }));
}

async function suggestOn(image: string, surface: Surface, count: number, view: string | undefined, cropped: boolean): Promise<SuggestedPatch[]> {
  const json = await chat({
    model: env("AI_VISION_MODEL", "google/gemini-2.5-flash-lite"),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `This is ${view ? `the ${view} view of ` : ""}a white ${surface === "car" ? "car" : surface === "hoodie" ? "hoodie" : "outfit on a person"} ${cropped ? "cropped tightly to its edges" : "on a transparent background"}. ` +
              `Propose ${count} rectangular spots where a sponsor logo patch would be clearly visible and look natural ` +
              `(flat areas of the clothing or car body that are really on it, never on the background, faces, hands, shoes, wheels or windows). ` +
              `Each spot is a compact rectangle, roughly as wide as it is tall (never more than twice as tall as wide), small enough that several fit on the surface. ` +
              `Answer as JSON: {"patches":[{"name":"short spot name","x":0-100,"y":0-100,"w":0-100,"h":0-100}]} ` +
              `where x,y are the top-left corner and w,h the size, all in percent of the image width/height.`,
          },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ] satisfies ChatMessage[],
  });
  try {
    const text = json.choices?.[0]?.message?.content as string;
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { patches?: SuggestedPatch[] };
    const clamp = (n: number) => Math.max(0, Math.min(100, Number(n) || 0));
    return (parsed.patches ?? [])
      .slice(0, 16)
      .map((p) => ({ name: String(p.name).slice(0, 31), x: clamp(p.x), y: clamp(p.y), w: clamp(p.w), h: clamp(p.h) }))
      .filter((p) => p.w >= 3 && p.h >= 2 && p.x + p.w <= 100 && p.y + p.h <= 100);
  } catch {
    return [];
  }
}

// ─────────────────────────── full-body model shots (outfit / team hoodie) ───────────────────────────

export const STYLE_PRESETS: Record<string, string> = {
  current: "the same outfit they are wearing in the reference photo",
  hoodie: "an oversized hoodie with joggers and sneakers",
  tee: "a fitted t-shirt with straight jeans and sneakers",
  blazer: "an open blazer over a t-shirt with tailored trousers",
  dress: "a knee-length fitted dress with simple flats",
  jersey: "a sports jersey with track pants",
};

/** Flat key colour that cutoutGreen() removes afterwards (see ./cutout.ts). */
const GREEN_SCREEN =
  "The background is one flat, solid, pure chroma-key green (#00FF00) from edge to edge: no floor, no horizon, " +
  "no shadows, gradients or reflections on it, and no green anywhere on the subject.";

const WHITE_RULE =
  "Every garment is plain matte white with no logos, text, prints, patterns, stripes or visible branding, so it can be used as a blank canvas.";

async function imageCall(content: ChatMessage["content"], aspect = "2:3"): Promise<{ image: string; model: string }> {
  const models = [env("AI_IMAGE_MODEL", "google/gemini-3.1-flash-lite-image"), env("AI_IMAGE_FALLBACK_MODEL", "google/gemini-2.5-flash-image")];
  let lastError: unknown;
  for (const model of models) {
    try {
      const json = await chat({
        model,
        modalities: ["image", "text"],
        image_config: { aspect_ratio: aspect },
        messages: [{ role: "user", content }] satisfies ChatMessage[],
      });
      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
      if (url) return { image: url, model };
      lastError = new Error("model returned no image");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("image generation failed");
}

/**
 * Full-body studio shot of the person in `photo`, front or back, wearing a plain white version of `style`.
 * For the back view pass the generated front image as `front` so person, outfit and framing match.
 */
export async function makeModelShot(opts: { photo: string; style: string; side: "front" | "back"; front?: string }) {
  const outfit = STYLE_PRESETS[opts.style] ?? String(opts.style).slice(0, 200);
  if (opts.side === "front") {
    return imageCall([
      {
        type: "text",
        text:
          "Create a photorealistic full-body studio photo of the same person as in this reference photo: same face, hair, " +
          "skin tone and body type. They stand straight facing the camera, arms relaxed slightly away from the body, " +
          "whole body visible from head to shoes, centered, with a little space above the head and below the feet. " +
          `Soft even studio lighting. ${GREEN_SCREEN} They wear ${outfit}. ${WHITE_RULE} ` +
          "Portrait orientation, 2:3. Return only the image.",
      },
      { type: "image_url", image_url: { url: opts.photo } },
    ]);
  }
  if (!opts.front) throw new Error("back view needs the front image");
  return imageCall([
    {
      type: "text",
      text:
        "Show the same person, outfit, framing and lighting as in this image, but from directly behind " +
        `(back view), standing straight, whole body visible from head to shoes, centered. ${GREEN_SCREEN} ${WHITE_RULE} ` +
        "Portrait orientation, 2:3. Return only the image.",
    },
    { type: "image_url", image_url: { url: opts.front } },
  ]);
}

// ─────────────────────────── event covers ───────────────────────────

/**
 * A wide cover illustration for an event page, in the Patched style: flat, bold outlines, pastel colours, the place itself
 * and people wearing plain white outfits with colourful sponsor patches. No text and no logos, so nothing in it is
 * anyone's brand and it never needs a translation. Returned wide (21:9); the caller crops it to the 3:1 cover box.
 */
export async function makeEventCover(scene: string, mood = "bright daytime"): Promise<{ image: string; model: string }> {
  return imageCall(
    [
      {
        type: "text",
        text:
          "Create a wide flat vector-style illustration banner, like a modern editorial poster. Bold clean black outlines, " +
          "simple shapes, hard offset shadows, soft paper-cream background tones with a palette of mint green, lilac, butter " +
          "yellow, sky blue and pink, and one hot orange (#FF5A1F) accent. " +
          `Scene: ${scene.replace(/[^\w\s,.'()&-]/g, "").slice(0, 300)}. Mood: ${mood.replace(/[^\w\s,.'-]/g, "").slice(0, 60)}. ` +
          "In the foreground, a small group of friendly stylised people stand side by side wearing plain white outfits (a jacket, " +
          "a hoodie, a dress), and each outfit carries two or three rounded-square colourful patches with dashed stitched borders " +
          "(the patches are blank: no letters, no logos). Keep the middle and the left generous and uncluttered for overlaid " +
          "text. Absolutely no text, letters, numbers, logos or watermarks anywhere. Wide 21:9 composition. Return only the image.",
      },
    ],
    "21:9",
  );
}

// ─────────────────────────── cars: one photo → every side ───────────────────────────

export const CAR_VIEWS = {
  left: { label: "Left side", aspect: "16:9", shot: "a perfectly side-on profile of the driver's-side (left) of the car, facing left, whole car visible" },
  right: { label: "Right side", aspect: "16:9", shot: "a perfectly side-on profile of the passenger-side (right) of the car, facing right, whole car visible" },
  front: { label: "Front", aspect: "4:3", shot: "the front of the car seen straight on at bumper height, whole car visible" },
  back: { label: "Back", aspect: "4:3", shot: "the back of the car seen straight on at bumper height, whole car visible" },
  roof: { label: "Roof", aspect: "16:9", shot: "the car seen from directly above (top-down), front pointing left, whole roof, hood and trunk visible" },
} as const;
export type CarView = keyof typeof CAR_VIEWS;

/**
 * Pin down exactly which car is in the photo, so every generated view shows the same car.
 * Returns a one-paragraph description (make/model if recognisable, body style, proportions, wheels, lights).
 */
export async function describeCar(photo: string): Promise<string> {
  const json = await chat({
    model: env("AI_VISION_MODEL", "google/gemini-2.5-flash-lite"),
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Describe the car in this photo so an artist could draw it from any angle and it would be clearly the same car. " +
              "One paragraph, under 90 words: make and model if you can tell (else say so), body style (sedan, hatchback, SUV, " +
              "pickup, van...), number of doors, roof shape, proportions, headlight and taillight shapes, grille, wheel design " +
              "and size, and anything distinctive. Ignore paint colour, background and people. No lists, plain text only.",
          },
          { type: "image_url", image_url: { url: photo } },
        ],
      },
    ] satisfies ChatMessage[],
  });
  const text = String(json.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error("couldn't describe the car");
  return text.slice(0, 900);
}

/**
 * One view of the creator's car wrapped in plain white, on a green screen (cut out afterwards).
 * Pass the first generated view as `reference` for the others so every view shows the same car.
 */
export async function makeCarView(opts: { photo: string; description: string; view: CarView; reference?: string }) {
  const v = CAR_VIEWS[opts.view];
  const content: ChatMessage["content"] = [
    {
      type: "text",
      text:
        `Create a photorealistic product render of this exact car: ${opts.description} ` +
        "It must match the car in the reference photo(s): same model, body shape, proportions, lights, grille and wheels. " +
        `Show ${v.shot}, centered with a little margin, orthographic-looking camera, no people. ` +
        "The whole body is wrapped in plain matte white vinyl with no logos, badges, text, stripes, decals or number plate " +
        "text, so sponsor logos can be placed on it. Windows, tyres, wheels and lights keep their normal look. " +
        `Soft even studio lighting. ${GREEN_SCREEN} Return only the image.`,
    },
    { type: "image_url", image_url: { url: opts.photo } },
  ];
  if (opts.reference) content.push({ type: "image_url", image_url: { url: opts.reference } });
  return imageCall(content, v.aspect);
}

/** Three short outfit ideas that would suit the person in the photo (cheap vision model). */
export async function suggestStyles(photo: string): Promise<string[]> {
  const json = await chat({
    model: env("AI_VISION_MODEL", "google/gemini-2.5-flash-lite"),
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "This person will wear sponsor logo patches at a tech conference. Suggest 3 different outfits that would " +
              "suit them and give lots of flat space for patches. Each under 12 words, garments only (no colors, all " +
              'will be white). Answer as JSON: {"styles":["...","...","..."]}',
          },
          { type: "image_url", image_url: { url: photo } },
        ],
      },
    ] satisfies ChatMessage[],
  });
  try {
    const text = json.choices?.[0]?.message?.content as string;
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { styles?: string[] };
    return (parsed.styles ?? []).map((s) => String(s).slice(0, 100)).filter(Boolean).slice(0, 3);
  } catch {
    return [];
  }
}
