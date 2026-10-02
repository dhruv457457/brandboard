import "server-only";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { PrivyClient, generateAuthorizationSignature } from "@privy-io/node";

let client: PrivyClient | null = null;

/** The server-side Privy client (app secret), shared by the keeper and campaigns. */
export function privyServer(): PrivyClient {
  client ??= new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });
  return client;
}

/**
 * Wallets and policies we create are owned by our authorization key, so every send and every policy change has to
 * be signed with it. This is the context to pass along (unless the keeper wallet is app-controlled).
 */
export function authContext() {
  return { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!] };
}

/** The owner object for new wallets and policies: the public half of our authorization key. */
export function keyOwner() {
  const der = Buffer.from(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!.replace(/^wallet-auth:/, ""), "base64");
  const publicKey = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" }))
    .export({ format: "der", type: "spki" })
    .toString("base64");
  return { public_key: publicKey };
}

/**
 * Send a transaction from a Privy server wallet and wait for its hash. Sponsored sends are relayed
 * asynchronously, so the hash can be empty at first; look it up by transaction id.
 */
export async function sendFromServerWallet(walletId: string, tx: { to: `0x${string}`; data: `0x${string}`; chainId: number }, opts: { idempotencyKey: string; sponsor: boolean; signed: boolean }) {
  const privy = privyServer();
  const res = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2: `eip155:${tx.chainId}`,
    params: { transaction: { to: tx.to, data: tx.data, chain_id: tx.chainId } },
    sponsor: opts.sponsor,
    idempotency_key: opts.idempotencyKey,
    ...(opts.signed ? { authorization_context: authContext() } : {}),
  });
  let hash = res.hash as `0x${string}` | "";
  for (let i = 0; !hash && res.transaction_id && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const t = await privy.transactions().get(res.transaction_id);
    if (t.status === "failed" || t.status === "execution_reverted" || t.status === "provider_error") throw new Error(`transaction ${t.status}`);
    hash = (t.transaction_hash ?? "") as `0x${string}` | "";
  }
  return { hash: hash || null, transactionId: res.transaction_id ?? null };
}

/**
 * Privy's budget check for a campaign bid. Privy only evaluates aggregations when it signs, so we ask it to sign the
 * exact bid (eth_signTransaction): the policy's budget rule adds it to the campaign's running total, or refuses with a
 * policy violation if the total would pass the budget. The signature is thrown away; the bid itself is sent through
 * Privy's sponsored sendTransaction afterwards. The gas fields don't matter for a signature nobody broadcasts.
 */
export async function budgetCheck(walletId: string, tx: { to: `0x${string}`; data: `0x${string}`; chainId: number }) {
  await privyServer().wallets().ethereum().signTransaction(walletId, {
    params: {
      transaction: { to: tx.to, data: tx.data, chain_id: tx.chainId, type: 2, nonce: 0, gas_limit: "0x7a120", max_fee_per_gas: "0x1", max_priority_fee_per_gas: "0x1" },
    },
    authorization_context: authContext(),
  });
}

/** Create a Privy aggregation (the SDK has the types but no method yet), owned by our authorization key. */
export async function createAggregation(input: object): Promise<string> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  const res = await fetch("https://api.privy.io/v1/aggregations", {
    method: "POST",
    headers: {
      "privy-app-id": appId,
      authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...input, owner: keyOwner() }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !json.id) throw new Error(`Privy aggregation: ${json.error ?? res.status}`);
  return json.id;
}

/**
 * Delete a Privy aggregation, which frees one of the app's 10. Privy signs a DELETE as if its body were {}, but the
 * request itself carries no body. Returns false when Privy refused (the caller keeps the id and may retry later).
 */
export async function deleteAggregation(id: string): Promise<boolean> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
  const url = `https://api.privy.io/v1/aggregations/${id}`;
  const signature = generateAuthorizationSignature({
    authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!.replace(/^wallet-auth:/, ""),
    input: { version: 1, method: "DELETE", url, body: {}, headers: { "privy-app-id": appId } },
  });
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "privy-app-id": appId, authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`, "privy-authorization-signature": signature },
  });
  return res.ok || res.status === 404;
}

/** Did Privy refuse this because of the wallet's policy (not a chain or network problem)? */
export function isPolicyViolation(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /policy/i.test(msg);
}
