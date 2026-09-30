// Proof for "Patch anyone on X", against Privy, with the app's own code:
// 1. privyUserForX() creates a Privy user for an X account nobody has used yet, with the X account linked and a wallet
//    made ahead of time; a second call finds that same user and wallet instead of making another.
// 2. The offer wallet's policy (campaign rules + the stake-advance rule) lets it pay the stake to exactly that wallet,
//    and refuses a transfer anywhere else.
// Uses a made-up X account id, so no real person is touched. The test user and policy are deleted afterwards.
// Run from apps/web:
//   NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--conditions=react-server npx tsx scripts/privy-x-offer-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";

for (const line of readFileSync(join(process.cwd(), "..", "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
process.env.NEXT_PUBLIC_CHAIN_ID ??= "10143";

const { encodeFunctionData } = await import("viem");
const { PrivyClient } = await import("@privy-io/node");
const { DEPLOYMENTS } = await import("@patched/shared");
const { privyUserForX } = await import("../src/lib/server/xOffers");
const { ERC20_SPEND_ABI, campaignRules, offerAdvanceRule } = await import("../src/lib/market/campaignPolicy");

const chainId = 10143;
const d = DEPLOYMENTS[chainId]!;
const key = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!;
const owner = { public_key: createPublicKey(createPrivateKey({ key: Buffer.from(key.replace(/^wallet-auth:/, ""), "base64"), format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64") };
const auth = { authorization_private_keys: [key] };
const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });

let failed = false;
const check = (ok: boolean, name: string, detail = "") => {
  if (!ok) failed = true;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};

// A made-up X account (ids this large aren't issued yet), unique per run.
const x = { id: `9${Date.now()}${Math.floor(Math.random() * 1e5)}`, username: `ptchd_t${Date.now() % 1e7}`, name: "Patched check", avatar: null, followers: null };
const first = await privyUserForX(x);
check(first.pregenerated && /^0x[0-9a-f]{40}$/.test(first.wallet), "new X account: Privy user created with a wallet made ahead of time", first.wallet);
const found = await privy.users().getByTwitterSubject({ subject: x.id });
check(found.id === first.did, "Privy finds that user by the X account id", found.id);
const second = await privyUserForX(x);
check(!second.pregenerated && second.did === first.did && second.wallet === first.wallet, "second offer to the same account reuses the user and wallet");

const BRAND = "0x1111111111111111111111111111111111111111" as const;
const policy = await privy.policies().create({
  version: "1.0", name: "Offer check (temporary)", chain_type: "ethereum", owner,
  rules: [
    ...campaignRules({ chainId, market: d.market, usdc: d.usdc, brand: BRAND, maxPerSpot: 5_000_000n, endsAt: Math.floor(Date.now() / 1000) + 3600 }),
    offerAdvanceRule({ chainId, usdc: d.usdc, target: first.wallet, advance: 1_000_000n }),
  ] as never,
});
const wallet = await privy.wallets().create({ chain_type: "ethereum", owner, policy_ids: [policy.id], display_name: "Offer check (temporary)" });
// Privy simulates before it checks the policy, so use $0 transfers (they succeed from an empty wallet).
const transfer = async (to: `0x${string}`) => {
  try {
    await privy.wallets().ethereum().sendTransaction(wallet.id, {
      caip2: `eip155:${chainId}`, sponsor: true, authorization_context: auth,
      params: { transaction: { to: d.usdc, chain_id: chainId, data: encodeFunctionData({ abi: ERC20_SPEND_ABI, functionName: "transfer", args: [to, 0n] }) } },
    });
    return "allowed";
  } catch (e) {
    return /policy/i.test(JSON.stringify((e as { error?: unknown }).error ?? (e as Error).message)) ? "blocked" : `error ${(e as Error).message.slice(0, 80)}`;
  }
};
check((await transfer(first.wallet as `0x${string}`)) === "allowed", "offer wallet may pay the stake to that person's wallet");
check((await transfer("0x000000000000000000000000000000000000dEaD")) === "blocked", "offer wallet can't send to anyone else");

await privy.wallets().update(wallet.id, { policy_ids: [], authorization_context: auth }).catch((e) => console.log("couldn't detach policy", e.message));
await privy.policies().delete(policy.id, { authorization_context: auth }).catch((e) => console.log("couldn't delete policy", e.message));
await privy.users().delete(first.did).catch((e) => console.log("couldn't delete test user", e.message));
process.exitCode = failed ? 1 : 0;
