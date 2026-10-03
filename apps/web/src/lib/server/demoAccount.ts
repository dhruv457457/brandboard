import "server-only";
import { PLAY_MONEY } from "@/lib/config";

/** The shared demo account's email (a Privy test account), lowercase; the same fallback as its sign-in route. */
function demoEmail(): string | null {
  return (process.env.DEMO_LOGIN_EMAIL ?? process.env.E2E_TEST_EMAIL)?.toLowerCase() || null;
}

/** The demo account's email and code where the site offers it (play money only, see /api/demo-login), else null. */
export function demoLogin(): { email: string; code: string } | null {
  const email = process.env.DEMO_LOGIN_EMAIL ?? process.env.E2E_TEST_EMAIL;
  const code = process.env.DEMO_LOGIN_CODE ?? process.env.E2E_TEST_CODE;
  if (!PLAY_MONEY || process.env.DEMO_LOGIN === "off" || !email || !code) return null;
  return { email, code };
}

/**
 * Is this the shared demo account? Everyone who taps "Use the demo account" lands in it, so routes refuse changes
 * that would lock out or rob the next person (switching its wallet, verifying a brand on its email). Checked against
 * the emails Privy verified for the session, never anything the browser sends.
 */
export function isDemoAccount(user: { emails: string[] }): boolean {
  const email = demoEmail();
  return !!email && user.emails.includes(email);
}

/** The refusal those routes send. */
export function demoRefusal() {
  return Response.json({ error: "Not on the shared demo account." }, { status: 403 });
}
