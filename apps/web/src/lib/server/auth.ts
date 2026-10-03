import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabase";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const jwks = createRemoteJWKSet(new URL(process.env.PRIVY_JWKS_URL ?? `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));

export interface SessionUser {
  did: string;
  wallet: `0x${string}` | null;
  /** Every Ethereum wallet linked to the account (the account's wallet is one of them). */
  wallets: string[];
  xHandle: string | null;
  /** The linked X account's display name and profile picture, as Privy has them. */
  xName: string | null;
  xAvatar: string | null;
  /** Emails Privy has verified for this user (email login/link or Google). */
  emails: string[];
}

interface PrivyLinkedAccount {
  type: string;
  address?: string;
  wallet_client_type?: string;
  chain_type?: string;
  username?: string;
  name?: string | null;
  profile_picture_url?: string | null;
  email?: string;
  /** Unix seconds when this account was first linked. */
  first_verified_at?: number | null;
}

/**
 * Verify the Privy access token from `Authorization: Bearer <token>` and look up the user's wallet.
 * Returns null if the request is not signed in. Server routes use this instead of trusting the client.
 */
export async function getSessionUser(req: Request, opts: { fresh?: boolean } = {}): Promise<SessionUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  let did: string;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: appId });
    did = payload.sub as string;
  } catch {
    return null;
  }

  // Privy's user lookup is a network round trip (about a second): reuse it for a few minutes per user, and let requests
  // that arrive together (a page makes several at once) share one lookup instead of each making their own.
  // fresh: skip the cache (e.g. right after linking an email, to verify a brand).
  const hit = opts.fresh ? undefined : userCache.get(did);
  if (hit && hit.at > Date.now() - USER_TTL_MS) return hit.user;
  const pending = !opts.fresh ? lookups.get(did) : undefined;
  if (pending) return pending;
  const run = lookupUser(did)
    .then((user) => {
      if (user.wallet !== null || user.xHandle !== null) userCache.set(did, { at: Date.now(), user });
      if (userCache.size > 500) userCache.delete(userCache.keys().next().value!);
      return user;
    })
    .finally(() => lookups.delete(did));
  lookups.set(did, run);
  return run;
}

const USER_TTL_MS = 5 * 60_000;
const userCache = new Map<string, { at: number; user: SessionUser }>();
const lookups = new Map<string, Promise<SessionUser>>();

/**
 * Who is asking, cheaply: the token is verified here and the wallet comes from the person's own profile row (which we
 * saved from Privy when they signed in), so there is no Privy round trip. Good for reads that are personalised (which
 * reactions are mine) and for light actions on your own account (follow, react, post a photo). Anything that moves
 * money, reads private data or needs the verified emails and linked accounts uses getSessionUser.
 * `wallet` is null when there is no profile row yet.
 */
export async function getSessionLite(req: Request): Promise<{ did: string; wallet: string | null } | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: "privy.io", audience: appId });
    const did = payload.sub as string;
    const { data } = await supabaseAdmin().from("profiles").select("wallet").eq("privy_did", did).maybeSingle();
    return { did, wallet: data?.wallet?.toLowerCase() ?? null };
  } catch {
    return null;
  }
}

export async function getSessionWallet(req: Request): Promise<string | null> {
  return (await getSessionLite(req))?.wallet ?? null;
}

async function lookupUser(did: string): Promise<SessionUser> {
  const res = await fetch(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, {
    headers: {
      "privy-app-id": appId,
      authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return { did, wallet: null, wallets: [], xHandle: null, xName: null, xAvatar: null, emails: [] };
  const user = (await res.json()) as { linked_accounts?: PrivyLinkedAccount[]; custom_metadata?: { accountWallet?: string } };
  const accounts = user.linked_accounts ?? [];
  const evm = accounts.filter((a) => a.type === "wallet" && (a.chain_type ?? "ethereum") === "ethereum" && a.address);
  // The account's wallet is the one the person chose at sign-in (saved on their Privy user), else the one linked
  // first: a MetaMask user keeps their MetaMask wallet (where their money, listings and bids are) even if Privy
  // later adds an embedded wallet; an X or email user keeps their embedded one.
  const wallets = evm.map((a) => a.address!.toLowerCase());
  const chosen = user.custom_metadata?.accountWallet?.toLowerCase();
  const first = [...evm].sort((a, b) => (a.first_verified_at ?? Infinity) - (b.first_verified_at ?? Infinity))[0];
  const wallet = (chosen && wallets.includes(chosen) ? chosen : first?.address?.toLowerCase()) ?? null;
  const x = accounts.find((a) => a.type === "twitter_oauth");
  const emails = accounts
    .map((a) => (a.type === "email" ? a.address : a.type === "google_oauth" ? a.email : undefined))
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());
  // X serves a 48px "_normal" picture by default; "_400x400" is the same picture at a size that looks right on a profile.
  const xAvatar = x?.profile_picture_url?.replace(/_normal(\.\w+)$/, "_400x400$1") ?? null;
  return { did, wallet: wallet as `0x${string}` | null, wallets, xHandle: x?.username ?? null, xName: x?.name ?? null, xAvatar, emails };
}

/** Forget the cached lookup for a user (after their wallet choice changes). */
export function forgetUser(did: string) {
  userCache.delete(did);
}

/** 401. Pass the looked-up user (when there is one) so a signed-in account whose wallet isn't ready gets an honest message. */
export function unauthorized(user?: { wallet?: string | null } | null) {
  const walletPending = !!user && !user.wallet;
  return Response.json({ error: walletPending ? "Your wallet is still being set up. Try again in a few seconds." : "Sign in first." }, { status: 401 });
}
