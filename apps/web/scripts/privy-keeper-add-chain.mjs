// Allow the keeper on a chain: make sure the keeper policy has a rule for that chain's market
// (closeBidding / release / markFailed only) and, if deployed, its auto-bidder (execute only). Run from apps/web:
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
const section = addresses.slice(addresses.indexOf(`
  ${chainId}: {`));
const pick = (key) => section.match(new RegExp(`${key}: "(0x[0-9a-fA-F]{40})"`))?.[1]?.toLowerCase();
const market = pick("market");
const autoBidder = pick("autoBidder");
if (!market) throw new Error(`no market for chain ${chainId}`);

const keeperAbi = [
  { type: "function", name: "closeBidding", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "release", inputs: [{ name: "id", type: "uint256" }, { name: "milestone", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "markFailed", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
];
const autoBidAbi = [
  {
    type: "function", name: "execute", outputs: [{ name: "amount", type: "uint96" }], stateMutability: "nonpayable",
    inputs: [{ name: "brand", type: "address" }, { name: "listingId", type: "uint256" }, { name: "patchId", type: "uint8" }],
  },
];

// One rule per contract: the market for maintenance calls, the auto-bidder for execute() only.
const wanted = [
  { name: `Patched market maintenance (chain ${chainId})`, to: market, abi: keeperAbi, fns: ["closeBidding", "release", "markFailed"] },
  ...(autoBidder ? [{ name: `Patched auto-bid (chain ${chainId})`, to: autoBidder, abi: autoBidAbi, fns: ["execute"] }] : []),
];

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
const policyId = process.env.PRIVY_KEEPER_POLICY_ID;
const policy = await privy.policies().get(policyId);
for (const w of wanted) {
  const has = policy.rules.some(
    (r) =>
      r.conditions.some((c) => c.field === "chain_id" && c.value === String(chainId)) &&
      r.conditions.some((c) => c.field === "to" && String(c.value).toLowerCase() === w.to),
  );
  if (has) {
    console.log(`already allowed: ${w.name}`);
    continue;
  }
  const rule = await privy.policies().createRule(policyId, {
    name: w.name,
    method: "eth_sendTransaction",
    action: "ALLOW",
    conditions: [
      { field_source: "ethereum_transaction", field: "to", operator: "eq", value: w.to },
      { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(chainId) },
      { field_source: "ethereum_calldata", field: "function_name", operator: "in", value: w.fns, abi: w.abi },
    ],
    // The policy is owned by the authorization key, so changes must be signed with it.
    authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY] },
  });
  console.log("added rule", rule.id, `(${w.name})`, "for", w.to);
}
