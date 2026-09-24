// Allow the keeper on another chain: add a rule to the existing keeper policy for that chain's market.
// The new rule has the same limits (closeBidding / release / markFailed only). Run from apps/web:
//   node scripts/privy-keeper-add-chain.mjs 143
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivyClient } from "@privy-io/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const chainId = Number(process.argv[2]);
if (!chainId) throw new Error("usage: node scripts/privy-keeper-add-chain.mjs <chainId>");
const addresses = readFileSync(join(root, "packages", "shared", "src", "addresses.ts"), "utf8");
// Match the key at the start of a line so "143" does not match inside "10143".
const market = addresses.slice(addresses.indexOf(`\n  ${chainId}: {`)).match(/market: "(0x[0-9a-fA-F]{40})"/)?.[1]?.toLowerCase();
if (!market) throw new Error(`no market for chain ${chainId}`);

const keeperAbi = [
  { type: "function", name: "closeBidding", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "release", inputs: [{ name: "id", type: "uint256" }, { name: "milestone", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "markFailed", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
];

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
const policyId = process.env.PRIVY_KEEPER_POLICY_ID;
const policy = await privy.policies().get(policyId);
const has = policy.rules.some(
  (r) =>
    r.conditions.some((c) => c.field === "chain_id" && c.value === String(chainId)) &&
    r.conditions.some((c) => c.field === "to" && String(c.value).toLowerCase() === market),
);
if (has) {
  console.log(`policy ${policyId} already allows chain ${chainId}`);
  process.exit(0);
}

const rule = await privy.policies().createRule(policyId, {
  name: `Patched market maintenance (chain ${chainId})`,
  method: "eth_sendTransaction",
  action: "ALLOW",
  conditions: [
    { field_source: "ethereum_transaction", field: "to", operator: "eq", value: market },
    { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(chainId) },
    { field_source: "ethereum_calldata", field: "function_name", operator: "in", value: ["closeBidding", "release", "markFailed"], abi: keeperAbi },
  ],
  // The policy is owned by the authorization key, so changes must be signed with it.
  authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY] },
});
console.log("added rule", rule.id, "for", market, "on chain", chainId);
