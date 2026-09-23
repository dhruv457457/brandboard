import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const jwks = createRemoteJWKSet(new URL(process.env.PRIVY_JWKS_URL ?? `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));

export interface SessionUser {
  did: string;
  wallet: `0x${string}` | null;
  xHandle: string | null;
}

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  wallet_client_type?: string;
  chain_type?: string;
  username?: string;
}

/**
 * Verify the Privy access token from `Authorization: Bearer <token>` and look up the user's wallet.
 * Returns null if the request is not signed in. Server routes use this instead of trusting the client.
 */
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  let did: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: appId });
    did = payload.sub as string;
  } catch {
    return null;
  }

  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, {
    headers: {
      "privy-app-id": appId,
      authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return { did, wallet: null, xHandle: null };
  const user = (await res.json()) as { linked_accounts?: PrivyLinkedAccount[] };
  const accounts = user.linked_accounts ?? [];
  const evm = accounts.filter((a) => a.type === "wallet" && (a.chain_type ?? "ethereum") === "ethereum" && a.address);
  const wallet = (evm.find((a) => a.wallet_client_type === "privy") ?? evm[0])?.address?.toLowerCase() ?? null;
  const x = accounts.find((a) => a.type === "twitter_oauth");
  return { did, wallet: wallet as `0x${string}` | null, xHandle: x?.username ?? null };
}

export function unauthorized() {
  return Response.json({ error: "Sign in first." }, { status: 401 });
}
