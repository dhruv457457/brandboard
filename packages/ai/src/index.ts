// All AI in Patched goes through OpenRouter, using the cheapest model that does each job well.
// Models are set by env vars (see .env.example) so they can be swapped without code changes.
// Server-only: never import this from browser code (it reads OPENROUTER_API_KEY).

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
export async function makeCanvas(image: string, surface: Surface): Promise<{ image: string; model: string }> {
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
              { type: "text", text: CANVAS_PROMPTS[surface] },
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
export async function suggestLayout(image: string, surface: Surface, count = 5): Promise<SuggestedPatch[]> {
  const json = await chat({
    model: env("AI_VISION_MODEL", "qwen/qwen3.7-flash"),
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `This is a white ${surface === "car" ? "car" : surface === "hoodie" ? "hoodie" : "outfit on a person"}. ` +
              `Propose ${count} rectangular spots where a sponsor logo patch would be clearly visible and look natural ` +
              `(flat areas of the surface, not faces, hands, wheels or windows). ` +
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

const WHITE_RULE =
  "Every garment is plain matte white with no logos, text, prints, patterns, stripes or visible branding, so it can be used as a blank canvas.";

async function imageCall(content: ChatMessage["content"]): Promise<{ image: string; model: string }> {
  const models = [env("AI_IMAGE_MODEL", "google/gemini-3.1-flash-lite-image"), env("AI_IMAGE_FALLBACK_MODEL", "google/gemini-2.5-flash-image")];
  let lastError: unknown;
  for (const model of models) {
    try {
      const json = await chat({
        model,
        modalities: ["image", "text"],
        image_config: { aspect_ratio: "2:3" },
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
          `Plain light grey studio background, soft even lighting. They wear ${outfit}. ${WHITE_RULE} ` +
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
        "Show the same person, outfit, framing, background and lighting as in this image, but from directly behind " +
        `(back view), standing straight, whole body visible from head to shoes, centered. ${WHITE_RULE} ` +
        "Portrait orientation, 2:3. Return only the image.",
    },
    { type: "image_url", image_url: { url: opts.front } },
  ]);
}

/** Three short outfit ideas that would suit the person in the photo (cheap vision model). */
export async function suggestStyles(photo: string): Promise<string[]> {
  const json = await chat({
    model: env("AI_VISION_MODEL", "qwen/qwen3.7-flash"),
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
