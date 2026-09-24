# Contracts — external API

Status: **Implemented and tested** (56 tests incl. fuzzing and a solvency invariant). ABIs are exported to `@patched/shared` (`patchedMarketAbi`, `patchReceiptAbi`). If the API has to change, this file changes first and the change is announced in `docs/requests.md`.

Two contracts:

- `PatchedMarket` — holds all USDC: events, listings, per-patch auctions, escrow, milestones, disputes, bonds, resale, reputation.
- `PatchReceipt` — ERC-721, one token per won patch. Only the market can mint or move tokens (so resale royalties are enforced). `tokenURI` is fully on-chain SVG.

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
| `closeBidding(uint256 listingId)` | status Active and (`now >= biddingEndsAt` or every patch bought). Mints receipts. → Delivering, or Unsold if nothing sold (bond returned). |
| `release(uint256 listingId, uint8 milestone)` | milestone Submitted and `now >= reviewEndsAt`. Pays creator/payees for non-disputed patches minus fee. Last milestone → Completed, bond returned. |
| `markFailed(uint256 listingId)` | Delivering, current milestone still Open and its deadline passed. Refunds unreleased money + bond to receipt holders. → Failed. |
| `withdraw()` | collect `refundable[msg.sender]` (only used if a direct refund transfer failed). |

### Creator
| Function | Notes |
|---|---|
| `createListing(ListingParams p) returns (uint256 listingId)` | pulls `bond` USDC (approve first or batch). Status Pending. New creators (0 completed) are capped: sum of buyNows <= `newCreatorCap`. |
| `cancelListing(uint256 listingId)` | Pending, or Active with no bids. Bond returned. |
| `submitProof(uint256 listingId, uint8 milestone, bytes32 proofHash, string proofURI)` | only `milestone == nextMilestone`, before its deadline. Starts the 72h window. |

### Brand
| Function | Notes |
|---|---|
| `setBrandName(bytes32 name)` | shown on receipts |
| `bid(uint256 listingId, uint8 patchId, uint96 amount)` | needs USDC allowance (batch approve+bid with Privy). `amount >= buyNow` buys the patch at `buyNow`. |
| `bidWithPermit(uint256 listingId, uint8 patchId, uint96 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` | EIP-2612 permit + bid in one tx |
| `bidFor(address bidder, uint256 listingId, uint8 patchId, uint96 amount)` | **Bid on someone's behalf** (e.g. a relayer or a cross-chain intermediary). The caller pays; the bid, receipt and refunds belong to `bidder`. If the bid is invalid when funds arrive (outbid meanwhile, bidding over, patch bought) the whole amount is forwarded to `bidder` instead of reverting (`BidForwarded` event). Anything above buy-now is forwarded too. |
| `dispute(uint256 listingId, uint8 milestone, uint8 patchId, string reasonURI)` | caller must hold that patch's receipt; only inside the review window |
| `listForResale(uint256 tokenId, uint96 price)` / `cancelResale(uint256 tokenId)` | holder only, listing must be Delivering |
| `buyResale(uint256 tokenId, uint96 maxPrice)` | pays seller, 5% royalty to creator/payees, moves the receipt |

### Admin (`ADMIN_ROLE`)
`createEvent(bytes32 name, uint40 startsAt, uint40 endsAt) returns (uint32)`, `setEventActive(uint32, bool)`, `approveListing(uint256)`, `rejectListing(uint256, uint8 reasonCode)`, `fastTrack(uint256, uint8 milestone)`, `resolveDispute(uint256 listingId, uint8 milestone, uint8 patchId, uint16 creatorShareBps)`, `setParams(...)`, `setTreasury(address)`, `pause()`, `unpause()`.

### Views
`getListing(id)`, `getPatch(id, patchId)`, `getPatches(id) returns (Patch[])`, `getMilestone(id, m)`, `getPayees(id) returns (address[], uint16[])`, `minNextBid(id, patchId) returns (uint96)`, `tokenIdOf(id, patchId) pure returns (uint256)` (= `id << 8 | patchId`), `listingOf(tokenId) pure`, `resalePrice(tokenId)`, `refundable(address)`, `reputation(address) returns (uint32 completed, uint32 failed, uint128 earned)`, `brandName(address)`, `events(uint32)`, `nextListingId()`, `feeBps()`, `royaltyBps()`.

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

`NotActive`, `BiddingOver`, `BiddingNotOver`, `BadPatch`, `AlreadyBought`, `BidTooLow(uint96 minNext)`, `CreatorCannotBid`, `NotCreator`, `NotHolder`, `WrongMilestone`, `DeadlinePassed`, `DeadlineNotPassed`, `ReviewNotOver`, `ReviewOver`, `AlreadyDisputed`, `NotDisputed`, `InvalidParams`, `OverNewCreatorCap`, `EventInactive`, `NotForSale`, `PriceAboveMax`, `NothingToWithdraw`.

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

Holds no funds; bids, receipts and refunds belong to the caller. Deployed with `script/DeploySweeper.s.sol`: testnet `0x65f0e25e5D503FCc5549624D6f9B138b17A3054f`, mainnet `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba`.

## Deployments

Addresses live in `packages/shared/src/addresses.ts` (`DEPLOYMENTS[chainId]`). All verified on Sourcify (exact match).

PatchAutoBidder: testnet `0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA` (block 65221700), mainnet `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` (block 107531645, for the TestUSD market). Deployed with `script/DeployAutoBidder.s.sol`.

| Network | PatchedMarket | PatchReceipt | Deploy block | Notes |
|---|---|---|---|---|
| Monad testnet (10143) | `0xd3808dE425493934f036f8E77ef5a4de332e9552` | `0x598Ea7C3Cf739Dbea1B809d5Cd0174818b680a8f` | 65054031 | v2 with `bidFor`. Params: bond $5, min step $1. Demo event #1 + listing #1 seeded. |
| Monad mainnet (143), **active** | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` | `0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97` | 107528109 | Test run on **TestUSD** (`0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f`, tUSD, 6 decimals, `faucet()` gives 1,000 per wallet per day). Params: bond $1, min step $1, cap $1000. Deployed with `script/DeployTestUSD.s.sol`. |
| Monad mainnet (143), real USDC, parked | `0xCB44d40E69Dc267e9C7CF65d89f22857e3d82aed` | `0xa6e439a22aad8fc7f596a92B5900D7b8724A01F5` | 107361531 | Real USDC. Params: bond $5, min step $1, new creators capped at $200. Switch back by restoring it in `addresses.ts` (or redeploy with `Deploy.s.sol` if the contract changed). |

The old testnet v1 (`0xCB44…2aed` on 10143) is retired. It has the same address as mainnet because both were the deployer's first transaction on a fresh chain — always pick the address by chain id.
