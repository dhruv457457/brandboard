// Proof that auto-bid through signers is limited by Privy, end to end on the server:
// a throwaway wallet (owned by a throwaway key standing in for the brand) gets Patched's key quorum as a signer with
// the auto-bid policy for one spot, then the server, signing as that quorum, tries allowed and forbidden sends.
// Afterwards the "brand" removes the signer and the policy is deleted.
// Privy simulates each call before checking the policy, so every "blocked" case is a call that would succeed on-chain.
// Run from apps/web (needs PRIVY_SIGNER_QUORUM_ID in .env.local):
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/privy-signer-check.mts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";
import { encodeFunctionData, erc20Abi } from "viem";
import { PrivyClient } from "@privy-io/node";
import { DEPLOYMENTS } from "@patched/shared";
import { signerAutoBidRules } from "../src/lib/market/autoBidPolicy";

const root = join(process.cwd(), "..", "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const chainId = 10143;
const d = DEPLOYMENTS[chainId]!;
const LISTING = 1;
const PATCH = 0;
const MAX = 5_000_000n; // $5

const key = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!;
const der = Buffer.from(key.replace(/^wallet-auth:/, ""), "base64");
const publicKey = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64");
const auth = { authorization_private_keys: [key] };

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });

const policy = await privy.policies().create({
  version: "1.0",
  name: "Signer check (temporary)",
  chain_type: "ethereum",
  owner: { public_key: publicKey },
  rules: signerAutoBidRules([{ chainId, listingId: LISTING, patchId: PATCH, max: MAX }]),
});
// The "brand": a throwaway P-256 key that owns the test wallet, so it can remove the signer at the end.
const brandKey = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const brandAuth = { authorization_private_keys: [brandKey.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64")] };
const account = await privy.wallets().create({
  chain_type: "ethereum",
  display_name: "Signer check (temporary)",
  owner: { public_key: brandKey.publicKey.export({ format: "der", type: "spki" }).toString("base64") },
  additional_signers: [{ signer_id: process.env.PRIVY_SIGNER_QUORUM_ID!, override_policy_ids: [policy.id] }],
});

try {
  console.log(`test wallet ${account.address}, policy ${policy.id}\n`);

  // Privy simulates a call before it checks the policy, so a call that would revert anyway fails before the policy
  // is reached. Every "blocked" case here is therefore a call that would succeed on-chain from an empty wallet.
  // The bid rules (spot, max) need a live listing and USDC in the wallet; they are proven in the app instead.
  const DEAD = "0x000000000000000000000000000000000000dEaD";
  const approve = (spender: `0x${string}`, amount: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
  const attempts: { name: string; to: `0x${string}`; data: `0x${string}`; expect: "allowed" | "blocked" }[] = [
    { name: "approve the market for $1", to: d.usdc, data: approve(d.market, 1_000_000n), expect: "allowed" },
    { name: "approve the market for $6 (over the $5 max)", to: d.usdc, data: approve(d.market, 6_000_000n), expect: "blocked" },
    { name: "approve another address for $1", to: d.usdc, data: approve(DEAD, 1_000_000n), expect: "blocked" },
    { name: "transfer USDC out ($0)", to: d.usdc, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [DEAD, 0n] }), expect: "blocked" },
    { name: "call the market's setBrandName", to: d.market, data: encodeFunctionData({
      abi: [{ type: "function", name: "setBrandName", inputs: [{ name: "name", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "setBrandName", args: ["0x7465737400000000000000000000000000000000000000000000000000000000"],
    }), expect: "blocked" },
  ];

  for (const a of attempts) {
    let outcome: string;
    let allowed: boolean;
    try {
      const res = await privy.wallets().ethereum().sendTransaction(account.id, {
        caip2: `eip155:${chainId}`,
        params: { transaction: { to: a.to, data: a.data, chain_id: chainId } },
        sponsor: true,
        authorization_context: auth,
      });
      allowed = true;
      outcome = `sent (${res.transaction_id ?? res.hash})`;
    } catch (err) {
      const e = err as { status?: number; error?: unknown; message?: string };
      const text = JSON.stringify(e.error ?? e.message);
      // A policy refusal is "blocked". Anything else (the empty test wallet can't pay gas) means the policy let it through.
      allowed = !/policy/i.test(text);
      outcome = allowed ? `passed the policy, then failed on-chain: ${text.slice(0, 100)}` : `blocked by policy`;
    }
    const ok = (a.expect === "allowed") === allowed;
    if (!ok) process.exitCode = 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${a.name}: ${outcome}`);
  }
} finally {
  // Only the owner can take a signer off a wallet; the policy can be deleted once no wallet uses it.
  await privy.wallets().update(account.id, { additional_signers: [], authorization_context: brandAuth })
    .catch((e) => console.log("couldn't remove the signer", e.message));
  await privy.policies().delete(policy.id, { authorization_context: auth }).catch((e) => console.log("couldn't delete policy", e.message));
}
