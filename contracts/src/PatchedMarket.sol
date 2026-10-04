// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IPatchReceipt, IPatchReceiptV2} from "./interfaces/IPatchReceipt.sol";

/// @title PatchedMarket
/// @notice Creators list patches (logo spots) on an outfit, car or team hoodie. Every patch is an
///         independent USDC auction. Winning bids are held in escrow and released to the creator in
///         milestones after proof of delivery, with a dispute window for the brands.
/// @dev Monad executes independent transactions in parallel. A bid only writes its own patch slot
///      (plus the listing end time inside the anti-snipe window), so bids on different patches do
///      not conflict. Nothing global is written on the bid path.
///
/// @dev Deployed behind an ERC-1967 (UUPS) proxy, so the address, the listings and the money stay put when the
///      logic is upgraded. Only the default admin can upgrade, and `freezeUpgrades` turns that off for good.
///      To keep the storage layout safe: only ever append new state variables at the end of this contract.
contract PatchedMarket is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // ─────────────────────────────── Types ───────────────────────────────

    enum Surface {
        Outfit,
        Car,
        Hoodie
    }

    enum Status {
        Pending,
        Active,
        Delivering,
        Completed,
        Failed,
        Cancelled,
        Rejected,
        Unsold
    }

    enum MilestoneStatus {
        Open,
        Submitted,
        Released
    }

    struct EventInfo {
        bytes32 name;
        uint40 startsAt;
        uint40 endsAt;
        bool active;
    }

    struct Listing {
        address creator;
        uint40 biddingEndsAt;
        uint40 hardEndsAt;
        Status status;
        Surface surface;
        uint32 eventId;
        uint8 patchCount;
        uint8 milestoneCount;
        uint8 nextMilestone;
        uint16 soldMask;
        uint64 bond;
        uint96 totalEscrow;
        uint16[8] milestoneBps;
        uint40[8] deadlines;
        bytes32 metadataHash;
    }

    struct Patch {
        address topBidder;
        uint96 topBid;
        uint96 floor;
        uint96 buyNow;
        uint40 lastBidAt;
        bool bought;
        bytes32 label;
    }

    struct Milestone {
        MilestoneStatus status;
        uint40 reviewEndsAt;
        uint16 disputedMask;
        uint16 resolvedMask;
        uint16 approvedMask;
        bytes32 proofHash;
    }

    struct Reputation {
        uint32 completed;
        uint32 failed;
        uint128 earned;
    }

    struct ListingParams {
        Surface surface;
        uint32 eventId;
        uint40 biddingEndsAt;
        uint64 bond;
        uint96[] floors;
        uint96[] buyNows;
        bytes32[] labels;
        uint16[] milestoneBps;
        uint40[] deadlines;
        address[] payees;
        uint16[] shares;
        string metadataURI;
        bytes32 metadataHash;
    }

    /// @notice Where a patch NFT is in its life. Derived from the listing, never stored.
    uint8 public constant STAGE_WON = 0; // bidding closed, no proof yet
    uint8 public constant STAGE_PRINTED = 1; // the first proof is in
    uint8 public constant STAGE_SEEN = 2; // later proofs are in
    uint8 public constant STAGE_DELIVERED = 3; // listing completed
    uint8 public constant STAGE_REFUNDED = 4; // the creator failed and the holder was refunded
    uint8 public constant STAGE_DISPUTED = 5; // the holder's dispute is still open

    /// @notice Everything a receipt NFT needs to draw itself and describe itself.
    struct TokenView {
        uint256 listingId;
        uint8 patchId;
        Surface surface;
        uint8 stage;
        uint8 proofsDone;
        uint8 milestoneCount;
        uint32 sponsorNo;
        uint96 amount;
        uint40 printedAt;
        uint40 seenAt;
        address winner;
        address creator;
        bytes32 brand;
        bytes32 creatorName;
        bytes32 label;
        bytes32 eventName;
        string proofURI;
        string coverURI;
    }

    // ─────────────────────────────── Errors ───────────────────────────────

    error NotActive();
    error BiddingOver();
    error BiddingNotOver();
    error BadPatch();
    error AlreadyBought();
    error BidTooLow(uint96 minNext);
    error CreatorCannotBid();
    error NotCreator();
    error NotHolder();
    error WrongMilestone();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error DisputeNotStale();
    error ReviewNotOver();
    error ReviewOver();
    error AlreadyDisputed();
    error AlreadyApproved();
    error UpgradesAreFrozen();
    error NotDisputed();
    error InvalidParams();
    error OverNewCreatorCap();
    error EventInactive();
    error NotForSale();
    error PriceAboveMax();
    error NothingToWithdraw();

    // ─────────────────────────────── Events ───────────────────────────────

    event EventCreated(uint32 indexed eventId, bytes32 name, uint40 startsAt, uint40 endsAt);
    event EventActiveSet(uint32 indexed eventId, bool active);
    event ListingCreated(
        uint256 indexed listingId,
        address indexed creator,
        uint32 indexed eventId,
        Surface surface,
        uint40 biddingEndsAt,
        uint8 patchCount,
        uint64 bond,
        string metadataURI,
        bytes32 metadataHash
    );
    event PatchListed(uint256 indexed listingId, uint8 indexed patchId, bytes32 label, uint96 floor, uint96 buyNow);
    event ListingApproved(uint256 indexed listingId);
    event ListingRejected(uint256 indexed listingId, uint8 reasonCode);
    event ListingCancelled(uint256 indexed listingId);

    event BidPlaced(
        uint256 indexed listingId,
        uint8 indexed patchId,
        address indexed bidder,
        uint96 amount,
        address prevBidder,
        uint96 prevAmount
    );
    event PatchBought(uint256 indexed listingId, uint8 indexed patchId, address indexed buyer, uint96 amount);
    event BiddingExtended(uint256 indexed listingId, uint40 newEndsAt);
    /// @notice Proof deadlines were moved later at close so the first one is MIN_PROOF_WINDOW after it.
    event DeadlinesShifted(uint256 indexed listingId, uint40 by);
    event Refunded(address indexed to, uint256 amount, bool pushed);
    event Credited(address indexed to, uint256 amount);
    event BidForwarded(
        uint256 indexed listingId, uint8 indexed patchId, address indexed bidder, address payer, uint96 amount, bytes4 reason
    );

    event BiddingClosed(uint256 indexed listingId, uint96 totalEscrow, uint16 soldMask);
    event ProofSubmitted(
        uint256 indexed listingId, uint8 indexed milestone, bytes32 proofHash, string proofURI, uint40 reviewEndsAt
    );
    event FastTracked(uint256 indexed listingId, uint8 indexed milestone);
    event ProofApproved(uint256 indexed listingId, uint8 indexed milestone, uint8 indexed patchId, address holder);
    event MinDisputeWindowUpdated(uint32 minDisputeWindow);
    event UpgradesFrozen();
    event Disputed(
        uint256 indexed listingId, uint8 indexed milestone, uint8 indexed patchId, address holder, string reasonURI
    );
    event DisputeResolved(
        uint256 indexed listingId, uint8 indexed milestone, uint8 indexed patchId, uint96 toCreator, uint96 toHolder
    );
    event MilestoneReleased(uint256 indexed listingId, uint8 indexed milestone, uint96 toCreator, uint96 fee);
    event ListingCompleted(uint256 indexed listingId, uint64 bondReturned);
    event ListingFailed(uint256 indexed listingId, uint8 atMilestone, uint96 refunded, uint64 bondSlashed);

    event ResaleListed(uint256 indexed tokenId, address indexed seller, uint96 price);
    event ResaleCancelled(uint256 indexed tokenId);
    event ResaleBought(
        uint256 indexed tokenId, address indexed seller, address indexed buyer, uint96 price, uint96 royalty
    );

    event BrandNameSet(address indexed account, bytes32 name);
    /// @notice Listings from `firstListing` on mint on `receipt`; earlier ones stay on `legacyReceipt`.
    event ReceiptSet(address receipt, address legacyReceipt, uint256 firstListing);
    event Withdrawn(address indexed account, uint256 amount);
    event ParamsUpdated();
    event TreasuryUpdated(address treasury);

    // ─────────────────────────────── Storage ───────────────────────────────

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint8 public constant MAX_PATCHES = 16;
    uint8 public constant MAX_MILESTONES = 8;
    uint8 public constant MAX_PAYEES = 8;
    uint16 internal constant BPS = 10_000;
    /// @notice After bidding closes the creator always has at least this long to post the first proof, however late
    ///         bids stretched the auction. Deadlines that fall short are moved later, all by the same amount.
    uint40 public constant MIN_PROOF_WINDOW = 1 hours;
    /// @notice A pause stops the calls, not the clock: a proof deadline that falls during a pause, or within this long
    ///         after it ends, is moved to this long after the unpause.
    uint40 public constant PAUSE_GRACE = 24 hours;
    /// @notice A disputed patch nobody resolves can be settled 50/50 by anyone this long after its review window.
    uint40 public constant DISPUTE_TIMEOUT = 30 days;

    IERC20 public usdc;
    IPatchReceipt public receipt;
    address public treasury;

    // Defaults are set in `initialize`: a proxy does not run these declarations
    uint16 public feeBps; // of creator payouts: 5% default in initialize, 1% on the live testnet market (setParams)
    uint16 public royaltyBps; // 5% of resales, to the creator
    uint16 public minIncrementBps; // next bid >= top + 5% ...
    uint96 public minIncrement; // ... and >= top + $5
    uint64 public minBond;
    uint96 public newCreatorCap; // sum of buy-now prices for creators with no deliveries
    uint32 public snipeWindow;
    uint32 public maxExtension;
    uint32 public disputeWindow;
    /// @notice The shortest review window `setParams` accepts. One hour by default; a demo deployment can lower it.
    uint32 public minDisputeWindow;

    uint32 public nextEventId;
    uint256 public nextListingId;

    mapping(uint32 => EventInfo) public events;
    mapping(uint256 => Listing) internal _listings;
    mapping(uint256 => mapping(uint8 => Patch)) internal _patches;
    mapping(uint256 => mapping(uint8 => Milestone)) internal _milestones;
    mapping(uint256 => address[]) internal _payees;
    mapping(uint256 => uint16[]) internal _shares;

    mapping(uint256 => uint96) public resalePrice;
    mapping(address => uint256) public refundable;
    mapping(address => Reputation) public reputation;
    mapping(address => bytes32) public brandName;

    /// @notice Once true, the logic can never be upgraded again.
    bool public upgradesFrozen;
    // New state variables go below this line, never above (proxy storage layout).

    /// @notice When the market was last paused and unpaused (0 = never). See PAUSE_GRACE.
    uint40 public lastPausedAt;
    uint40 public lastUnpausedAt;

    /// @dev The fee and review window a listing was created under. Admin settings change for new listings only, so a
    ///      deal in progress is paid out on the terms its creator and brands saw. Listings from before this existed
    ///      (set == false) use the current settings.
    struct ListingTerms {
        bool set;
        uint16 feeBps;
        uint32 disputeWindow;
    }
    mapping(uint256 => ListingTerms) internal _terms;

    /// @notice The receipt contract used before `setReceipt`, and the first listing id that uses the new one. Listings
    ///         below it keep their NFTs where they are, so an upgrade never strands a token.
    IPatchReceipt public legacyReceipt;
    uint256 public legacyBelowListing;

    /// @dev The proof link and the cover image link (usually ipfs://) the creator posted with each milestone.
    mapping(uint256 => mapping(uint8 => string)) internal _proofURI;
    mapping(uint256 => mapping(uint8 => string)) internal _proofCover;
    /// @notice When each milestone's proof was posted. Stamps on the NFT show this date.
    mapping(uint256 => mapping(uint8 => uint40)) public proofAt;
    /// @notice How many patches this creator has sold across all listings: the next sponsor gets this plus one.
    mapping(address => uint32) public creatorSponsorCount;
    /// @notice "Sponsor No. N of the creator" for each minted token.
    mapping(uint256 => uint32) public sponsorNo;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IERC20 usdc_, IPatchReceipt receipt_, address admin, address treasury_) external initializer {
        if (address(usdc_) == address(0) || address(receipt_) == address(0)) revert InvalidParams();
        if (admin == address(0) || treasury_ == address(0)) revert InvalidParams();
        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        feeBps = 500;
        royaltyBps = 500;
        minIncrementBps = 500;
        minIncrement = 5e6;
        minBond = 25e6;
        newCreatorCap = 1_000e6;
        snipeWindow = 5 minutes;
        maxExtension = 1 days;
        disputeWindow = 72 hours;
        minDisputeWindow = 1 hours;
        nextEventId = 1;
        nextListingId = 1;
        usdc = usdc_;
        receipt = receipt_;
        treasury = treasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ─────────────────────────────── Creator ───────────────────────────────

    /// @notice Create a listing. Pulls the bond. The listing starts Pending until an admin approves it.
    function createListing(ListingParams calldata p) external whenNotPaused nonReentrant returns (uint256 id) {
        uint256 n = p.floors.length;
        uint256 m = p.milestoneBps.length;
        if (n == 0 || n > MAX_PATCHES || p.buyNows.length != n || p.labels.length != n) revert InvalidParams();
        if (m == 0 || m > MAX_MILESTONES || p.deadlines.length != m) revert InvalidParams();
        if (p.biddingEndsAt <= block.timestamp || p.bond < minBond) revert InvalidParams();
        if (p.eventId != 0 && !events[p.eventId].active) revert EventInactive();

        id = nextListingId++;
        Listing storage L = _listings[id];
        L.creator = msg.sender;
        L.biddingEndsAt = p.biddingEndsAt;
        L.hardEndsAt = p.biddingEndsAt + maxExtension;
        L.surface = p.surface;
        L.eventId = p.eventId;
        L.patchCount = uint8(n);
        L.milestoneCount = uint8(m);
        L.bond = p.bond;
        L.metadataHash = p.metadataHash;
        _terms[id] = ListingTerms({set: true, feeBps: feeBps, disputeWindow: disputeWindow});

        uint256 sumBps;
        uint40 prev = p.biddingEndsAt;
        for (uint256 i; i < m; ++i) {
            if (p.milestoneBps[i] == 0 || p.deadlines[i] <= prev) revert InvalidParams();
            sumBps += p.milestoneBps[i];
            prev = p.deadlines[i];
            L.milestoneBps[i] = p.milestoneBps[i];
            L.deadlines[i] = p.deadlines[i];
        }
        if (sumBps != BPS) revert InvalidParams();

        uint256 capSum;
        for (uint256 i; i < n; ++i) {
            if (p.floors[i] == 0 || p.buyNows[i] < p.floors[i]) revert InvalidParams();
            Patch storage P = _patches[id][uint8(i)];
            P.floor = p.floors[i];
            P.buyNow = p.buyNows[i];
            P.label = p.labels[i];
            capSum += p.buyNows[i];
            emit PatchListed(id, uint8(i), p.labels[i], p.floors[i], p.buyNows[i]);
        }
        if (reputation[msg.sender].completed == 0 && capSum > newCreatorCap) revert OverNewCreatorCap();

        _setPayees(id, p.payees, p.shares);

        usdc.safeTransferFrom(msg.sender, address(this), p.bond);
        emit ListingCreated(
            id, msg.sender, p.eventId, p.surface, p.biddingEndsAt, uint8(n), p.bond, p.metadataURI, p.metadataHash
        );
    }

    /// @notice Cancel a listing that is still Pending, or Active without any bid. Returns the bond.
    function cancelListing(uint256 id) external nonReentrant {
        Listing storage L = _listings[id];
        if (msg.sender != L.creator) revert NotCreator();
        if (L.status == Status.Active) {
            for (uint8 i; i < L.patchCount; ++i) {
                if (_patches[id][i].topBidder != address(0)) revert NotActive();
            }
        } else if (L.status != Status.Pending) {
            revert NotActive();
        }
        L.status = Status.Cancelled;
        _send(L.creator, L.bond);
        emit ListingCancelled(id);
    }

    /// @notice Submit proof for the current milestone. Starts the dispute window.
    function submitProof(uint256 id, uint8 milestone, bytes32 proofHash, string calldata proofURI)
        external
        whenNotPaused
    {
        _submitProof(id, milestone, proofHash, proofURI, "");
    }

    /// @notice Same, with a cover image link (the proof photo on IPFS) that the NFT shows as its latest picture.
    function submitProof(
        uint256 id,
        uint8 milestone,
        bytes32 proofHash,
        string calldata proofURI,
        string calldata coverURI
    ) external whenNotPaused {
        _submitProof(id, milestone, proofHash, proofURI, coverURI);
    }

    function _submitProof(
        uint256 id,
        uint8 milestone,
        bytes32 proofHash,
        string calldata proofURI,
        string memory coverURI
    ) internal {
        Listing storage L = _listings[id];
        if (msg.sender != L.creator) revert NotCreator();
        if (L.status != Status.Delivering) revert NotActive();
        if (milestone != L.nextMilestone) revert WrongMilestone();
        Milestone storage ms = _milestones[id][milestone];
        if (ms.status != MilestoneStatus.Open) revert WrongMilestone();
        if (block.timestamp > _deadline(L, milestone)) revert DeadlinePassed();

        uint40 reviewEndsAt = uint40(block.timestamp) + _reviewWindow(id);
        ms.status = MilestoneStatus.Submitted;
        ms.reviewEndsAt = reviewEndsAt;
        ms.proofHash = proofHash;
        proofAt[id][milestone] = uint40(block.timestamp);
        _proofURI[id][milestone] = proofURI;
        if (bytes(coverURI).length != 0) _proofCover[id][milestone] = coverURI;
        emit ProofSubmitted(id, milestone, proofHash, proofURI, reviewEndsAt);
        _refresh(id);
    }

    // ─────────────────────────────── Brand ───────────────────────────────

    function setBrandName(bytes32 name) external {
        brandName[msg.sender] = name;
        emit BrandNameSet(msg.sender, name);
    }

    /// @notice Bid on one patch. `amount >= buyNow` buys the patch outright at the buy-now price.
    function bid(uint256 id, uint8 patchId, uint96 amount) external whenNotPaused nonReentrant {
        _bid(id, patchId, amount);
    }

    /// @notice EIP-2612 permit + bid in one transaction. A failed permit is ignored if allowance already exists.
    function bidWithPermit(uint256 id, uint8 patchId, uint96 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
        whenNotPaused
        nonReentrant
    {
        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        _bid(id, patchId, amount);
    }

    /// @notice Bid on behalf of `bidder`, paid by the caller. Built for cross-chain "deposit and execute"
    ///         (Aurora Intents Connect): an intermediary account pays, but the bid, the receipt NFT and any
    ///         outbid refund belong to `bidder`. Never gets stuck: if the bid is no longer valid when the
    ///         funds arrive (e.g. someone outbid in the meantime), the full amount is forwarded to
    ///         `bidder` instead of reverting. Any amount above the buy-now price is forwarded too.
    function bidFor(address bidder, uint256 id, uint8 patchId, uint96 amount) external whenNotPaused nonReentrant {
        if (bidder == address(0) || amount == 0) revert InvalidParams();
        (bytes4 err,, uint96 price, bool buying) = _checkBid(id, patchId, bidder, amount);
        if (err != bytes4(0)) {
            usdc.safeTransferFrom(msg.sender, bidder, amount);
            emit BidForwarded(id, patchId, bidder, msg.sender, amount, err);
            return;
        }
        _place(id, patchId, bidder, msg.sender, price, buying);
        if (amount > price) usdc.safeTransferFrom(msg.sender, bidder, amount - price);
    }

    /// @notice The holder of a patch receipt disputes that patch for the milestone under review.
    function dispute(uint256 id, uint8 milestone, uint8 patchId, string calldata reasonURI) external whenNotPaused {
        Listing storage L = _listings[id];
        if (L.status != Status.Delivering) revert NotActive();
        Milestone storage ms = _milestones[id][milestone];
        if (ms.status != MilestoneStatus.Submitted) revert WrongMilestone();
        if (block.timestamp >= ms.reviewEndsAt) revert ReviewOver();
        uint16 bit = _bit(patchId);
        if (patchId >= L.patchCount || L.soldMask & bit == 0) revert BadPatch();
        if (_receiptFor(id).ownerOf(tokenIdOf(id, patchId)) != msg.sender) revert NotHolder();
        if (ms.disputedMask & bit != 0) revert AlreadyDisputed();
        if (ms.approvedMask & bit != 0) revert AlreadyApproved();
        ms.disputedMask |= bit;
        emit Disputed(id, milestone, patchId, msg.sender, reasonURI);
        _refresh(id);
    }

    /// @notice The holder of a patch receipt accepts the proof for their patch. Once every sold patch has either
    ///         approved or disputed (and at least one approved), the review window closes early so the creator
    ///         can be paid without waiting it out. Disputed patches stay held back until an admin resolves them.
    function approveProof(uint256 id, uint8 milestone, uint8 patchId) external whenNotPaused {
        Listing storage L = _listings[id];
        if (L.status != Status.Delivering) revert NotActive();
        Milestone storage ms = _milestones[id][milestone];
        if (ms.status != MilestoneStatus.Submitted) revert WrongMilestone();
        if (block.timestamp >= ms.reviewEndsAt) revert ReviewOver();
        uint16 bit = _bit(patchId);
        if (patchId >= L.patchCount || L.soldMask & bit == 0) revert BadPatch();
        if (_receiptFor(id).ownerOf(tokenIdOf(id, patchId)) != msg.sender) revert NotHolder();
        if (ms.disputedMask & bit != 0) revert AlreadyDisputed();
        if (ms.approvedMask & bit != 0) revert AlreadyApproved();
        ms.approvedMask |= bit;
        emit ProofApproved(id, milestone, patchId, msg.sender);

        uint16 sold = L.soldMask;
        if ((ms.approvedMask | ms.disputedMask) & sold == sold) {
            ms.reviewEndsAt = uint40(block.timestamp);
            emit FastTracked(id, milestone);
        }
    }

    // ─────────────────────────────── Resale ───────────────────────────────

    function listForResale(uint256 tokenId, uint96 price) external whenNotPaused {
        (uint256 id,) = listingOf(tokenId);
        if (_listings[id].status != Status.Delivering) revert NotActive();
        if (_receiptFor(id).ownerOf(tokenId) != msg.sender) revert NotHolder();
        if (price == 0) revert InvalidParams();
        resalePrice[tokenId] = price;
        emit ResaleListed(tokenId, msg.sender, price);
    }

    function cancelResale(uint256 tokenId) external {
        (uint256 id,) = listingOf(tokenId);
        if (_receiptFor(id).ownerOf(tokenId) != msg.sender) revert NotHolder();
        delete resalePrice[tokenId];
        emit ResaleCancelled(tokenId);
    }

    /// @notice Buy a listed patch receipt. The creator (or team) receives `royaltyBps` of the price.
    function buyResale(uint256 tokenId, uint96 maxPrice) external whenNotPaused nonReentrant {
        uint96 price = resalePrice[tokenId];
        if (price == 0) revert NotForSale();
        if (price > maxPrice) revert PriceAboveMax();
        (uint256 id,) = listingOf(tokenId);
        if (_listings[id].status != Status.Delivering) revert NotActive();
        IPatchReceipt rc = _receiptFor(id);
        address seller = rc.ownerOf(tokenId);
        if (seller == msg.sender) revert InvalidParams();

        delete resalePrice[tokenId];
        uint96 royalty = uint96(uint256(price) * royaltyBps / BPS);

        usdc.safeTransferFrom(msg.sender, address(this), price);
        rc.marketTransfer(seller, msg.sender, tokenId);
        _send(seller, price - royalty);
        if (royalty > 0) _distribute(id, royalty);
        emit ResaleBought(tokenId, seller, msg.sender, price, royalty);
    }

    // ─────────────────────────────── Anyone ───────────────────────────────

    /// @notice Close bidding once time is up (or every patch is bought). Mints receipts to the winners.
    function closeBidding(uint256 id) external whenNotPaused nonReentrant {
        Listing storage L = _listings[id];
        if (L.status != Status.Active) revert NotActive();

        uint8 n = L.patchCount;
        bool allBought = true;
        for (uint8 i; i < n; ++i) {
            if (!_patches[id][i].bought) {
                allBought = false;
                break;
            }
        }
        if (block.timestamp < L.biddingEndsAt && !allBought) revert BiddingNotOver();

        uint16 mask;
        uint96 total;
        for (uint8 i; i < n; ++i) {
            Patch storage P = _patches[id][i];
            if (P.topBidder != address(0)) {
                mask |= _bit(i);
                total += P.topBid;
            }
        }
        L.soldMask = mask;
        L.totalEscrow = total;

        if (mask == 0) {
            L.status = Status.Unsold;
            _send(L.creator, L.bond);
        } else {
            L.status = Status.Delivering;
            // Late bids can stretch the auction past a deadline that was set when it was scheduled: keep honest
            // delivery possible by moving every deadline later until the first is MIN_PROOF_WINDOW after the close.
            uint40 earliest = uint40(block.timestamp) + MIN_PROOF_WINDOW;
            if (L.deadlines[0] < earliest) {
                uint40 shift = earliest - L.deadlines[0];
                for (uint8 k; k < L.milestoneCount; ++k) {
                    L.deadlines[k] += shift;
                }
                emit DeadlinesShifted(id, shift);
            }
            IPatchReceipt rc = _receiptFor(id);
            uint32 count = creatorSponsorCount[L.creator];
            for (uint8 i; i < n; ++i) {
                if (mask & _bit(i) == 0) continue;
                uint256 tokenId = tokenIdOf(id, i);
                sponsorNo[tokenId] = ++count;
                rc.mint(_patches[id][i].topBidder, tokenId);
            }
            creatorSponsorCount[L.creator] = count;
        }
        emit BiddingClosed(id, total, mask);
    }

    /// @notice Pay the creator for a milestone once its review window is over. Disputed patches are held
    ///         back until an admin resolves them.
    function release(uint256 id, uint8 milestone) external whenNotPaused nonReentrant {
        Listing storage L = _listings[id];
        if (L.status != Status.Delivering) revert NotActive();
        if (milestone != L.nextMilestone) revert WrongMilestone();
        Milestone storage ms = _milestones[id][milestone];
        if (ms.status != MilestoneStatus.Submitted) revert WrongMilestone();
        if (block.timestamp < ms.reviewEndsAt) revert ReviewNotOver();

        uint256 gross;
        for (uint8 i; i < L.patchCount; ++i) {
            uint16 bit = _bit(i);
            if (L.soldMask & bit == 0 || ms.disputedMask & bit != 0) continue;
            gross += _portion(L, _patches[id][i].topBid, milestone);
        }

        ms.status = MilestoneStatus.Released;
        L.nextMilestone = milestone + 1;
        (uint96 net, uint96 fee) = _payCreator(id, uint96(gross));
        emit MilestoneReleased(id, milestone, net, fee);

        if (L.nextMilestone == L.milestoneCount) {
            L.status = Status.Completed;
            reputation[L.creator].completed += 1;
            _send(L.creator, L.bond);
            emit ListingCompleted(id, L.bond);
        }
        _refresh(id);
    }

    /// @notice The creator missed a proof deadline. Everything not yet released, plus the bond, goes to
    ///         the current receipt holders in proportion to their winning bids.
    function markFailed(uint256 id) external whenNotPaused nonReentrant {
        Listing storage L = _listings[id];
        if (L.status != Status.Delivering) revert NotActive();
        uint8 m = L.nextMilestone;
        if (_milestones[id][m].status != MilestoneStatus.Open) revert WrongMilestone();
        if (block.timestamp <= _deadline(L, m)) revert DeadlineNotPassed();

        L.status = Status.Failed;
        reputation[L.creator].failed += 1;
        IPatchReceipt rc = _receiptFor(id);

        uint96 refunded;
        uint64 bondLeft = L.bond;
        uint16 mask = L.soldMask;
        for (uint8 i; i < L.patchCount; ++i) {
            if (mask & _bit(i) == 0) continue;
            uint96 win = _patches[id][i].topBid;
            uint96 remaining = win - _paidBefore(L, win, m);
            mask &= ~_bit(i);
            // last sold patch takes the rounding remainder of the bond
            uint64 bondShare = mask == 0 ? bondLeft : uint64(uint256(L.bond) * win / L.totalEscrow);
            bondLeft -= bondShare;
            refunded += remaining;
            _send(rc.ownerOf(tokenIdOf(id, i)), uint256(remaining) + bondShare);
        }
        emit ListingFailed(id, m, refunded, L.bond);
        _refresh(id);
    }

    /// @notice Collect money that could not be pushed directly (e.g. the transfer to you failed).
    function withdraw() external nonReentrant {
        uint256 amount = refundable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        refundable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ─────────────────────────────── Admin ───────────────────────────────

    function createEvent(bytes32 name, uint40 startsAt, uint40 endsAt)
        external
        onlyRole(ADMIN_ROLE)
        returns (uint32 eventId)
    {
        if (endsAt <= startsAt) revert InvalidParams();
        eventId = nextEventId++;
        events[eventId] = EventInfo(name, startsAt, endsAt, true);
        emit EventCreated(eventId, name, startsAt, endsAt);
    }

    function setEventActive(uint32 eventId, bool active) external onlyRole(ADMIN_ROLE) {
        if (events[eventId].endsAt == 0) revert InvalidParams();
        events[eventId].active = active;
        emit EventActiveSet(eventId, active);
    }

    function approveListing(uint256 id) external onlyRole(ADMIN_ROLE) {
        Listing storage L = _listings[id];
        if (L.status != Status.Pending) revert NotActive();
        if (block.timestamp >= L.biddingEndsAt) revert BiddingOver();
        L.status = Status.Active;
        emit ListingApproved(id);
    }

    function rejectListing(uint256 id, uint8 reasonCode) external onlyRole(ADMIN_ROLE) nonReentrant {
        Listing storage L = _listings[id];
        if (L.status != Status.Pending) revert NotActive();
        L.status = Status.Rejected;
        _send(L.creator, L.bond);
        emit ListingRejected(id, reasonCode);
    }

    /// @notice Close the review window early when the proof is clearly fine.
    function fastTrack(uint256 id, uint8 milestone) external onlyRole(ADMIN_ROLE) {
        Milestone storage ms = _milestones[id][milestone];
        if (ms.status != MilestoneStatus.Submitted) revert WrongMilestone();
        ms.reviewEndsAt = uint40(block.timestamp);
        emit FastTracked(id, milestone);
    }

    /// @notice Settle one disputed patch: `creatorShareBps` of its milestone portion goes to the creator
    ///         (minus the fee), the rest back to the receipt holder.
    function resolveDispute(uint256 id, uint8 milestone, uint8 patchId, uint16 creatorShareBps)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (creatorShareBps > BPS) revert InvalidParams();
        _resolve(id, milestone, patchId, creatorShareBps);
    }

    /// @notice Disputed money must have a way out even if no admin ever answers: this long after the review window
    ///         anyone can settle a still-open dispute, half to the creator (minus the fee) and half back to the holder.
    function settleStale(uint256 id, uint8 milestone, uint8 patchId) external whenNotPaused nonReentrant {
        if (block.timestamp < _milestones[id][milestone].reviewEndsAt + DISPUTE_TIMEOUT) revert DisputeNotStale();
        _resolve(id, milestone, patchId, BPS / 2);
    }

    function _resolve(uint256 id, uint8 milestone, uint8 patchId, uint16 creatorShareBps) internal {
        Listing storage L = _listings[id];
        Milestone storage ms = _milestones[id][milestone];
        uint16 bit = _bit(patchId);
        if (ms.disputedMask & bit == 0 || ms.resolvedMask & bit != 0) revert NotDisputed();
        ms.resolvedMask |= bit;

        uint96 amount = _portion(L, _patches[id][patchId].topBid, milestone);
        uint96 toCreator = uint96(uint256(amount) * creatorShareBps / BPS);
        uint96 toHolder = amount - toCreator;
        if (toCreator > 0) _payCreator(id, toCreator);
        if (toHolder > 0) _send(_receiptFor(id).ownerOf(tokenIdOf(id, patchId)), toHolder);
        emit DisputeResolved(id, milestone, patchId, toCreator, toHolder);
        _refresh(id);
    }

    function setParams(
        uint16 feeBps_,
        uint16 royaltyBps_,
        uint16 minIncrementBps_,
        uint96 minIncrement_,
        uint64 minBond_,
        uint96 newCreatorCap_,
        uint32 snipeWindow_,
        uint32 maxExtension_,
        uint32 disputeWindow_
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (feeBps_ > 1_000 || royaltyBps_ > 1_000 || minIncrementBps_ > 5_000) revert InvalidParams();
        if (snipeWindow_ > 1 hours || maxExtension_ > 7 days) revert InvalidParams();
        if (disputeWindow_ < minDisputeWindow || disputeWindow_ > 14 days) revert InvalidParams();
        feeBps = feeBps_;
        royaltyBps = royaltyBps_;
        minIncrementBps = minIncrementBps_;
        minIncrement = minIncrement_;
        minBond = minBond_;
        newCreatorCap = newCreatorCap_;
        snipeWindow = snipeWindow_;
        maxExtension = maxExtension_;
        disputeWindow = disputeWindow_;
        emit ParamsUpdated();
    }

    /// @notice Lower or raise the floor for the review window (a demo deployment sets it to a minute; production
    ///         keeps one hour). The current window is raised to the new floor if it would fall below it.
    function setMinDisputeWindow(uint32 minDisputeWindow_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (minDisputeWindow_ == 0 || minDisputeWindow_ > 14 days) revert InvalidParams();
        minDisputeWindow = minDisputeWindow_;
        if (disputeWindow < minDisputeWindow_) disputeWindow = minDisputeWindow_;
        emit MinDisputeWindowUpdated(minDisputeWindow_);
    }

    /// @notice Permanently switch off upgrades. One-way: after this the logic can never change.
    function freezeUpgrades() external onlyRole(DEFAULT_ADMIN_ROLE) {
        upgradesFrozen = true;
        emit UpgradesFrozen();
    }

    function _authorizeUpgrade(address) internal view override onlyRole(DEFAULT_ADMIN_ROLE) {
        if (upgradesFrozen) revert UpgradesAreFrozen();
    }

    /// @notice Point new listings at a new receipt contract (once). Listings that already exist keep the receipt they
    ///         were created under, so no token is ever stranded. A fresh deployment starts on the new receipt directly
    ///         and never calls this.
    function setReceipt(IPatchReceipt next) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(next) == address(0) || address(next) == address(receipt) || address(legacyReceipt) != address(0)) {
            revert InvalidParams();
        }
        legacyReceipt = receipt;
        legacyBelowListing = nextListingId;
        receipt = next;
        emit ReceiptSet(address(next), address(legacyReceipt), nextListingId);
    }

    function setTreasury(address treasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0)) revert InvalidParams();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        lastPausedAt = uint40(block.timestamp);
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        lastUnpausedAt = uint40(block.timestamp);
        _unpause();
    }

    // ─────────────────────────────── Views ───────────────────────────────

    function getListing(uint256 id) external view returns (Listing memory) {
        return _listings[id];
    }

    function getPatch(uint256 id, uint8 patchId) external view returns (Patch memory) {
        return _patches[id][patchId];
    }

    function getPatches(uint256 id) external view returns (Patch[] memory out) {
        uint8 n = _listings[id].patchCount;
        out = new Patch[](n);
        for (uint8 i; i < n; ++i) {
            out[i] = _patches[id][i];
        }
    }

    function getMilestone(uint256 id, uint8 milestone) external view returns (Milestone memory) {
        return _milestones[id][milestone];
    }

    function getPayees(uint256 id) external view returns (address[] memory, uint16[] memory) {
        return (_payees[id], _shares[id]);
    }

    /// @notice Lowest amount that takes the lead on a patch (capped at its buy-now price).
    function minNextBid(uint256 id, uint8 patchId) external view returns (uint96) {
        Patch storage P = _patches[id][patchId];
        uint96 min = _minNext(P);
        return min > P.buyNow ? P.buyNow : min;
    }

    /// @notice The receipt contract that holds (or will hold) listing `id`'s tokens.
    function receiptFor(uint256 id) external view returns (address) {
        return address(_receiptFor(id));
    }

    function proofURIOf(uint256 id, uint8 milestone) external view returns (string memory) {
        return _proofURI[id][milestone];
    }

    function proofCoverOf(uint256 id, uint8 milestone) external view returns (string memory) {
        return _proofCover[id][milestone];
    }

    /// @notice Everything the NFT needs to draw itself: stage, sponsor number, names, amounts and the latest proof.
    function tokenView(uint256 tokenId) external view returns (TokenView memory v) {
        (uint256 id, uint8 patchId) = listingOf(tokenId);
        Listing storage L = _listings[id];
        Patch storage P = _patches[id][patchId];
        v.listingId = id;
        v.patchId = patchId;
        v.surface = L.surface;
        v.milestoneCount = L.milestoneCount;
        v.sponsorNo = sponsorNo[tokenId];
        v.amount = P.topBid;
        v.winner = P.topBidder;
        v.creator = L.creator;
        v.brand = brandName[P.topBidder];
        v.creatorName = brandName[L.creator];
        v.label = P.label;
        v.eventName = events[L.eventId].name;

        uint16 bit = _bit(patchId);
        bool disputeOpen;
        uint8 proofs;
        for (uint8 m; m < L.milestoneCount; ++m) {
            Milestone storage ms = _milestones[id][m];
            if (ms.status != MilestoneStatus.Open) ++proofs;
            if (ms.disputedMask & bit != 0 && ms.resolvedMask & bit == 0) disputeOpen = true;
        }
        v.proofsDone = proofs;

        Status st = L.status;
        if (st == Status.Failed) v.stage = STAGE_REFUNDED;
        else if (disputeOpen) v.stage = STAGE_DISPUTED;
        else if (st == Status.Completed) v.stage = STAGE_DELIVERED;
        else if (proofs == 0) v.stage = STAGE_WON;
        else if (proofs == 1) v.stage = STAGE_PRINTED;
        else v.stage = STAGE_SEEN;

        if (proofs > 0) {
            v.printedAt = proofAt[id][0];
            v.proofURI = _proofURI[id][proofs - 1];
            for (uint8 m = proofs; m > 0; --m) {
                if (bytes(_proofCover[id][m - 1]).length != 0) {
                    v.coverURI = _proofCover[id][m - 1];
                    break;
                }
            }
        }
        if (proofs > 1) v.seenAt = proofAt[id][proofs - 1];
    }

    function tokenIdOf(uint256 id, uint8 patchId) public pure returns (uint256) {
        return (id << 8) | patchId;
    }

    function listingOf(uint256 tokenId) public pure returns (uint256 id, uint8 patchId) {
        return (tokenId >> 8, uint8(tokenId));
    }

    /// @notice Everything the receipt NFT needs to draw itself.
    function receiptData(uint256 tokenId)
        external
        view
        returns (bytes32 brand, bytes32 label, bytes32 eventName, Surface surface, uint96 amount, address creator)
    {
        (uint256 id, uint8 patchId) = listingOf(tokenId);
        Listing storage L = _listings[id];
        Patch storage P = _patches[id][patchId];
        return (brandName[P.topBidder], P.label, events[L.eventId].name, L.surface, P.topBid, L.creator);
    }

    // ─────────────────────────────── Internal ───────────────────────────────

    function _receiptFor(uint256 id) internal view returns (IPatchReceipt) {
        return id < legacyBelowListing ? legacyReceipt : receipt;
    }

    /// @dev Tell the receipt this listing's tokens changed so marketplaces redraw them (ERC-4906). Listings on the
    ///      legacy receipt have nothing to refresh, and a failed call must never block money moving.
    function _refresh(uint256 id) internal {
        if (id < legacyBelowListing) return;
        try IPatchReceiptV2(address(receipt)).refresh(id) {} catch {}
    }

    /// @dev Checks a bid without changing state. `err` is the custom-error selector, or 0 if the bid is valid.
    function _checkBid(uint256 id, uint8 patchId, address bidder, uint96 amount)
        internal
        view
        returns (bytes4 err, uint96 minNext, uint96 price, bool buying)
    {
        Listing storage L = _listings[id];
        if (L.status != Status.Active) return (NotActive.selector, 0, 0, false);
        if (block.timestamp >= L.biddingEndsAt) return (BiddingOver.selector, 0, 0, false);
        if (patchId >= L.patchCount) return (BadPatch.selector, 0, 0, false);
        if (bidder == L.creator) return (CreatorCannotBid.selector, 0, 0, false);
        Patch storage P = _patches[id][patchId];
        if (P.bought) return (AlreadyBought.selector, 0, 0, false);

        buying = amount >= P.buyNow;
        price = buying ? P.buyNow : amount;
        if (!buying) {
            minNext = _minNext(P);
            if (amount < minNext) return (BidTooLow.selector, minNext, 0, false);
        }
    }

    function _bid(uint256 id, uint8 patchId, uint96 amount) internal {
        (bytes4 err, uint96 minNext, uint96 price, bool buying) = _checkBid(id, patchId, msg.sender, amount);
        if (err == BidTooLow.selector) revert BidTooLow(minNext);
        if (err != bytes4(0)) {
            assembly {
                mstore(0, err)
                revert(0, 4)
            }
        }
        _place(id, patchId, msg.sender, msg.sender, price, buying);
    }

    /// @dev Records the new top bid for `bidder`, pulls `price` from `payer` and refunds the previous leader.
    function _place(uint256 id, uint8 patchId, address bidder, address payer, uint96 price, bool buying) internal {
        Listing storage L = _listings[id];
        Patch storage P = _patches[id][patchId];

        address prevBidder = P.topBidder;
        uint96 prevAmount = P.topBid;
        P.topBidder = bidder;
        P.topBid = price;
        P.lastBidAt = uint40(block.timestamp);
        if (buying) P.bought = true;

        usdc.safeTransferFrom(payer, address(this), price);
        if (prevBidder != address(0)) {
            bool pushed = _trySend(prevBidder, prevAmount);
            emit Refunded(prevBidder, prevAmount, pushed);
        }

        emit BidPlaced(id, patchId, bidder, price, prevBidder, prevAmount);
        if (buying) {
            emit PatchBought(id, patchId, bidder, price);
        } else if (L.biddingEndsAt - block.timestamp < snipeWindow) {
            uint40 newEnd = uint40(block.timestamp) + snipeWindow;
            if (newEnd > L.hardEndsAt) newEnd = L.hardEndsAt;
            if (newEnd > L.biddingEndsAt) {
                L.biddingEndsAt = newEnd;
                emit BiddingExtended(id, newEnd);
            }
        }
    }

    function _minNext(Patch storage P) internal view returns (uint96) {
        if (P.topBid == 0) return P.floor;
        uint96 inc = uint96(uint256(P.topBid) * minIncrementBps / BPS);
        if (inc < minIncrement) inc = minIncrement;
        return P.topBid + inc;
    }

    /// @dev Share of a winning bid paid at milestone `m`. The last milestone takes the rounding remainder.
    function _portion(Listing storage L, uint96 win, uint8 m) internal view returns (uint96) {
        if (m == L.milestoneCount - 1) return win - _paidBefore(L, win, m);
        return uint96(uint256(win) * L.milestoneBps[m] / BPS);
    }

    /// @dev Sum of the portions for milestones before `m`.
    function _paidBefore(Listing storage L, uint96 win, uint8 m) internal view returns (uint96 paid) {
        for (uint8 k; k < m; ++k) {
            paid += uint96(uint256(win) * L.milestoneBps[k] / BPS);
        }
    }

    /// @dev Milestone `m`'s proof deadline, moved later when it fell during a pause or within PAUSE_GRACE after one.
    function _deadline(Listing storage L, uint8 m) internal view returns (uint40 d) {
        d = L.deadlines[m];
        if (lastPausedAt != 0 && d >= lastPausedAt && d < lastUnpausedAt + PAUSE_GRACE) d = lastUnpausedAt + PAUSE_GRACE;
    }

    function _reviewWindow(uint256 id) internal view returns (uint32) {
        ListingTerms storage t = _terms[id];
        return t.set ? t.disputeWindow : disputeWindow;
    }

    function _payCreator(uint256 id, uint96 gross) internal returns (uint96 net, uint96 fee) {
        if (gross == 0) return (0, 0);
        ListingTerms storage t = _terms[id];
        fee = uint96(uint256(gross) * (t.set ? t.feeBps : feeBps) / BPS);
        net = gross - fee;
        if (fee > 0) usdc.safeTransfer(treasury, fee);
        _distribute(id, net);
    }

    /// @dev Pay the creator, or split across the team payees (last payee takes the rounding remainder).
    function _distribute(uint256 id, uint96 amount) internal {
        address creator = _listings[id].creator;
        reputation[creator].earned += amount;
        address[] storage payees = _payees[id];
        uint256 n = payees.length;
        if (n == 0) {
            _send(creator, amount);
            return;
        }
        uint16[] storage shares = _shares[id];
        uint96 left = amount;
        for (uint256 i; i < n; ++i) {
            uint96 part = i == n - 1 ? left : uint96(uint256(amount) * shares[i] / BPS);
            left -= part;
            _send(payees[i], part);
        }
    }

    function _setPayees(uint256 id, address[] calldata payees, uint16[] calldata shares) internal {
        uint256 n = payees.length;
        if (n == 0) {
            if (shares.length != 0) revert InvalidParams();
            return;
        }
        if (n > MAX_PAYEES || shares.length != n) revert InvalidParams();
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (payees[i] == address(0) || shares[i] == 0) revert InvalidParams();
            sum += shares[i];
        }
        if (sum != BPS) revert InvalidParams();
        _payees[id] = payees;
        _shares[id] = shares;
    }

    /// @dev Push USDC, or credit it to `refundable` if the transfer fails (e.g. a blocked address),
    ///      so one bad recipient can never block bidding or payouts for everyone else.
    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        if (!_trySend(to, amount)) emit Credited(to, amount);
    }

    function _trySend(address to, uint256 amount) internal returns (bool pushed) {
        (bool ok, bytes memory data) = address(usdc).call(abi.encodeCall(IERC20.transfer, (to, amount)));
        pushed = ok && (data.length == 0 || (data.length == 32 && abi.decode(data, (bool))));
        if (!pushed) refundable[to] += amount;
    }

    function _bit(uint8 i) internal pure returns (uint16) {
        return uint16(1) << i;
    }
}
