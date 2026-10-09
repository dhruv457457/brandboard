# 03 · Contracts and the chain

Solidity 0.8.28, Foundry, OpenZeppelin v5.4. **134 tests pass**: unit, fuzz (`LifecycleFuzz.t.sol`), a solvency invariant (`test/invariant/`), timing (`Timeline.t.sol`), upgrades (`Upgrade.t.sol`), the NFT (`LivingPatch.t.sol`, `PreviewArt.t.sol`) and fork tests (`test/fork/`). The full external API is [../contracts.md](../contracts.md); this file is the map.

## Why Monad

A live auction needs a bid to land in about a second and cost almost nothing, so the page can update while you watch and an outbid refund can happen in the same transaction. Monad gives that, and it's EVM, so standard Solidity and viem work as-is. USDC is native on Monad (Circle).

## The contracts

| Contract | What it does | Holds money? |
|---|---|---|
| `PatchedMarket` (`contracts/src/PatchedMarket.sol`) | Events, listings, per-spot auctions with anti-snipe, bids (plain, permit, `bidFor`), escrow, milestones, proofs, approvals, disputes, no-show refunds, creator stakes and records, resale with royalties, on-chain brand names, `tokenView` for the NFT. **UUPS upgradeable proxy.** | Yes, all of it |
| `PatchReceipt` | The Living Patch ERC-721: one token per won spot. ERC-2981 royalties, ERC-4906 refresh events, ERC-7572 `contractURI`. Only the market can mint or move tokens, so the resale royalty always applies. | No |
| `PatchRenderer` | Draws each token's SVG and metadata from the market's state, as a trading card. Swappable (`setRenderer`) so the art can change without touching a token. | No |
| `PatchAutoBidder` | Auto-bid for outside wallets: stores each brand's maximum; `execute()` (called by the keeper) bids the next step via `bidFor`, never above the maximum. | No |
| `PatchSweeper` | Several bids in one transaction, all or nothing (`sweep`, `sweepWithPermit`). | No |
| `PatchSpotter` | On-chain "spotted": `spot(listingId, photoHash, photoURI)`, one per wallet per listing, not by the creator or a team payee. Feeds the Patchwork graph. | No |
| `TestUSD` | A 6-decimal faucet token for test runs (retired on mainnet). | n/a |

Token ids: `tokenId = listingId << 8 | patchId`.

## Addresses (source of truth: `packages/shared/src/addresses.ts`)

### Monad mainnet (143), real Circle USDC (active, deployed 2026-10-08)

| | Address |
|---|---|
| PatchedMarket (proxy) | `0xf10a7E612579456401E4d59df7d446158FE7ee9F` (deploy block 111660653) |
| PatchReceipt | `0x6a8CD838489dbafB974A2cB08C86847BE55ea95c` |
| PatchRenderer | `0x1D864f5b369D63287532D0CC8ed59b057666d540` (trading-card art, swapped in 2026-10-09; the first was `0x655477765425bd1A2E1289af9760836E22eD4209`) |
| PatchAutoBidder | `0xD0779dC4E1EE6626E76ec54E7A356877bfc0F47a` |
| PatchSweeper | `0xB508530bC1752583E6A04b1A9d6c82d9dd7eA4C5` |
| PatchSpotter | `0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA` |
| USDC | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| Owner, admin, treasury | the deployer `0x687C6533Ae1567e298964d77392d3fB9BaCE619C` (one key; move to a multisig before real volume) |
| Approver (Privy server wallet, ADMIN_ROLE) | `0x9B32…1c95` |

**Parameters:** fee 1%, resale royalty 5%, step +5% (at least $1), creator stake $5, new creators capped at $200 of buy-now, anti-snipe 5 minutes, dispute window 72 hours. Deployed with `contracts/script/DeployMainnet.s.sol`. Explorer: `https://monadvision.com`.

