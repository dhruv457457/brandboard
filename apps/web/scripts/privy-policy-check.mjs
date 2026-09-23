// Negative test: the keeper wallet must NOT be able to send anything except the 3 allowed market calls.
// Tries a USDC transfer out of the keeper wallet; the Privy policy should reject it. Run from apps/web:
//   node scripts/privy-policy-check.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeFunctionData, erc20Abi } from "viem";
import { PrivyClient } from "@privy-io/node";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });
const usdc = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const market = "0xd3808dE425493934f036f8E77ef5a4de332e9552";

// Both calls would succeed on-chain (so Privy's pre-send simulation passes); only the policy can stop them.
const attempts = [
  {
    name: "USDC approve (wrong contract)",
    to: usdc,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: ["0x000000000000000000000000000000000000dEaD", 1n] }),
  },
  {
    name: "market setBrandName (right contract, function not allowed)",
    to: market,
    data: encodeFunctionData({
      abi: [{ type: "function", name: "setBrandName", inputs: [{ name: "name", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "setBrandName",
      args: ["0x7465737400000000000000000000000000000000000000000000000000000000"],
    }),
  },
];

for (const a of attempts) {
  try {
    const res = await privy.wallets().ethereum().sendTransaction(process.env.PRIVY_SERVER_WALLET_ID, {
      caip2: "eip155:10143",
      params: { transaction: { to: a.to, data: a.data, chain_id: 10143 } },
      sponsor: true,
    });
    console.log(`UNEXPECTED: ${a.name} was allowed`, res.transaction_id ?? res.hash);
    process.exitCode = 1;
  } catch (err) {
    console.log(`${a.name}: blocked (${err.status}) ${JSON.stringify(err.error ?? err.message)}`);
  }
}
