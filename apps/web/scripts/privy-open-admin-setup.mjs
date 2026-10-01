// Open admin (hackathon demo): a Privy server wallet that does admin work for anyone while OPEN_ADMIN=true.
// Its Privy policy only allows the everyday admin calls on our market: approve or reject a listing, fast-track a
// milestone, settle a dispute, create an event, open or close an event. No pause, fees, treasury, roles or upgrades.
// Run once from apps/web, put the printed lines in .env.local / Vercel, then grant the wallet ADMIN_ROLE on each market
// with the deployer key (the command is printed). Turn it off after judging: OPEN_ADMIN=false and revokeRole.
//   node scripts/privy-open-admin-setup.mjs
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
  { type: "function", name: "rejectListing", inputs: [{ name: "id", type: "uint256" }, { name: "reasonCode", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "fastTrack", inputs: [{ name: "id", type: "uint256" }, { name: "milestone", type: "uint8" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "resolveDispute", inputs: [{ name: "id", type: "uint256" }, { name: "milestone", type: "uint8" }, { name: "patchId", type: "uint8" }, { name: "creatorShareBps", type: "uint16" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "createEvent", inputs: [{ name: "name", type: "bytes32" }, { name: "startsAt", type: "uint40" }, { name: "endsAt", type: "uint40" }], outputs: [{ name: "", type: "uint32" }], stateMutability: "nonpayable" },
  { type: "function", name: "setEventActive", inputs: [{ name: "eventId", type: "uint32" }, { name: "active", type: "bool" }], outputs: [], stateMutability: "nonpayable" },
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

let walletId = process.env.PRIVY_OPEN_ADMIN_WALLET_ID;
let address = process.env.OPEN_ADMIN_ADDRESS;
if (!walletId) {
  const policy = await privy.policies().create({
    version: "1.0",
    name: "Open admin (demo)",
    chain_type: "ethereum",
    owner,
    rules: markets.map(({ chainId, market }) => ({
      name: `Everyday admin calls on market c${chainId}`,
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [
        { field_source: "ethereum_transaction", field: "to", operator: "eq", value: market },
        { field_source: "ethereum_transaction", field: "chain_id", operator: "eq", value: String(chainId) },
        { field_source: "ethereum_calldata", field: "function_name", operator: "in", value: FNS, abi: ABI },
      ],
    })),
  });
  const wallet = await privy.wallets().create({ chain_type: "ethereum", display_name: "Patched open admin (demo)", owner, policy_ids: [policy.id] });
  walletId = wallet.id;
  address = wallet.address;
  console.log("Add to .env.local and Vercel:");
  console.log(`OPEN_ADMIN=true\nNEXT_PUBLIC_OPEN_ADMIN=true\nPRIVY_OPEN_ADMIN_WALLET_ID=${walletId}\nOPEN_ADMIN_ADDRESS=${address}\n`);
}
console.log("Then grant it ADMIN_ROLE with the deployer key (once per market):");
for (const { chainId, market } of markets) {
  console.log(`  cast send ${market} "grantRole(bytes32,address)" $(cast keccak ADMIN_ROLE) ${address} --rpc-url <chain ${chainId} RPC> --private-key $DEPLOYER_PRIVATE_KEY`);
}
console.log("After judging: cast send <market> \"revokeRole(bytes32,address)\" $(cast keccak ADMIN_ROLE) " + address + " ... and OPEN_ADMIN=false.");
