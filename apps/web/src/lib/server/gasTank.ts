import "server-only";
import { parseEther } from "viem";
import { CHAIN_ID, serverClient } from "@/lib/config";
import { sendFromServerWallet } from "./privy";

/**
 * The gas tank: a Privy server wallet holding a little MON, whose Privy policy only lets it send plain MON transfers of
 * at most TOP_UP. Wallets that must pay their own gas (campaign bids signed through Privy so an aggregation can cap the
 * budget, and every server-wallet send where gas isn't sponsored) are topped up from it. Set up with
 * scripts/privy-gas-tank-setup.mjs; fund GAS_TANK_ADDRESS with MON.
 */
const TANK_ID = process.env.PRIVY_GAS_TANK_WALLET_ID ?? "";
const TANK = (process.env.GAS_TANK_ADDRESS ?? "") as `0x${string}` | "";
/** Keep in sync with the tank's Privy policy (value <= 0.05 MON). */
export const TOP_UP = parseEther("0.05");

export type GasState = "ok" | "no-tank" | "tank-empty";

/** Make sure `address` holds at least `need` wei of MON, topping it up once from the gas tank if not. */
export async function ensureGas(address: `0x${string}`, need: bigint): Promise<GasState> {
  const client = serverClient();
  const balance = await client.getBalance({ address });
  if (balance >= need) return "ok";
  if (!TANK_ID || !TANK) return "no-tank";
  if ((await client.getBalance({ address: TANK })) < TOP_UP) return "tank-empty";
  const { hash } = await sendFromServerWallet(TANK_ID, { to: address, data: "0x", chainId: CHAIN_ID, value: TOP_UP }, {
    // One top-up per (wallet, balance): a retried keeper tick doesn't send twice, the next real need does.
    idempotencyKey: `patched:${CHAIN_ID}:gas:${address}:${balance}`,
    sponsor: process.env.KEEPER_GAS_SPONSORED !== "false",
    signed: true,
  });
  if (hash) await client.waitForTransactionReceipt({ hash, timeout: 30_000 });
  return (await client.getBalance({ address })) >= need ? "ok" : "tank-empty";
}
