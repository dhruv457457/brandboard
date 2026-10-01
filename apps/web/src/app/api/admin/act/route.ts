import { decodeFunctionData, keccak256 } from "viem";
import { patchedMarketAbi } from "@patched/shared";
import { CHAIN_ID, MARKET, serverClient } from "@/lib/config";
import { getSessionUser, unauthorized } from "@/lib/server/auth";
import { isPolicyViolation, sendFromServerWallet } from "@/lib/server/privy";
import { allow } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The admin calls anyone may make while open admin is on. Its Privy wallet's policy allows exactly these. */
const OPEN_FNS = new Set(["approveListing", "rejectListing", "fastTrack", "resolveDispute", "createEvent", "setEventActive"]);

/**
 * Open admin (hackathon demo, OPEN_ADMIN=true): a signed-in person who isn't an admin can still approve listings,
 * fast-track milestones, settle disputes and manage events. Body { data } is the market calldata; it is sent from the
 * open-admin Privy server wallet, whose policy refuses anything outside OPEN_FNS on our market.
 */
export async function POST(req: Request) {
  if (process.env.OPEN_ADMIN !== "true" || !process.env.PRIVY_OPEN_ADMIN_WALLET_ID) {
    return Response.json({ error: "The admin console is for admins only." }, { status: 403 });
  }
  const user = await getSessionUser(req);
  if (!user) return unauthorized();
  if (!allow(`open-admin:${user.did}`, 100)) return Response.json({ error: "Too many admin actions today." }, { status: 429 });

  const { data } = (await req.json().catch(() => ({}))) as { data?: `0x${string}` };
  let fn: string;
  try {
    fn = decodeFunctionData({ abi: patchedMarketAbi, data: data! }).functionName;
  } catch {
    return Response.json({ error: "That isn't a market call." }, { status: 400 });
  }
  if (!OPEN_FNS.has(fn)) return Response.json({ error: "That action is for the real admins only." }, { status: 403 });

  const admin = process.env.OPEN_ADMIN_ADDRESS as `0x${string}`;
  try {
    // Only send what the contract would accept right now, with the contract's own reason if not.
    await serverClient().call({ account: admin, to: MARKET, data: data! });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message.split("\n")[0] : "The market refused it." }, { status: 400 });
  }
  try {
    const { hash } = await sendFromServerWallet(process.env.PRIVY_OPEN_ADMIN_WALLET_ID, { to: MARKET, data: data!, chainId: CHAIN_ID }, {
      // The same action pressed twice within a minute is sent once.
      idempotencyKey: `patched:${CHAIN_ID}:openadmin:${keccak256(data!)}:${Math.floor(Date.now() / 60_000)}`,
      sponsor: process.env.KEEPER_GAS_SPONSORED !== "false",
      signed: true,
    });
    if (hash) await serverClient().waitForTransactionReceipt({ hash, timeout: 30_000 });
    return Response.json({ hash });
  } catch (err) {
    console.error("open admin send failed", err);
    return Response.json({ error: isPolicyViolation(err) ? "Privy refused it: outside the open-admin policy." : "It didn't go through. Try again." }, { status: 502 });
  }
}
