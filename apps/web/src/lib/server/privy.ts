import "server-only";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { PrivyClient } from "@privy-io/node";
import { toHex } from "viem";
import { serverClient } from "@/lib/config";

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
export async function sendFromServerWallet(walletId: string, tx: { to: `0x${string}`; data: `0x${string}`; chainId: number; value?: bigint }, opts: { idempotencyKey: string; sponsor: boolean; signed: boolean }) {
  const privy = privyServer();
  const res = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2: `eip155:${tx.chainId}`,
    params: { transaction: { to: tx.to, data: tx.data, chain_id: tx.chainId, ...(tx.value ? { value: toHex(tx.value) } : {}) } },
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
 * The gas a transaction from `from` will need (Monad charges the full gas limit), and its fields. Estimated once
 * so the caller can top the wallet up before signing.
 */
export async function prepareTx(from: `0x${string}`, tx: { to: `0x${string}`; data: `0x${string}` }) {
  const client = serverClient();
  const [nonce, gas, fees] = await Promise.all([
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.estimateGas({ account: from, to: tx.to, data: tx.data }),
    client.estimateFeesPerGas(),
  ]);
  const gasLimit = (gas * 11n) / 10n;
  return { nonce, gasLimit, maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas, cost: gasLimit * fees.maxFeePerGas };
}

/**
 * Have Privy sign a transaction from a server wallet (eth_signTransaction), then broadcast it ourselves. Needed where a
 * policy rule references an aggregation: Privy only evaluates aggregations when signing, not on sendTransaction. The
 * wallet pays its own gas, so no sponsorship here.
 */
export async function signAndBroadcast(walletId: string, from: `0x${string}`, tx: { to: `0x${string}`; data: `0x${string}`; chainId: number }, prepared?: Awaited<ReturnType<typeof prepareTx>>) {
  const p = prepared ?? (await prepareTx(from, tx));
  const res = await privyServer().wallets().ethereum().signTransaction(walletId, {
    params: {
      transaction: {
        to: tx.to, data: tx.data, chain_id: tx.chainId, type: 2, nonce: p.nonce,
        gas_limit: toHex(p.gasLimit), max_fee_per_gas: toHex(p.maxFeePerGas), max_priority_fee_per_gas: toHex(p.maxPriorityFeePerGas),
      },
    },
    authorization_context: authContext(),
  });
  return serverClient().sendRawTransaction({ serializedTransaction: res.signed_transaction as `0x${string}` });
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

/** Did Privy refuse this because of the wallet's policy (not a chain or network problem)? */
export function isPolicyViolation(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /policy/i.test(msg);
}
