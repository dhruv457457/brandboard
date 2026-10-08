// Get Patched Week: the community contest. Everything about it that both the server and the page need.

export const CONTEST = "get-patched-week";
export const CONTEST_EVENT_SLUG = "get-patched-week";
/** Entries close here: 2026-10-11 09:00 IST. */
export const DEADLINE = Date.parse("2026-10-11T03:30:00Z");
/** The contest opened 2026-10-08 00:00 IST; only actions after this count for step 3. */
export const OPENS = Date.parse("2026-10-07T18:30:00Z");
export const TELEGRAM_URL = "https://t.me/patchedworld";
export const X_URL = "https://x.com/Patched_world";
export const HASHTAG = "#GetPatched";
export const FUNNEL_STEPS = ["view", "join", "form"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const TRACKS = [
  { id: "post", name: "Best post", prize: 10, blurb: "An X post, thread or video about using Patched. Tag @Patched_world and add #GetPatched.", judged: "Creativity and honesty, picked by the team. Not views, so small accounts can win." },
  { id: "feedback", name: "Best feedback", prize: 10, blurb: "A written review: what broke, what confused you, and what would make you use it for real. Roast us, we can take it.", judged: "The most useful and specific feedback." },
  { id: "lucky", name: "Lucky draw", prize: 10, blurb: "Do the four steps. Nothing else.", judged: "Random and provably fair: a Monad block hash picks the winner." },
] as const;
export type TrackId = (typeof TRACKS)[number]["id"];

export const FEEDBACK_MIN = 300;
export const FEEDBACK_MAX = 4000;

const STATUS_URL = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})/;
/** An X (or twitter.com) post link, normalised to https://x.com/<user>/status/<id>; null if it isn't one. */
export function normalizePostUrl(v: unknown): string | null {
  const m = String(v ?? "").trim().match(STATUS_URL);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}
export const TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/;
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export function normalizeUrl(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!/^https?:\/\/[^\s]{4,500}$/i.test(s)) return null;
  try {
    return new URL(s).toString();
  } catch {
    return null;
  }
}

/** What the page shows about one entry (never the email, Telegram name or links). */
export interface PublicEntry {
  handle: string;
  avatar: string | null;
  tracks: TrackId[];
}

/** An entry as its owner sees it. */
export interface MyEntry {
  email: string | null;
  telegram: string;
  tracks: TrackId[];
  postUrl: string | null;
  feedbackUrl: string | null;
  feedbackText: string | null;
  joinedTelegram: boolean;
  valid: boolean | null;
  updatedAt: string;
}

/** Someone who tapped "Count me in" (or entered). Only people with an X handle are listed by name. */
export interface PublicPerson {
  handle: string;
  avatar: string | null;
}

export interface ContestStats {
  /** People who joined: tapped "Count me in" or entered. */
  joined: number;
  entries: number;
  listings: number;
  bids: number;
  creators: number;
  spots: number;
}

export interface ContestSteps {
  /** The account has an X handle linked. */
  x: boolean;
  /** A listing, a bid or a spot on the contest event after the contest opened. */
  action: { done: boolean; what: string | null };
}

export interface ContestWinner {
  track: TrackId;
  handle: string;
  note: string | null;
  tx: string | null;
}

export interface ContestData {
  open: boolean;
  deadline: number;
  event: { id: number; slug: string; name: string } | null;
  stats: ContestStats;
  entries: PublicEntry[];
  /** Joined people with an X handle, newest first (for the ticker). */
  people: PublicPerson[];
  winners: ContestWinner[];
  /** Present when the caller is signed in. */
  me: { xHandle: string | null; email: string | null; joined: boolean; steps: ContestSteps; entry: MyEntry | null } | null;
}

/**
 * The lucky-draw winner. `entries` must be the final, ordered list of eligible handles (oldest entry first) and
 * `blockHash` the hash of the first block after the deadline. Same inputs, same winner: anyone can recompute it.
 */
export function pickWinner<T>(entries: T[], blockHash: string): { index: number; entry: T } | null {
  if (!entries.length || !/^0x[0-9a-fA-F]{64}$/.test(blockHash)) return null;
  const index = Number(BigInt(blockHash) % BigInt(entries.length));
  return { index, entry: entries[index]! };
}
