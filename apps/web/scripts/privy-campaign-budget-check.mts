// Proof of the campaign budget check (a Privy aggregation), using the app's own policy code: a throwaway campaign wallet
// with a $5 budget and $3 per bid asks Privy's budget check (eth_signTransaction) to approve bidFor bids in sequence,
// as the keeper does before each sponsored send. Privy must refuse the bid that would pass $5, a bid over $3, and a bid
// for another brand. A second campaign wallet on the SAME aggregation is also refused once the first has used the budget:
// an aggregation keeps one total for every wallet that uses it, so campaigns can't share one (Privy allows 10 per app).
// Nothing is broadcast; everything is deleted afterwards.
// Run from apps/web:  NODE_USE_ENV_PROXY=1 npx tsx scripts/privy-campaign-budget-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { encodeFunctionData } from "viem";
import { PrivyClient, generateAuthorizationSignature } from "@privy-io/node";
import { DEPLOYMENTS } from "@patched/shared";
import { BID_FOR_ABI, campaignAggregation, campaignRules } from "../src/lib/market/campaignPolicy";

for (const line of readFileSync(join(process.cwd(), "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const chainId = 10143;
const d = DEPLOYMENTS[chainId]!;
const key = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!;
const owner = { public_key: createPublicKey(createPrivateKey({ key: Buffer.from(key.replace(/^wallet-auth:/, ""), "base64"), format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64") };
const auth = { authorization_private_keys: [key] };
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const privy = new PrivyClient({ appId, appSecret: process.env.PRIVY_APP_SECRET! });
const rest = (method: string, path: string, body?: object) => fetch(`https://api.privy.io${path}`, {
  method,
  headers: { "privy-app-id": appId, authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`, "content-type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});

const BRAND = "0x1111111111111111111111111111111111111111" as const;
const OTHER = "0x2222222222222222222222222222222222222222" as const;
const endsAt = Math.floor(Date.now() / 1000) + 3600;

const aggRes = await rest("POST", "/v1/aggregations", { ...campaignAggregation({ chainId, market: d.market, name: "Budget check (temporary)", windowSeconds: 7200 }), owner });
const agg = (await aggRes.json()) as { id?: string; error?: string };
if (!agg.id) throw new Error(`aggregation: ${agg.error}`);
const mk = async (name: string) => {
  const policy = await privy.policies().create({
    version: "1.0", name, chain_type: "ethereum", owner,
    rules: campaignRules({ chainId, market: d.market, usdc: d.usdc, brand: BRAND, maxPerSpot: 3_000_000n, endsAt, aggregationId: agg.id!, budget: 5_000_000n }) as never,
  });
  const wallet = await privy.wallets().create({ chain_type: "ethereum", owner, policy_ids: [policy.id], display_name: name });
  return { policy, wallet };
};
const A = await mk("Budget check A (temporary)");
const B = await mk("Budget check B (temporary)");
console.log(`shared aggregation ${agg.id}
wallet A ${A.wallet.address} (policy ${A.policy.id}), wallet B ${B.wallet.address} (policy ${B.policy.id})
budget $5, at most $3 a bid, each
`);

let nonce = 0;
const sign = async (w: typeof A, bidder: `0x${string}`, amount: bigint) => {
  try {
    await privy.wallets().ethereum().signTransaction(w.wallet.id, {
      params: { transaction: {
        to: d.market, chain_id: chainId, type: 2, nonce: nonce++, gas_limit: "0x493e0", max_fee_per_gas: "0x174876e800", max_priority_fee_per_gas: "0x3b9aca00",
        data: encodeFunctionData({ abi: BID_FOR_ABI, functionName: "bidFor", args: [bidder, 1n, 0, amount] }),
      } },
      authorization_context: auth,
    });
    return "allowed";
  } catch (e) {
    const text = JSON.stringify((e as { error?: unknown; message?: string }).error ?? (e as Error).message);
    return /policy/i.test(text) ? "blocked" : `error ${text.slice(0, 100)}`;
  }
};
const wait = () => new Promise((r) => setTimeout(r, 6000));
const cases: [string, typeof A, `0x${string}`, bigint, "allowed" | "blocked"][] = [
  ["A: check $3 (total $3)", A, BRAND, 3_000_000n, "allowed"],
  ["A: bid $3 more (would be $6, over the $5 budget)", A, BRAND, 3_000_000n, "blocked"],
  ["A: bid $2 (total $5, exactly the budget)", A, BRAND, 2_000_000n, "allowed"],
  ["A: bid $1 more (would be $6)", A, BRAND, 1_000_000n, "blocked"],
  ["A: bid $4 for the brand (over the $3 per-bid cap)", A, BRAND, 4_000_000n, "blocked"],
  ["A: bid $1 for another brand", A, OTHER, 1_000_000n, "blocked"],
  // Same aggregation, other wallet: the total is shared, so B is refused although its own budget is untouched.
  ["B: check $3 on the same aggregation (A already used $5)", B, BRAND, 3_000_000n, "blocked"],
];
try {
  for (const [name, w, bidder, amount, expect] of cases) {
    const got = await sign(w, bidder, amount);
    if (got !== expect) process.exitCode = 1;
    console.log(`${got === expect ? "OK  " : "FAIL"} ${name}: ${got}`);
    await wait();
  }
} finally {
  for (const { wallet, policy } of [A, B]) {
    await privy.wallets().update(wallet.id, { policy_ids: [], authorization_context: auth }).catch((e) => console.log("couldn't detach policy", e.message));
    await privy.policies().delete(policy.id, { authorization_context: auth }).catch((e) => console.log("couldn't delete policy", e.message));
  }
  const url = `https://api.privy.io/v1/aggregations/${agg.id}`;
  const signature = generateAuthorizationSignature({
    authorizationPrivateKey: key.replace(/^wallet-auth:/, ""),
    input: { version: 1, method: "DELETE", url, body: {}, headers: { "privy-app-id": appId } },
  });
  const del = await fetch(url, {
    method: "DELETE",
    // Privy signs a DELETE as if its body were {}, but the request itself carries no body.
    headers: { "privy-app-id": appId, authorization: `Basic ${Buffer.from(`${appId}:${process.env.PRIVY_APP_SECRET}`).toString("base64")}`, "privy-authorization-signature": signature },
  });
  if (!del.ok) console.log("couldn't delete aggregation", del.status, (await del.text()).slice(0, 120));
}
