// Which chain and contracts this build talks to. Everything chain-specific comes from here.
import { createPublicClient, http, type PublicClient } from "viem";
import { DEPLOYMENTS, monadMainnet, monadTestnet, USDC_DECIMALS } from "@patched/shared";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143) as 10143 | 143;
export const CHAIN = CHAIN_ID === 143 ? monadMainnet : monadTestnet;

const deployment = DEPLOYMENTS[CHAIN_ID];
if (!deployment) throw new Error(`No Patched deployment for chain ${CHAIN_ID}`);
export const DEPLOYMENT = deployment;
export const MARKET = deployment.market;
export const RECEIPT = deployment.receipt;
/** PatchAutoBidder for this market, if deployed. */
export const AUTO_BIDDER = deployment.autoBidder ?? null;
/** PatchSweeper for this market, if deployed. */
export const SWEEPER = deployment.sweeper ?? null;
export const USDC = deployment.usdc;
/** The dollar token is the TestUSD faucet token (mainnet test run), not real USDC. */
export const TEST_TOKEN = deployment.testToken === true;
export { USDC_DECIMALS };

/** Whether Privy pays gas for embedded wallets. Off: every wallet pays its own gas in MON. */
export const GAS_SPONSORED = process.env.NEXT_PUBLIC_GAS_SPONSORED !== "false";

export const EXPLORER = CHAIN_ID === 143 ? "https://monadvision.com" : "https://testnet.monadvision.com";

/**
 * Testnet and mainnet run as two sites from this same code. The navbar's network switch sends people to the
 * other one; set both URLs in production (the defaults are the two local dev servers).
 */
export const NETWORK_SITES: Record<10143 | 143, { label: string; url: string }> = {
  10143: { label: "Testnet", url: process.env.NEXT_PUBLIC_TESTNET_URL ?? "http://localhost:3100" },
  143: { label: "Mainnet", url: process.env.NEXT_PUBLIC_MAINNET_URL ?? "http://localhost:3200" },
};

/** Browser-safe client on the public RPC. Server code uses serverClient() with the private QuickNode URL. */
export const publicClient = createPublicClient({ chain: CHAIN, transport: http() }) as PublicClient;

export function serverRpcUrl(): string {
  const url = CHAIN_ID === 143 ? process.env.MONAD_MAINNET_RPC_URL : process.env.MONAD_TESTNET_RPC_URL;
  if (!url) throw new Error("RPC url missing in .env.local");
  return url;
}

export function serverClient(): PublicClient {
  return createPublicClient({ chain: CHAIN, transport: http(serverRpcUrl()) }) as PublicClient;
}
