// The creator's editable sponsor-page layer. Listing metadata is fixed once published (its hash is on-chain),
// so page copy, colour and section visibility live here instead and can change at any time.

export const PAGE_SECTIONS = ["sponsors", "how", "story", "activity", "faq"] as const;
export type PageSection = (typeof PAGE_SECTIONS)[number];

export const PAGE_ACCENTS = {
  orange: { accent: "#FF5A1F", soft: "#FFE3D6", on: "#0B0B0C", text: "#C2390A", label: "Orange" },
  ink: { accent: "#0B0B0C", soft: "#EDEBE4", on: "#FAFAF7", text: "#0B0B0C", label: "Ink" },
  lilac: { accent: "#B9A6FF", soft: "#F1ECFF", on: "#0B0B0C", text: "#5B3FD6", label: "Lilac" },
  mint: { accent: "#7FD9A8", soft: "#E3F7EC", on: "#0B0B0C", text: "#157046", label: "Mint" },
} as const;
export type PageAccent = keyof typeof PAGE_ACCENTS;

/** What sits behind the outfit, car or hoodie on the page and in the feed: a colour, a photo, or a photo over a colour. */
export interface PageStage {
  color?: string;
  image?: string;
}

/** Ready-made backgrounds, light to bold. The first is the app's own. */
export const STAGE_PRESETS = [
  { color: "#F1EFE8", label: "Paper" },
  { color: "#FFE3D6", label: "Peach" },
  { color: "#DCEBFF", label: "Sky" },
  { color: "#E3F7EC", label: "Mint" },
  { color: "#F1ECFF", label: "Lilac" },
  { color: "#FFE9A8", label: "Sun" },
  { color: "#FF5A1F", label: "Orange" },
  { color: "#0B0B0C", label: "Ink" },
] as const;

/** Inline style for a stage box. Empty when the creator picked nothing, so the app's own colour stays. */
export function stageStyle(stage?: PageStage | null): { background?: string } {
  if (!stage || (!stage.color && !stage.image)) return {};
  const layers = [stage.image ? `url("${stage.image}") center / cover no-repeat` : null, stage.color ?? null].filter(Boolean);
  return { background: layers.join(", ") };
}

export interface ListingPage {
  headline?: string;
  intro?: string;
  story?: string;
  accent?: PageAccent;
  stage?: PageStage;
  /** Section titles the creator renamed. */
  titles?: Partial<Record<"spots" | "sponsors" | "how" | "story" | "faq", string>>;
  faq?: { q: string; a: string }[];
  /** Per-spot "what the brand gets", by patch id. */
  perks?: Record<string, string>;
  /** Sections the creator turned off. */
  hide?: PageSection[];
}

const text = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || undefined;
};

/** Keep only known fields, trimmed to their limits. Used on save (server) and when reading. */
export function sanitizePage(input: unknown, patchCount = 16): ListingPage {
  const p = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: ListingPage = {};
  const headline = text(p.headline, 80);
  const intro = text(p.intro, 300);
  const story = text(p.story, 1200);
  if (headline) out.headline = headline;
  if (intro) out.intro = intro;
  if (story) out.story = story;
  if (typeof p.accent === "string" && p.accent in PAGE_ACCENTS) out.accent = p.accent as PageAccent;
  if (p.stage && typeof p.stage === "object") {
    const st = p.stage as Record<string, unknown>;
    const stage: PageStage = {};
    if (typeof st.color === "string" && /^#[0-9a-fA-F]{6}$/.test(st.color)) stage.color = st.color;
    // Only pictures from our own storage: a page can't point visitors at a tracking pixel somewhere else.
    if (typeof st.image === "string" && st.image.length < 600 && /^https:\/\/[^/]+\/storage\/v1\/object\/public\//.test(st.image) && !/["')\s]/.test(st.image)) stage.image = st.image;
    if (stage.color || stage.image) out.stage = stage;
  }
  if (p.titles && typeof p.titles === "object") {
    const t: ListingPage["titles"] = {};
    for (const k of ["spots", "sponsors", "how", "story", "faq"] as const) {
      const v = text((p.titles as Record<string, unknown>)[k], 60);
      if (v) t[k] = v;
    }
    if (Object.keys(t).length) out.titles = t;
  }
  if (Array.isArray(p.faq)) {
    const faq = p.faq
      .map((f) => ({ q: text((f as { q?: unknown })?.q, 120) ?? "", a: text((f as { a?: unknown })?.a, 500) ?? "" }))
      .filter((f) => f.q && f.a)
      .slice(0, 8);
    if (faq.length) out.faq = faq;
  }
  if (p.perks && typeof p.perks === "object") {
    const perks: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.perks as Record<string, unknown>)) {
      const id = Number(k);
      const t = text(v, 120);
      if (Number.isInteger(id) && id >= 0 && id < patchCount && t) perks[String(id)] = t;
    }
    if (Object.keys(perks).length) out.perks = perks;
  }
  if (Array.isArray(p.hide)) {
    const hide = p.hide.filter((h): h is PageSection => (PAGE_SECTIONS as readonly string[]).includes(h as string));
    if (hide.length) out.hide = [...new Set(hide)];
  }
  return out;
}
