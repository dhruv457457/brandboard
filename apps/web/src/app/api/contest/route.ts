import { CONTEST, DEADLINE, FEEDBACK_MAX, FEEDBACK_MIN, EMAIL_RE, TELEGRAM_RE, TRACKS, normalizePostUrl, normalizeUrl, type TrackId } from "@/lib/contest";
import { fetchContest } from "@/lib/server/contest";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { allow } from "@/lib/server/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** The contest page's data: public entries (handle, avatar, tracks only), counters, winners, and the caller's own entry and steps. */
export async function GET(req: Request) {
  const user = await getSessionUser(req).catch(() => null);
  const data = await fetchContest(user);
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

interface Input {
  email?: string;
  telegram?: string;
  tracks?: string[];
  postUrl?: string;
  feedbackUrl?: string;
  feedbackText?: string;
  joinedTelegram?: boolean;
}

/**
 * Enter (or update) the contest. One entry per signed-in person; sending again before the deadline replaces it.
 * The X handle is the verified one on the account, never typed in. Emails are only for contacting winners.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (Date.now() >= DEADLINE) return Response.json({ error: "Entries are closed." }, { status: 403 });
  if (!user.xHandle) return Response.json({ error: "Link your X account first: the contest runs on X handles." }, { status: 400 });
  if (!allow(`contest:${user.did}`, 40)) return Response.json({ error: "Too many tries today. Come back tomorrow." }, { status: 429 });

  const input = (await req.json().catch(() => null)) as Input | null;
  if (!input) return Response.json({ error: "Fill in the form." }, { status: 400 });

  const tracks = [...new Set((input.tracks ?? []).filter((t): t is TrackId => TRACKS.some((x) => x.id === t)))];
  if (!tracks.length) return Response.json({ error: "Pick at least one track." }, { status: 400 });
  const telegram = String(input.telegram ?? "").trim();
  if (!TELEGRAM_RE.test(telegram)) return Response.json({ error: "Add your Telegram username, like @name." }, { status: 400 });
  if (input.joinedTelegram !== true) return Response.json({ error: "Join the Telegram group first, then tick the box." }, { status: 400 });
  const email = String(input.email ?? user.emails[0] ?? "").trim();
  if (!EMAIL_RE.test(email)) return Response.json({ error: "Add an email so we can reach you if you win." }, { status: 400 });

  // Step 4 is mandatory for everyone, so the post link is always required.
  const postUrl = normalizePostUrl(input.postUrl);
  if (!postUrl) return Response.json({ error: "Paste the link to your X post, like x.com/you/status/123." }, { status: 400 });

  let feedbackUrl: string | null = null;
  let feedbackText: string | null = null;
  if (tracks.includes("feedback")) {
    feedbackUrl = input.feedbackUrl ? normalizeUrl(input.feedbackUrl) : null;
    feedbackText = String(input.feedbackText ?? "").trim() || null;
    if (input.feedbackUrl && !feedbackUrl) return Response.json({ error: "That feedback link doesn't look right." }, { status: 400 });
    if (!feedbackUrl && !feedbackText) return Response.json({ error: "Best feedback needs a link to your write-up, or your feedback in your own words." }, { status: 400 });
    if (!feedbackUrl && feedbackText && (feedbackText.length < FEEDBACK_MIN || feedbackText.length > FEEDBACK_MAX)) {
      return Response.json({ error: `Write between ${FEEDBACK_MIN} and ${FEEDBACK_MAX} characters.` }, { status: 400 });
    }
    if (feedbackText) feedbackText = feedbackText.slice(0, FEEDBACK_MAX);
  }

  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("id").eq("privy_did", user.did).maybeSingle();
  const { error } = await db.from("contest_entries").upsert(
    {
      contest: CONTEST, privy_did: user.did, profile_id: profile?.id ?? null, wallet: user.wallet, x_handle: user.xHandle, email, telegram: telegram.replace(/^@?/, "@"),
      tracks, post_url: postUrl, feedback_url: feedbackUrl, feedback_text: feedbackText, joined_telegram: true, updated_at: new Date().toISOString(),
    },
    { onConflict: "contest,privy_did" },
  );
  if (error) return Response.json({ error: "Couldn't save your entry. Try again in a moment." }, { status: 500 });
  return Response.json({ ok: true });
}