Retired mainnet markets (don't use): the TestUSD run `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` and the older real-USDC market `0xCB44d40E69Dc267e9C7CF65d89f22857e3d82aed`.

### Monad testnet (10143), v3 (active)

| | Address |
|---|---|
| PatchedMarket (proxy) | `0x2AaC6f2E5221078982736F33271CD6484d0cd005` (deploy block 66627600) |
| PatchReceipt (listings 11 and later) | `0x6c406F518E5A863C3c536aD398BA67F8c8Ae5F3A` |
| PatchReceipt, first version (listings 1 to 10) | `0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e` |
| PatchRenderer | `0x6277d2FddAec00DE17C3eBa299FbfAe6F6783B80` |
| PatchAutoBidder | `0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c` |
| PatchSweeper | `0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B` |
| PatchSpotter | `0x0C063771aFEe7f391DC4E851A39ba092ba3f3A44` |
| USDC (Circle test USDC, faucet) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |

**Demo parameters:** stake $1, step $1, review 2 minutes, anti-snipe 1 minute, so a full cycle fits in about 30 minutes. Explorer: `https://testnet.monadvision.com`. The old v2 market (not a proxy) was `0xd3808dE425493934f036f8E77ef5a4de332e9552`.

## How money moves

| Moment | Call | Who sends it | Money |
|---|---|---|---|
| List | `createListing` | creator | stake pulled into the market |
| Go live | `approveListing` | approver server wallet (Privy) | none |
| Bid | `bid` / `bidWithPermit` / `bidFor` | brand, auto-bid signer, `PatchAutoBidder`, sweeper, campaign wallet | bid pulled in; previous leader refunded in the same tx (or credited to `refundable` if the push fails) |
| Buy now | a bid ≥ buy-now | brand | pays buy-now; extra forwarded back |
| Close | `closeBidding` | keeper | winning bids become escrow; NFTs minted; unsold returns the stake |
| Proof | `submitProof` | creator | none; starts the 72 h review |
| Approve / dispute | `approveProof` / `dispute` | NFT holder | none |
| Settle | `resolveDispute` / `settleStale` | admin / anyone after 30 days | split between creator and holder |
| Pay | `release` | keeper | milestone share to creator or payees, minus 1% fee to treasury; last one returns the stake |
| No-show | `markFailed` | keeper | unreleased escrow and the stake to the holders |
| Resale | `listForResale` / `buyResale` | holder / buyer | price to seller, 5% royalty to creator or payees |

Safety rules (from a mentor review and `Timeline.t.sol`):
- If the first proof deadline is under an hour away at close, all deadlines move later together. A bidder can't stretch the auction past the creator's deadline and then take the stake.
- A deadline that fell during a pause counts as 24 hours after the unpause.
- Each listing keeps the fee and dispute window it was created under.

## The Living Patch (NFT)

- **Stage** comes from the listing; it isn't stored: Won → Printed → Seen n/m → Delivered, or Refunded, or Disputed.
- The renderer draws a **trading card**:
  - the garment (denim, racing paint or fleece) with the brand's embroidered patch;
  - a price coin;
  - a four-step track;
  - passport stamps for each proof.
- **Thread by price:** cotton under $100, silk to $999, gold from $1,000.
- **Sponsor number:** "No.001, FIRST SPONSOR OF @creator".
- Each stage change calls `PatchReceipt.refresh(listingId)` (ERC-4906), so marketplaces redraw.
- **Proofs are checkable:** `proofURI` is `ipfs://<record>` and `proofHash` is `keccak256` of the exact bytes. The `/patch/<id>` page re-hashes it in the browser.
- **Names on-chain:** `setBrandName` gives one name per wallet, used for both roles. The website prefers profile names: the creator's handle and the brand's name.

## Upgrades and scripts (`contracts/script/`)

| Script | What |
|---|---|
| `Deploy.s.sol` | fresh testnet deploy |
| `DeployMainnet.s.sol` | the whole mainnet suite in one go |
| `UpgradeMarket.s.sol` | swap the market logic behind the proxy (checks listing count, escrow and fee unchanged) |
| `UpgradeReceipt.s.sol` | move a live market to a new receipt (Living Patch); old tokens stay on `legacyReceipt` |
| `SwapRenderer.s.sol` | new art without touching tokens |
| `DeployAutoBidder.s.sol`, `DeploySweeper.s.sol`, `DeploySpotter.s.sol` | the helper contracts |
| `QuickListing.s.sol`, `Seed.s.sol` | test listings |

**Upgrade rules:**
- Append new state variables at the end only; never reorder or remove.
- Add an upgrade test.
- `freezeUpgrades()` ends upgrades for good (or put the admin behind a multisig and timelock).
- The market is over 24 KB: pass `--code-size-limit 131072`.

**After any contract change:**
1. `forge test`.
2. Regenerate the ABIs into `packages/shared`.
3. Update [../contracts.md](../contracts.md) and this file.

## Monad quirks we hit

- **Gas estimates run low.** A `setParams` call in the mainnet deploy ran out of gas. Resend with `cast send --gas-limit 300000`, or run forge with `--gas-estimate-multiplier 300`.
- Viem's Monad chain config has **no multicall address**, so token reads run in parallel instead (`readTokenViews`).
- On a fresh chain the deployer's first contract gets the same address on testnet and mainnet. Always pick addresses by chain id.

## Proof that it works

- **25 testnet transactions** covering the whole loop with the Privy test account as the brand: [../evidence.md](../evidence.md), summarised in the README's "Verify it yourself".
  - They cover: listing, approval through open admin, a silent sponsored bid, an outbid refund, a signer auto-bid, a sweep, campaign bids with the budget refusing the next one, an X offer, the keeper closing 8 seconds after the end, a proof, a dispute and split, and the last payout returning the stake.
- Re-run it with `apps/web/scripts/onchain-cycle.mts` (creator, admin, rivals) and `apps/web/scripts/browser-steps.mjs` (the brand, in a browser).
- **Mainnet:** contracts live, no real cycle yet. To do: one real $5 cycle (list, bid, outbid, close, proof, pay), with the hashes added to `docs/evidence.md` under a mainnet heading.
- **Verification:** the mainnet contracts of 2026-10-08 are not yet verified on a block explorer. To do: Sourcify, as was done for the earlier markets.
