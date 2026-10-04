// Updated after each deploy (contracts/script/Deploy.s.sol). See docs/contracts.md → Deployments.
import type { Address } from "./types";

export interface PatchedDeployment {
  market: Address;
  /** The receipt new listings mint on. Listings created before the Living Patch upgrade keep `legacyReceipt`; ask the market (`receiptFor`) which one holds a token. */
  receipt: Address;
  legacyReceipt?: Address;
  /** PatchRenderer: draws the receipt NFTs. */
  renderer?: Address;
  usdc: Address;
  deployBlock: number;
  /** PatchAutoBidder for this market ("keep me on top up to $X"), and the block it was deployed in. */
  autoBidder?: Address;
  autoBidderBlock?: number;
  /** PatchSweeper for this market (several patches in one transaction). */
  sweeper?: Address;
  /** True once this market has `approveProof` and `minDisputeWindow` (brands can accept a proof early). */
  approvals?: boolean;
  /** True once this market is upgraded to the Living Patch (`submitProof` with a cover image, `tokenView`, `receiptFor`). */
  livingPatch?: boolean;
  /** True when `usdc` is the TestUSD faucet token rather than real USDC. */
  testToken?: boolean;
}

export const DEPLOYMENTS: Record<number, PatchedDeployment | undefined> = {
  // Monad testnet: v3, deployed 2026-09-29. PatchedMarket is an upgradeable proxy (UUPS): `market` stays the same
  // address across upgrades. Previous (non-proxy) v2 market: 0xd3808dE425493934f036f8E77ef5a4de332e9552.
  10143: {
    market: "0x2AaC6f2E5221078982736F33271CD6484d0cd005",
    // Living Patch upgrade 2026-10-04: new receipt + renderer. Listings 1-10 keep their tokens on the first receipt.
    receipt: "0x6c406F518E5A863C3c536aD398BA67F8c8Ae5F3A",
    legacyReceipt: "0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e",
    renderer: "0x59171aEA5658B057BD8eC1F948672a3Aeb06F7fe",
    livingPatch: true,
    usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    deployBlock: 66627600,
    autoBidder: "0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c",
    autoBidderBlock: 66627730,
    sweeper: "0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B",
    approvals: true,
  },
  // Monad mainnet, test run with TestUSD (tUSD, faucet token), deployed 2026-09-24, verified on Sourcify.
  // Real-USDC deployment for later: market 0xCB44d40E69Dc267e9C7CF65d89f22857e3d82aed,
  // receipt 0xa6e439a22aad8fc7f596a92B5900D7b8724A01F5, usdc 0x754704Bc059F8C67012fEd69BC8A327a5aafb603, block 107361531.
  143: {
    market: "0xcBE6fA620fc6F61192a94CFbd33aae7893579a56",
    receipt: "0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97",
    usdc: "0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f",
    deployBlock: 107528109,
    autoBidder: "0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1",
    autoBidderBlock: 107531645,
    sweeper: "0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba",
    testToken: true,
  },
};
