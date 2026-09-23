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
export const USDC = deployment.usdc;
export { USDC_DECIMALS };

export const EXPLORER = CHAIN_ID === 143 ? "https://monadvision.com" : "https://testnet.monadvision.com";

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
