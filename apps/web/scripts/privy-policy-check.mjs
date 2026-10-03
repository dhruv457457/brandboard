// Checks the keeper's Privy policy against the current deployment in packages/shared/src/addresses.ts:
// 1. the policy has rules for this chain's market and auto-bidder (else the keeper can't close, release or auto-bid);
// 2. negative test: the keeper wallet must NOT be able to send anything except the 3 allowed market calls
//    and PatchAutoBidder.execute.
// Run from apps/web (chain id defaults to testnet):
//   node scripts/privy-policy-check.mjs [chainId]
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

const chainId = Number(process.argv[2] ?? 10143);
const addresses = readFileSync(join(root, "packages", "shared", "src", "addresses.ts"), "utf8");
// Match the key at the start of a line so "143" does not match inside "10143".
const section = addresses.slice(addresses.indexOf(`
  ${chainId}: {`));
const pick = (key) => section.match(new RegExp(`${key}: "(0x[0-9a-fA-F]{40})"`))?.[1]?.toLowerCase();
const market = pick("market");
const autoBidder = pick("autoBidder");
const usdc = pick("usdc");
if (!market || !usdc) throw new Error(`no deployment for chain ${chainId}`);

const privy = new PrivyClient({ appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID, appSecret: process.env.PRIVY_APP_SECRET });

const policy = await privy.policies().get(process.env.PRIVY_KEEPER_POLICY_ID);
for (const [name, to] of [["market", market], ["auto-bidder", autoBidder]]) {
  if (!to) continue;
  const allowed = policy.rules.some(
    (r) =>
      r.action === "ALLOW" &&
      r.conditions.some((c) => c.field === "chain_id" && c.value === String(chainId)) &&
      r.conditions.some((c) => c.field === "to" && String(c.value).toLowerCase() === to),
  );
  if (allowed) console.log(`policy allows the current ${name} (${to})`);
  else {
    console.log(`MISSING: no policy rule for the current ${name} (${to}). Run: node scripts/privy-keeper-add-chain.mjs ${chainId}`);
    process.exitCode = 1;
  }
}

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
  ...(autoBidder
    ? [{
        name: "auto-bidder setAutoBid (right contract, only execute is allowed)",
        to: autoBidder,
        data: encodeFunctionData({
          abi: [{ type: "function", name: "setAutoBid", inputs: [{ name: "listingId", type: "uint256" }, { name: "patchId", type: "uint8" }, { name: "max", type: "uint96" }], outputs: [], stateMutability: "nonpayable" }],
          functionName: "setAutoBid",
          args: [1n, 0, 1n],
        }),
      }]
    : []),
];

for (const a of attempts) {
  try {
    const res = await privy.wallets().ethereum().sendTransaction(process.env.PRIVY_SERVER_WALLET_ID, {
      caip2: `eip155:${chainId}`,
      params: { transaction: { to: a.to, data: a.data, chain_id: chainId } },
      sponsor: true,
      // Signed the way the keeper signs (unless its wallet is app-controlled), so a refusal comes from the policy
      // and not from a missing authorization signature.
      ...(process.env.KEEPER_USES_AUTH_KEY === "false"
        ? {}
        : { authorization_context: { authorization_private_keys: [process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY] } }),
    });
    console.log(`UNEXPECTED: ${a.name} was allowed`, res.transaction_id ?? res.hash);
    process.exitCode = 1;
  } catch (err) {
    console.log(`${a.name}: blocked (${err.status}) ${JSON.stringify(err.error ?? err.message)}`);
  }
}
