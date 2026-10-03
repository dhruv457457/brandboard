import { forgetUser, getSessionUser, unauthorized } from "@/lib/server/auth";
import { demoRefusal, isDemoAccount } from "@/lib/server/demoAccount";
import { privyServer } from "@/lib/server/privy";

export const runtime = "nodejs";

/**
 * Choose which of your wallets is your Patched wallet: your own (MetaMask and co.) or the Privy wallet made for
 * you. Body: { address }. It has to be one of the wallets linked to your account; the choice is saved on your
 * Privy user, so it follows you to every device. Not on the shared demo account, whose wallet everyone uses.
 */
export async function POST(req: Request) {
  const user = await getSessionUser(req, { fresh: true });
  if (!user) return unauthorized();
  if (isDemoAccount(user)) return demoRefusal();
  const { address } = (await req.json().catch(() => ({}))) as { address?: string };
  const wanted = String(address ?? "").toLowerCase();
  if (!user.wallets.includes(wanted)) return Response.json({ error: "That wallet isn't linked to your account." }, { status: 400 });
  await privyServer().users().setCustomMetadata(user.did, { custom_metadata: { accountWallet: wanted } });
  forgetUser(user.did);
  return Response.json({ wallet: wanted });
}
