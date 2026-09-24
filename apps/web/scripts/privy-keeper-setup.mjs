// One-time setup: create the keeper's Privy server wallet with a policy that only allows
// closeBidding / release / markFailed on the Patched market. Run from apps/web:
//   node scripts/privy-keeper-setup.mjs
// Appends PRIVY_KEEPER_POLICY_ID, PRIVY_SERVER_WALLET_ID, KEEPER_ADDRESS and KEEPER_SECRET to the root .env.local.
import { appendFileSync, readFileSync } from "node:fs";
import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivyClient } from "@privy-io/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envPath = join(root, ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
if (process.env.PRIVY_SERVER_WALLET_ID) {
  console.log("PRIVY_SERVER_WALLET_ID is already set, nothing to do:", process.env.PRIVY_SERVER_WALLET_ID);
  process.exit(0);
}

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
// Read the market address for this chain from packages/shared/src/addresses.ts (plain text match).
const addresses = readFileSync(join(root, "packages", "shared", "src", "addresses.ts"), "utf8");
// Match the key at the start of a line so "143" does not match inside "10143".
const section = addresses.slice(addresses.indexOf(`\n  ${chainId}: {`));
const market = (section.match(/market: "(0x[0-9a-fA-F]{40})"/)?.[1] ?? process.env.KEEPER_MARKET_ADDRESS)?.toLowerCase();
if (!market) throw new Error("market address unknown");

const keeperAbi = [
  { type: "function", name: "closeBidding", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "release", inputs: [{ name: "id", type: "uint256" }, { name: "milestone", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "markFailed", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
];

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
// The wallet and policy are owned by the P-256 authorization key: only requests signed with
// PRIVY_AUTHORIZATION_PRIVATE_KEY can use the wallet or change its policy.
const der = Buffer.from(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY.replace(/^wallet-auth:/, ""), "base64");
const publicKey = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" }))
  .export({ format: "der", type: "spki" })
  .toString("base64");
const owner = { public_key: publicKey };

const policy = await privy.policies().create({
  version: "1.0",
  name: `Patched keeper (chain ${chainId})`,
  chain_type: "ethereum",
  owner,
  rules: [
    {
      name: "Only Patched market maintenance calls",
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [
        { field_source: "ethereum_transaction", field: "to", operator: "eq", value: market },
        { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(chainId) },
        { field_source: "ethereum_calldata", field: "function_name", operator: "in", value: ["closeBidding", "release", "markFailed"], abi: keeperAbi },
      ],
    },
  ],
});
console.log("policy", policy.id);

const wallet = await privy.wallets().create({
  chain_type: "ethereum",
  display_name: "Patched keeper",
  owner,
  policy_ids: [policy.id],
});
console.log("wallet", wallet.id, wallet.address);

appendFileSync(
  envPath,
  `\n# Keeper (Privy server wallet, policy-limited to closeBidding/release/markFailed)\n` +
    `PRIVY_KEEPER_POLICY_ID=${policy.id}\nPRIVY_SERVER_WALLET_ID=${wallet.id}\nKEEPER_ADDRESS=${wallet.address}\n` +
    `KEEPER_SECRET=${randomBytes(24).toString("hex")}\n`,
);
console.log("saved to .env.local");
