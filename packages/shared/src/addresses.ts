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
  /** PatchSpotter for this market (on-chain "spotted" photos), and the block it was deployed in. */
  spotter?: Address;
  spotterBlock?: number;
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
    renderer: "0x6277d2FddAec00DE17C3eBa299FbfAe6F6783B80", // trading-card art, swapped in 2026-10-09
    livingPatch: true,
    usdc: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    deployBlock: 66627600,
    autoBidder: "0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c",
    autoBidderBlock: 66627730,
    sweeper: "0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B",
    spotter: "0x0C063771aFEe7f391DC4E851A39ba092ba3f3A44",
    spotterBlock: 69228493,
    approvals: true,
  },
  // Monad mainnet, real USDC (Circle's native USDC, 6 decimals). Deployed 2026-10-08, all in one go with
  // script/DeployMainnet.s.sol: fee 1%, royalty 5%, step +5% or $1, creator stake $5, new creators capped at $200 of
  // buy-now, 5 min anti-snipe, 72 h dispute window. Owner and treasury: the deployer 0x687C6533Ae1567e298964d77392d3fB9BaCE619C.
  // The earlier TestUSD test run (market 0xcBE6fA620fc6F61192a94CFbd33aae7893579a56, receipt 0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97,
  // tUSD 0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f) is retired.
  143: {
    market: "0xf10a7E612579456401E4d59df7d446158FE7ee9F",
    receipt: "0x6a8CD838489dbafB974A2cB08C86847BE55ea95c",
    renderer: "0x1D864f5b369D63287532D0CC8ed59b057666d540", // trading-card art, swapped in 2026-10-09
    livingPatch: true,
    usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
    deployBlock: 111660653,
    autoBidder: "0xD0779dC4E1EE6626E76ec54E7A356877bfc0F47a",
    autoBidderBlock: 111660905,
    sweeper: "0xB508530bC1752583E6A04b1A9d6c82d9dd7eA4C5",
    spotter: "0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA",
    spotterBlock: 111660966,
    approvals: true,
  },
};
