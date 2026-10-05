// Auto-approver: a Privy server wallet that opens new listings (approveListing) and does nothing else. Listings need no
// review, so this wallet is what moves each one from Pending to Active within seconds of being published.
// Its Privy policy allows exactly one call on each chain's market. Run once from apps/web, put the printed lines in
// .env.local / Vercel, then grant the wallet ADMIN_ROLE on each market with the deployer key (the command is printed).
//   node scripts/privy-approver-setup.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { PrivyClient } from "@privy-io/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const ABI = [
  { type: "function", name: "approveListing", inputs: [{ name: "id", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
];
const FNS = ABI.map((f) => f.name);

// Every chain's market from packages/shared/src/addresses.ts (plain text match, like the keeper scripts).
const addresses = readFileSync(join(root, "packages", "shared", "src", "addresses.ts"), "utf8");
const markets = [];
for (const chainId of [10143, 143]) {
  const section = addresses.slice(addresses.indexOf(`\n  ${chainId}: {`));
  const market = section.match(/market: "(0x[0-9a-fA-F]{40})"/)?.[1];
  if (market) markets.push({ chainId, market: market.toLowerCase() });
}

const der = Buffer.from(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY.replace(/^wallet-auth:/, ""), "base64");
const owner = { public_key: createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64") };
const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });

let walletId = process.env.PRIVY_APPROVER_WALLET_ID;
let address = process.env.APPROVER_ADDRESS;
if (!walletId) {
  const policy = await privy.policies().create({
    version: "1.0",
    name: "Auto-approver",
    chain_type: "ethereum",
    owner,
    rules: markets.map(({ chainId, market }) => ({
      name: `Open listings on market c${chainId}`,
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [
        { field_source: "ethereum_transaction", field: "to", operator: "eq", value: market },
        { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(chainId) },
        { field_source: "ethereum_calldata", field: "function_name", operator: "in", value: FNS, abi: ABI },
      ],
    })),
  });
  const wallet = await privy.wallets().create({ chain_type: "ethereum", display_name: "Patched auto-approver", owner, policy_ids: [policy.id] });
  walletId = wallet.id;
  address = wallet.address;
  console.log("Add to .env.local and Vercel:");
  console.log(`PRIVY_APPROVER_WALLET_ID=${walletId}\nAPPROVER_ADDRESS=${address}\n`);
}
console.log("Then grant it ADMIN_ROLE with the deployer key (once per market):");
for (const { chainId, market } of markets) {
  console.log(`  cast send ${market} "grantRole(bytes32,address)" $(cast keccak ADMIN_ROLE) ${address} --rpc-url <chain ${chainId} RPC> --private-key $DEPLOYER_PRIVATE_KEY`);
}
