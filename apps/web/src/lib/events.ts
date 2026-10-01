// Event page rules shared by the admin form, the event page and the events list (safe on server and client).

/** The cover is shown as a wide strip. The form previews exactly this crop (see EventCover). */
export const COVER_RATIO = { wide: 3, tall: 2 } as const;
export const COVER_HINT = "Wide photo, about 1800 × 600";
/** Smaller than this looks soft on a laptop. */
export const COVER_MIN = { w: 1200, h: 400 } as const;
export const COVER_MAX_BYTES = 10 * 1024 * 1024;
export const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** On-chain event names are bytes32: 31 bytes keeps a spare byte, and multi-byte letters count more than one. */
export const EVENT_NAME_MAX_BYTES = 31;
export const eventNameBytes = (name: string) => new TextEncoder().encode(name).length;

/** "Token2049 Singapore!" -> "token2049-singapore". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}

/** Why a slug can't be used, or null. All digits is out: /e/12 already means event number 12. */
export function slugProblem(slug: string): string | null {
  if (!slug) return null;
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(slug)) return "2 to 48 characters: letters, numbers and dashes.";
  if (/^\d+$/.test(slug)) return "Add a letter. A number alone is read as an event number.";
  return null;
}

/** "Token2049 Demo" -> "TD". */
export function eventInitials(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  const letters = words.length > 1 ? words.slice(0, 2).map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase() || "P";
}

const PASTEL_SETS = [
  ["--p3", "--p5", "--p2"],
  ["--p2", "--p4", "--p1"],
  ["--p1", "--p3", "--p5"],
  ["--p4", "--p2", "--p3"],
  ["--p5", "--p1", "--p4"],
] as const;

/** Three pastel tokens for an event's patch pattern; the same event always gets the same set. */
export const eventPastels = (seed: number) => PASTEL_SETS[Math.abs(Math.trunc(seed)) % PASTEL_SETS.length];

const day = (iso: string | number) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayYear = (iso: string | number) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Oct 3 – Oct 5, 2026", or "Oct 3, 2026" for a one-day event. Always UTC, so the server and browser agree. */
export function eventDates(startsAt: string | number, endsAt: string | number): string {
  if (day(startsAt) === day(endsAt)) return dayYear(startsAt);
  return `${day(startsAt)} – ${dayYear(endsAt)}`;
}
