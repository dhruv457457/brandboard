import { PLAY_MONEY } from "@/lib/config";
import { allowRate } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

/**
 * The demo account for judges and first-time visitors: a Privy test account (fixed email and code, set in the Privy
 * dashboard under Test accounts). The welcome page signs in with it in one tap. Only on play money (testnet, or
 * mainnet on TestUSD), so the shared account never holds real USDC. Off when DEMO_LOGIN=off or no account is set.
 */
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRate(`demo-login:${ip}`, 20, 60_000)) return Response.json({ enabled: false }, { status: 429 });
  const email = process.env.DEMO_LOGIN_EMAIL ?? process.env.E2E_TEST_EMAIL;
  const code = process.env.DEMO_LOGIN_CODE ?? process.env.E2E_TEST_CODE;
  if (!PLAY_MONEY || process.env.DEMO_LOGIN === "off" || !email || !code) return Response.json({ enabled: false });
  return Response.json({ enabled: true, email, code }, { headers: { "cache-control": "no-store" } });
}
