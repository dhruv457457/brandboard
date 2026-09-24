// Updated after each deploy (contracts/script/Deploy.s.sol). See docs/contracts.md → Deployments.
import type { Address } from "./types";

export interface PatchedDeployment {
  market: Address;
  receipt: Address;
  usdc: Address;
  deployBlock: number;
  /** True when `usdc` is the TestUSD faucet token rather than real USDC. */
  testToken?: boolean;
}

export const DEPLOYMENTS: Record<number, PatchedDeployment | undefined> = {
  // Monad testnet — v2 with bidFor, deployed 2026-09-23, verified on Sourcify (exact match)
  10143: {
    market: "0xd3808dE425493934f036f8E77ef5a4de332e9552",
    receipt: "0x598Ea7C3Cf739Dbea1B809d5Cd0174818b680a8f",
    usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    deployBlock: 65054031,
  },
  // Monad mainnet, test run with TestUSD (tUSD, faucet token), deployed 2026-09-24, verified on Sourcify.
  // Real-USDC deployment for later: market 0xCB44d40E69Dc267e9C7CF65d89f22857e3d82aed,
  // receipt 0xa6e439a22aad8fc7f596a92B5900D7b8724A01F5, usdc 0x754704Bc059F8C67012fEd69BC8A327a5aafb603, block 107361531.
  143: {
    market: "0xcBE6fA620fc6F61192a94CFbd33aae7893579a56",
    receipt: "0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97",
    usdc: "0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f",
    deployBlock: 107528109,
    testToken: true,
  },
};
