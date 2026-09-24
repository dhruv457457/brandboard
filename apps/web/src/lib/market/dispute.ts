// The dispute reason travels on-chain as the `reasonURI` string of PatchedMarket.dispute().
// Format: "json:" + {"c": category, "t": details, "f": [evidence urls]}. Older disputes used "text:<details>".

export const DISPUTE_CATEGORIES = {
  missing: "Patch is missing",
  wrong: "Wrong spot, size or logo",
  fake: "Proof looks fake or reused",
  other: "Something else",
} as const;
export type DisputeCategory = keyof typeof DISPUTE_CATEGORIES;

export interface DisputeReason {
  category: DisputeCategory | null;
  text: string;
  files: string[];
}

export const DISPUTE_TEXT_MAX = 500;
export const DISPUTE_FILES_MAX = 3;

export function encodeDisputeReason(r: DisputeReason): string {
  return "json:" + JSON.stringify({ c: r.category, t: r.text.slice(0, DISPUTE_TEXT_MAX), f: r.files.slice(0, DISPUTE_FILES_MAX) });
}

export function parseDisputeReason(uri: string | null | undefined): DisputeReason {
  const raw = uri ?? "";
  if (raw.startsWith("json:")) {
    try {
      const j = JSON.parse(raw.slice(5)) as { c?: string; t?: string; f?: unknown };
      const category = j.c && j.c in DISPUTE_CATEGORIES ? (j.c as DisputeCategory) : null;
      // Only show evidence that was uploaded through our own storage.
      const storage = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
      const files = Array.isArray(j.f) ? j.f.filter((u): u is string => typeof u === "string" && u.startsWith(storage)) : [];
      return { category, text: String(j.t ?? ""), files };
    } catch {
      /* fall through to plain text */
    }
  }
  return { category: null, text: raw.replace(/^text:/, ""), files: [] };
}
