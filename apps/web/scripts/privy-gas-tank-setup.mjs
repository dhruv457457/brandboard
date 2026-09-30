// Create the gas tank: a Privy server wallet whose policy only allows sending at most 0.05 MON per transaction.
// It tops up wallets that pay their own gas (campaign bids signed through Privy, and unsponsored server sends).
// Run once from apps/web, put the printed lines in .env.local, then fund GAS_TANK_ADDRESS with MON on each chain:
//   node scripts/privy-gas-tank-setup.mjs
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
if (process.env.PRIVY_GAS_TANK_WALLET_ID) {
  console.log("already set: PRIVY_GAS_TANK_WALLET_ID =", process.env.PRIVY_GAS_TANK_WALLET_ID, "address", process.env.GAS_TANK_ADDRESS);
  process.exit(0);
}

const der = Buffer.from(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY.replace(/^wallet-auth:/, ""), "base64");
const owner = {
  public_key: createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({ format: "der", type: "spki" }).toString("base64"),
};
const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });

const policy = await privy.policies().create({
  version: "1.0",
  name: "Patched gas tank",
  chain_type: "ethereum",
  owner,
  rules: [
    {
      name: "Plain MON top-ups of at most 0.05 MON",
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [{ field_source: "ethereum_transaction", field: "value", operator: "lte", value: "50000000000000000" }],
    },
  ],
});
const wallet = await privy.wallets().create({ chain_type: "ethereum", display_name: "Patched gas tank", owner, policy_ids: [policy.id] });
console.log("Add to .env.local (and the host's env):");
console.log(`PRIVY_GAS_TANK_WALLET_ID=${wallet.id}`);
console.log(`GAS_TANK_ADDRESS=${wallet.address}`);
console.log(`Then send MON to ${wallet.address} on each chain you run (testnet faucet: https://faucet.monad.xyz).`);
