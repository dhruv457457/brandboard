# Contracts — external API

Status: **Implemented and tested** (56 tests incl. fuzzing and a solvency invariant). ABIs are exported to `@patched/shared` (`patchedMarketAbi`, `patchReceiptAbi`). If the API has to change, this file changes first and the change is announced in `docs/requests.md`.

Three contracts:

- `PatchedMarket` — holds all USDC: events, listings, per-patch auctions, escrow, milestones, disputes, bonds, resale, reputation.
- `PatchReceipt` — the Living Patch: ERC-721, one token per won patch. Only the market can mint or move tokens (so resale royalties are enforced). ERC-2981 royalties, ERC-4906 refresh events and ERC-7572 `contractURI`. The picture is drawn on-chain and changes as the creator proves each step. See [The Living Patch](#the-living-patch).
- `PatchRenderer` — draws a receipt token's metadata and SVG from the market's state. Swappable by the receipt's owner (`setRenderer`), so the art can be fixed without touching a token.

All amounts are USDC with **6 decimals** (`uint96` / `uint64`). All times are unix seconds (`uint40`).

## Enums

```solidity
enum Surface { Outfit, Car, Hoodie }
enum Status  { Pending, Active, Delivering, Completed, Failed, Cancelled, Rejected, Unsold }
enum MilestoneStatus { Open, Submitted, Released }
```

## Structs (returned by views)

```solidity
struct EventInfo { bytes32 name; uint40 startsAt; uint40 endsAt; bool active; }

struct Listing {
    address creator;
    uint40  biddingEndsAt;   // moves forward with anti-snipe
    uint40  hardEndsAt;      // anti-snipe never goes past this
    Status  status;
    Surface surface;
    uint32  eventId;         // 0 = no event (cars)
    uint8   patchCount;      // 1..16
    uint8   milestoneCount;  // 1..8
    uint8   nextMilestone;   // index of the milestone currently being worked on
    uint16  soldMask;        // bit i = patch i was won
    uint64  bond;
    uint96  totalEscrow;     // sum of winning bids, set at close
    uint16[8] milestoneBps;  // sums to 10000
    uint40[8] deadlines;     // proof deadline per milestone
    bytes32 metadataHash;    // keccak256 of the off-chain listing JSON
}

struct Patch {
    address topBidder;
    uint96  topBid;
    uint96  floor;
    uint96  buyNow;
    uint40  lastBidAt;
    bool    bought;
    bytes32 label;           // short name, e.g. "Neckline"
}

struct Milestone {
    MilestoneStatus status;
    uint40  reviewEndsAt;    // proof time + 72h (or now if fast-tracked)
    uint16  disputedMask;    // bit i = patch i disputed for this milestone
    uint16  resolvedMask;
    bytes32 proofHash;
}

struct ListingParams {
    Surface   surface;
    uint32    eventId;
    uint40    biddingEndsAt;
    uint64    bond;          // >= minBond
    uint96[]  floors;        // one per patch, > 0
    uint96[]  buyNows;       // one per patch, >= floor
    bytes32[] labels;        // one per patch
    uint16[]  milestoneBps;  // sums to 10000
    uint40[]  deadlines;     // strictly increasing, first > biddingEndsAt
    address[] payees;        // empty = creator gets 100%; else team split (max 8)
    uint16[]  shares;        // bps per payee, sums to 10000
    string    metadataURI;
    bytes32   metadataHash;
}
```

## Functions

### Anyone (usually called by the Privy server-wallet cron)
| Function | When |
|---|---|
| `closeBidding(uint256 listingId)` | status Active and (`now >= biddingEndsAt` or every patch bought). Mints receipts. → Delivering, or Unsold if nothing sold (bond returned). If the first proof deadline is less than `MIN_PROOF_WINDOW` (1 hour) away, every deadline moves later by the same amount (`DeadlinesShifted`), so late bids can't make honest delivery impossible. |
| `release(uint256 listingId, uint8 milestone)` | milestone Submitted and `now >= reviewEndsAt`. Pays creator/payees for non-disputed patches minus fee. Last milestone → Completed, bond returned. |
| `markFailed(uint256 listingId)` | Delivering, current milestone still Open and its deadline passed. Refunds unreleased money + bond to receipt holders. → Failed. A deadline that fell during a pause, or within `PAUSE_GRACE` (24 hours) after one, counts as 24 hours after the unpause. |
| `settleStale(uint256 listingId, uint8 milestone, uint8 patchId)` | A disputed patch still unresolved `DISPUTE_TIMEOUT` (30 days) after its review window: split 50/50 (creator's half minus the fee, the rest back to the holder). Reverts `DisputeNotStale` before that. |
| `withdraw()` | collect `refundable[msg.sender]` (only used if a direct refund transfer failed). |

### Creator
| Function | Notes |
|---|---|
| `createListing(ListingParams p) returns (uint256 listingId)` | pulls `bond` USDC (approve first or batch). Status Pending. New creators (0 completed) are capped: sum of buyNows <= `newCreatorCap`. |
| `cancelListing(uint256 listingId)` | Pending, or Active with no bids. Bond returned. |
| `submitProof(uint256 listingId, uint8 milestone, bytes32 proofHash, string proofURI)` | only `milestone == nextMilestone`, before its deadline. Starts the 72h window. Stores `proofURI` and the time (`proofURIOf`, `proofAt`) and redraws the listing's NFTs. |
| `submitProof(uint256 listingId, uint8 milestone, bytes32 proofHash, string proofURI, string coverURI)` | Same, with a cover image link (the proof photo on IPFS). `proofURI` is `ipfs://<proof record>` and `proofHash` is `keccak256` of that record's exact bytes, so anyone can fetch it and check. |

### Brand
| Function | Notes |
|---|---|
| `setBrandName(bytes32 name)` | the name drawn on this wallet's patch NFTs (as sponsor or, for a creator, as "Sponsor of @name"). Without one the NFT shows a short address, never a placeholder. The app writes it for Patched wallets before their first bid or listing. |
| `bid(uint256 listingId, uint8 patchId, uint96 amount)` | needs USDC allowance (batch approve+bid with Privy). `amount >= buyNow` buys the patch at `buyNow`. |
| `bidWithPermit(uint256 listingId, uint8 patchId, uint96 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` | EIP-2612 permit + bid in one tx |
| `bidFor(address bidder, uint256 listingId, uint8 patchId, uint96 amount)` | **Bid on someone's behalf** (e.g. a relayer or a cross-chain intermediary). The caller pays; the bid, receipt and refunds belong to `bidder`. If the bid is invalid when funds arrive (outbid meanwhile, bidding over, patch bought) the whole amount is forwarded to `bidder` instead of reverting (`BidForwarded` event). Anything above buy-now is forwarded too. |
| `dispute(uint256 listingId, uint8 milestone, uint8 patchId, string reasonURI)` | caller must hold that patch's receipt; only inside the review window |
| `approveProof(uint256 listingId, uint8 milestone, uint8 patchId)` | caller must hold that patch's receipt; only inside the review window; a patch can't be both approved and disputed. Once every sold patch has approved or disputed (and at least one approved), the review window closes at once (`ProofApproved`, then `FastTracked`) so `release` can pay without waiting |
| `listForResale(uint256 tokenId, uint96 price)` / `cancelResale(uint256 tokenId)` | holder only, listing must be Delivering |
| `buyResale(uint256 tokenId, uint96 maxPrice)` | pays seller, 5% royalty to creator/payees, moves the receipt |

### Admin (`ADMIN_ROLE`)
`createEvent(bytes32 name, uint40 startsAt, uint40 endsAt) returns (uint32)`, `setEventActive(uint32, bool)`, `approveListing(uint256)`, `rejectListing(uint256, uint8 reasonCode)`, `fastTrack(uint256, uint8 milestone)`, `resolveDispute(uint256 listingId, uint8 milestone, uint8 patchId, uint16 creatorShareBps)`, `setParams(...)` (the review window may not go below `minDisputeWindow`, default 1 hour), `setMinDisputeWindow(uint32)` (default admin only; a demo deployment lowers it to a minute), `setTreasury(address)`, `pause()`, `unpause()`. Default admin only: `setReceipt(IPatchReceipt)` (once; see Upgrades).

### Views
`getListing(id)`, `getPatch(id, patchId)`, `getPatches(id) returns (Patch[])`, `getMilestone(id, m)`, `getPayees(id) returns (address[], uint16[])`, `minNextBid(id, patchId) returns (uint96)`, `tokenIdOf(id, patchId) pure returns (uint256)` (= `id << 8 | patchId`), `listingOf(tokenId) pure`, `resalePrice(tokenId)`, `refundable(address)`, `reputation(address) returns (uint32 completed, uint32 failed, uint128 earned)`, `brandName(address)`, `events(uint32)`, `nextListingId()`, `feeBps()`, `royaltyBps()`.

Living Patch views: `tokenView(tokenId) returns (TokenView)` (stage, sponsor number, names, amount, newest proof and cover: everything the NFT draws), `receiptFor(listingId) returns (address)` (which receipt contract holds that listing's tokens), `proofURIOf(listingId, m)`, `proofCoverOf(listingId, m)`, `proofAt(listingId, m)`, `sponsorNo(tokenId)`, `creatorSponsorCount(creator)`, `legacyReceipt()`, `legacyBelowListing()`.

## Events (the indexer and live UI use these)

```solidity
event EventCreated(uint32 indexed eventId, bytes32 name, uint40 startsAt, uint40 endsAt);
event EventActiveSet(uint32 indexed eventId, bool active);
event ListingCreated(uint256 indexed listingId, address indexed creator, uint32 indexed eventId,
                     Surface surface, uint40 biddingEndsAt, uint8 patchCount, uint64 bond,
                     string metadataURI, bytes32 metadataHash);
event PatchListed(uint256 indexed listingId, uint8 indexed patchId, bytes32 label, uint96 floor, uint96 buyNow);
event ListingApproved(uint256 indexed listingId);
event ListingRejected(uint256 indexed listingId, uint8 reasonCode);
event ListingCancelled(uint256 indexed listingId);

event BidPlaced(uint256 indexed listingId, uint8 indexed patchId, address indexed bidder,
                uint96 amount, address prevBidder, uint96 prevAmount);
event PatchBought(uint256 indexed listingId, uint8 indexed patchId, address indexed buyer, uint96 amount);
event BiddingExtended(uint256 indexed listingId, uint40 newEndsAt);
event Refunded(address indexed to, uint256 amount, bool pushed);   // outbid refund; pushed=false → credited to refundable
event Credited(address indexed to, uint256 amount);                // a payout could not be pushed and was credited to refundable
event BidForwarded(uint256 indexed listingId, uint8 indexed patchId, address indexed bidder,
                   address payer, uint96 amount, bytes4 reason);   // bidFor could not bid; USDC sent to the bidder's wallet

event BiddingClosed(uint256 indexed listingId, uint96 totalEscrow, uint16 soldMask);
event ProofSubmitted(uint256 indexed listingId, uint8 indexed milestone, bytes32 proofHash, string proofURI, uint40 reviewEndsAt);
event FastTracked(uint256 indexed listingId, uint8 indexed milestone);
event Disputed(uint256 indexed listingId, uint8 indexed milestone, uint8 indexed patchId, address holder, string reasonURI);
event DisputeResolved(uint256 indexed listingId, uint8 indexed milestone, uint8 indexed patchId, uint96 toCreator, uint96 toHolder);
event MilestoneReleased(uint256 indexed listingId, uint8 indexed milestone, uint96 toCreator, uint96 fee);
event ListingCompleted(uint256 indexed listingId, uint64 bondReturned);
event ListingFailed(uint256 indexed listingId, uint8 atMilestone, uint96 refunded, uint64 bondSlashed);

event ResaleListed(uint256 indexed tokenId, address indexed seller, uint96 price);
event ResaleCancelled(uint256 indexed tokenId);
event ResaleBought(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint96 price, uint96 royalty);

event BrandNameSet(address indexed account, bytes32 name);
event Withdrawn(address indexed account, uint256 amount);
event ParamsUpdated();
event TreasuryUpdated(address treasury);
```

## Custom errors (map these to friendly UI messages)

`DisputeNotStale`, `NotActive`, `BiddingOver`, `BiddingNotOver`, `BadPatch`, `AlreadyBought`, `BidTooLow(uint96 minNext)`, `CreatorCannotBid`, `NotCreator`, `NotHolder`, `WrongMilestone`, `DeadlinePassed`, `DeadlineNotPassed`, `ReviewNotOver`, `ReviewOver`, `AlreadyDisputed`, `NotDisputed`, `InvalidParams`, `OverNewCreatorCap`, `EventInactive`, `NotForSale`, `PriceAboveMax`, `NothingToWithdraw`.

## PatchAutoBidder (auto-bid)

"Keep me on top up to $X" for one patch. Source: `contracts/src/PatchAutoBidder.sol`, tests in `test/PatchAutoBidder.t.sol` and a fork test in `test/fork/AutoBidFork.t.sol`.

| Function | Who | What |
|---|---|---|
| `setAutoBid(listingId, patchId, max)` | brand | Set or change the maximum; `0` turns it off. Emits `AutoBidSet`. |
| `setAutoBidWithPermit(listingId, patchId, max, allowance, deadline, v, r, s)` | brand | Same, plus a USDC permit for this contract, in one tx. |
| `execute(brand, listingId, patchId)` | anyone (the keeper) | If the brand is not leading, bids `minNextBid` (or buy-now) for them via `market.bidFor`. Reverts `AlreadyLeading`, `OverMax(needed, max)`, `NoAutoBid` or `BidNotPlaced`. Emits `AutoBidPlaced`. |
| `maxBid(brand, listingId, patchId)` | view | The brand's current maximum. |

The contract holds no funds and needs no role on the market. The keeper (Privy server wallet) runs `execute` right after each indexer sync that sees new logs; its Privy policy allows only `execute` on this contract. The web app asks for an allowance of 10x the maximum, because outbid bids are refunded by the market but the allowance they used is not.

## PatchSweeper (sweep)

Bid on several patches of one listing in one transaction, all or nothing. Source: `contracts/src/PatchSweeper.sol`, tests in `test/PatchSweeper.t.sol`.

| Function | What |
|---|---|
| `sweep(listingId, patchIds[], amounts[])` | Pulls the total, bids each amount through `market.bidFor` for the caller, reverts `BidNotPlaced(patchId)` if any bid doesn't land. Emits `Swept`. |
| `sweepWithPermit(..., deadline, v, r, s)` | Same with a USDC permit for the total: one signature + one tx. |

Holds no funds; bids, receipts and refunds belong to the caller. Deployed with `script/DeploySweeper.s.sol`: testnet `0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B` (v3; v2 was `0x65f0e25e5D503FCc5549624D6f9B138b17A3054f`), mainnet `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba`.

## Timing and settings (what changes under a running deal)

Found by a mentor review (2026-10-02) and covered by `test/Timeline.t.sol`:

- **Deadlines and the auction clock.** Anti-snipe can stretch an auction up to `maxExtension` past its scheduled end. At close, if the first proof deadline is under `MIN_PROOF_WINDOW` away, all deadlines move later together. A bidder can no longer push the auction past the creator's deadline and then take the bond with `markFailed`.
- **Pause.** A pause stops the calls, not the clock. `lastPausedAt` / `lastUnpausedAt` record it; a deadline that fell inside a pause (or within `PAUSE_GRACE` after) is treated as `PAUSE_GRACE` after the unpause, for both `submitProof` and `markFailed`. A creator who was already late before the pause is not helped.
- **Settings.** A listing saves the `feeBps` and `disputeWindow` it was created under (`ListingTerms`), so `setParams` changes apply to new listings only. Listings created before this version have no saved terms and use the current settings, as before. `royaltyBps` (resale) is still read at the time of the sale.
- **Disputes.** `settleStale` gives disputed money a way out when no admin answers.
- **Auto-bid.** `PatchAutoBidder` shows each brand's maximum on-chain and lets anyone call `execute`, so a second wallet can bid, trigger the brand's auto-bid, get refunded when outbid, and repeat toward the maximum (shill bidding). The brand's bids stop at its maximum and every shill bid is refunded, but the brand can end up paying close to its maximum for a spot that would have sold for less. The Privy signer auto-bid keeps the maximum off-chain and is the default for Patched wallets; the contract version is only for outside wallets, and the app says so.

## The Living Patch

Each patch NFT is an embroidered patch sewn onto the creator's fabric (denim for an outfit, racing paint for a car, fleece for a hoodie), with a woven label that carries the facts. The design lives in `docs/nft-design/mockups-v2.html`; `PatchRenderer.sol` draws it on-chain and `apps/web/src/lib/patchCard.ts` draws the identical card on the website (system fonts and no photo on-chain, web fonts and the real proof photo on the site).

**Stage** is derived from the listing, never stored (`tokenView().stage`):

| Stage | When | The card |
|---|---|---|
| Won | bidding closed, no proof yet | the patch on the fabric |
| Printed | the first proof is in | the patch moves aside and gets a PRINTED date stamp |
| Seen n/m | each later proof | a SEEN stamp and a progress pill |
| Delivered | the listing completed | a DELIVERED stamp |
| Refunded | the creator missed a deadline | the fabric goes grey and the patch is unpicked: only the stitch holes remain |
| Disputed | the holder's dispute is still open | hazard tape across the patch |

Look of the patch: five shapes by `patchId % 5`; thread by winning bid (Cotton under $100, Silk $100 to $999, Gold from $1,000); the brand name shrinks to fit. The header reads `No.NNN`, the sponsor number among everything the creator has sold, and "FIRST SPONSOR OF @creator" for number 1. Every change calls `PatchReceipt.refresh(listingId)`, which emits ERC-4906 `BatchMetadataUpdate` so marketplaces redraw.

`tokenURI` returns JSON with the SVG as `image`, traits (Stage, Sponsor #, Proofs, Creator, Brand, Surface, Patch, Event when there is one, Winning bid, Thread, Shape, Fabric, Listing), and `proof` / `proof_image` links to the newest proof when there is one. A proof link posted by a creator is stripped to safe characters before it goes into the JSON. The photo is not inside the on-chain SVG (marketplaces block external images in SVG); it shows on the website's card and share picture.

Transfers stay market-only at all times. Resale is only possible while the listing is Delivering.

## Upgrades

**Moving a live market to the Living Patch.** `PatchReceipt` is not upgradeable, so the new receipt is a new contract. `script/UpgradeReceipt.s.sol` upgrades the market logic, deploys the renderer and the new receipt, wires them together and calls `setReceipt`. Listings created before that keep their tokens on the old receipt (`legacyReceipt`, ids below `legacyBelowListing`), and every market function looks the right receipt up by listing id, so no token is stranded. `setReceipt` works once. A fresh deployment (`Deploy.s.sol`) starts on the new receipt directly. Env: `DEPLOYER_PRIVATE_KEY`, `MARKET_ADDRESS`, `SITE_PATCH_URL` (where the website shows a token, for `external_url`). Run it without `--broadcast` first; the market is over the usual 24 KB, so pass `--code-size-limit 131072`.

`PatchedMarket` runs behind an ERC-1967 (UUPS) proxy. The proxy address is the market address everyone uses and it never changes; an upgrade swaps the logic only, so listings, escrowed money and the receipts stay. Only the default admin can call `upgradeToAndCall`, and `freezeUpgrades()` turns upgrades off permanently (do this before real money, or put the admin behind a multisig and timelock). Rules for changing the contract: append new state variables at the end only, never reorder or remove any, keep defaults in `initialize`, and add a test that upgrades and checks the old data. To upgrade a live market run `script/UpgradeMarket.s.sol` (admin key and `MARKET_ADDRESS`; it checks that the listing count, the escrow and the fee are unchanged afterwards). Run it once without `--broadcast` first, with `--code-size-limit 131072` (the market is over the usual 24 KB), to see it work against the live state.

## Deployments

Addresses live in `packages/shared/src/addresses.ts` (`DEPLOYMENTS[chainId]`). The mainnet contracts and the v2 testnet market are verified on Monad's Sourcify (exact match); the v3 testnet contracts (the proxy, its implementation, the receipt, the auto-bidder and the sweeper) are not verified yet.

PatchAutoBidder: testnet `0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c` (v3, block 66627730; v2 was `0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA`), mainnet `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` (block 107531645, for the TestUSD market). Deployed with `script/DeployAutoBidder.s.sol`.

| Network | PatchedMarket | PatchReceipt | Deploy block | Notes |
|---|---|---|---|---|
| Monad testnet (10143) | `0x2AaC6f2E5221078982736F33271CD6484d0cd005` (UUPS proxy) | `0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e` | 66627600 | v3: upgradeable proxy, `approveProof`, adjustable review window. Auto-bidder `0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c`, sweeper `0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B`. Demo params: bond $1, min step $1, review 2 min, anti-snipe 1 min. Event #1 (Token2049 Demo). Previous v2 (not a proxy): `0xd3808dE425493934f036f8E77ef5a4de332e9552`. |
| Monad mainnet (143), **active** | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` | `0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97` | 107528109 | Test run on **TestUSD** (`0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f`, tUSD, 6 decimals, `faucet()` gives 1,000 per wallet per day). Params: bond $1, min step $1, cap $1000. Deployed with `script/DeployTestUSD.s.sol`. |
| Monad mainnet (143), real USDC, parked | `0xCB44d40E69Dc267e9C7CF65d89f22857e3d82aed` | `0xa6e439a22aad8fc7f596a92B5900D7b8724A01F5` | 107361531 | Real USDC. Params: bond $5, min step $1, new creators capped at $200. Switch back by restoring it in `addresses.ts` (or redeploy with `Deploy.s.sol` if the contract changed). |

The old testnet v1 (`0xCB44…2aed` on 10143) is retired. It has the same address as mainnet because both were the deployer's first transaction on a fresh chain — always pick the address by chain id.
