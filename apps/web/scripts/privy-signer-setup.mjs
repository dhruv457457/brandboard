// Register the key quorum that Patched uses as a signer on brands' wallets (auto-bid through signers).
// It wraps the public half of PRIVY_AUTHORIZATION_PRIVATE_KEY, so the server signs as this quorum.
// Run once from apps/web, then put the printed id in .env.local:
//   node scripts/privy-signer-setup.mjs
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

if (process.env.PRIVY_SIGNER_QUORUM_ID) {
  console.log("already set: PRIVY_SIGNER_QUORUM_ID =", process.env.PRIVY_SIGNER_QUORUM_ID);
  process.exit(0);
}

const der = Buffer.from(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY.replace(/^wallet-auth:/, ""), "base64");
const publicKey = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" }))
  .export({ format: "der", type: "spki" })
  .toString("base64");

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
const quorum = await privy.keyQuorums().create({
  display_name: "Patched auto-bid signer",
  public_keys: [publicKey],
  authorization_threshold: 1,
});
console.log("Add to .env.local:");
console.log(`PRIVY_SIGNER_QUORUM_ID=${quorum.id}`);
console.log(`NEXT_PUBLIC_PRIVY_SIGNER_ID=${quorum.id}`);
