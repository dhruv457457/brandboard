// Create an app-controlled keeper wallet (no owner key) bound to the existing keeper policy, and
// switch .env.local to it. The policy still restricts it to closeBidding/release/markFailed on the
// market; only the app secret (server-side) can use it. Run from apps/web:
//   node scripts/privy-keeper-wallet.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrivyClient } from "@privy-io/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const envPath = join(root, ".env.local");
let env = readFileSync(envPath, "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
const wallet = await privy.wallets().create({
  chain_type: "ethereum",
  display_name: "Patched keeper (app-controlled)",
  policy_ids: [process.env.PRIVY_KEEPER_POLICY_ID],
});
console.log("wallet", wallet.id, wallet.address);

env = env
  .replace(/^PRIVY_SERVER_WALLET_ID=.*$/m, `PRIVY_SERVER_WALLET_ID=${wallet.id}`)
  .replace(/^KEEPER_ADDRESS=.*$/m, `KEEPER_ADDRESS=${wallet.address}`);
if (!/^KEEPER_USES_AUTH_KEY=/m.test(env)) env += "KEEPER_USES_AUTH_KEY=false\n";
writeFileSync(envPath, env);
console.log("updated .env.local");
