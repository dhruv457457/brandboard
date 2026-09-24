// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PatchedMarket} from "./PatchedMarket.sol";

/// @title PatchAutoBidder
/// @notice "Keep me on top up to $X" for a patch. A brand sets a maximum per patch; whenever the brand is not the
///         top bidder, anyone (in practice the Patched keeper, a Privy server wallet limited by policy to this
///         contract) can call execute(), which bids the minimum next bid on the brand's behalf through
///         PatchedMarket.bidFor. The bid, the receipt NFT and any outbid refund belong to the brand.
///
///         Guarantees, enforced here and not by whoever calls execute():
///         - it only bids when the brand is not already leading,
///         - it only bids the market's minimum next bid (or buy-now, if that is lower),
///         - it never bids above the brand's maximum,
///         - it holds no funds: each call pulls exactly the bid amount from the brand and passes it on.
///         Outbid bids are refunded by the market to the brand, so at most one bid per patch (<= max) is locked.
contract PatchAutoBidder is ReentrancyGuard {
    using SafeERC20 for IERC20;

    PatchedMarket public immutable market;
    IERC20 public immutable usdc;

    /// brand => listing id => patch id => maximum bid (0 = no auto-bid)
    mapping(address => mapping(uint256 => mapping(uint8 => uint96))) public maxBid;

    event AutoBidSet(address indexed brand, uint256 indexed listingId, uint8 indexed patchId, uint96 max);
    event AutoBidPlaced(address indexed brand, uint256 indexed listingId, uint8 indexed patchId, uint96 amount, address caller);

    error NoAutoBid();
    error AlreadyLeading();
    error OverMax(uint96 needed, uint96 max);
    error BidNotPlaced();

    constructor(PatchedMarket market_) {
        market = market_;
        usdc = market_.usdc();
    }

    /// @notice Set (or change) your maximum for a patch. 0 turns auto-bid off.
    function setAutoBid(uint256 listingId, uint8 patchId, uint96 max) public {
        maxBid[msg.sender][listingId][patchId] = max;
        emit AutoBidSet(msg.sender, listingId, patchId, max);
    }

    /// @notice setAutoBid plus an EIP-2612 permit that lets this contract pull USDC for your auto-bids, in one tx.
    ///         A failed permit (e.g. front-run) is ignored; execute() then simply needs an existing allowance.
    function setAutoBidWithPermit(
        uint256 listingId,
        uint8 patchId,
        uint96 max,
        uint256 allowance,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), allowance, deadline, v, r, s) {} catch {}
        setAutoBid(listingId, patchId, max);
    }

    /// @notice Bid the minimum next bid for `brand` on a patch, if the brand is outbid and it fits their maximum.
    function execute(address brand, uint256 listingId, uint8 patchId) external nonReentrant returns (uint96 amount) {
        uint96 max = maxBid[brand][listingId][patchId];
        if (max == 0) revert NoAutoBid();
        if (market.getPatch(listingId, patchId).topBidder == brand) revert AlreadyLeading();

        amount = market.minNextBid(listingId, patchId);
        if (amount > max) revert OverMax(amount, max);

        usdc.safeTransferFrom(brand, address(this), amount);
        usdc.forceApprove(address(market), amount);
        market.bidFor(brand, listingId, patchId, amount);
        // bidFor forwards the money back to the brand instead of reverting when the bid is invalid
        // (bidding over, patch bought...). Treat that as a failure so nothing is recorded.
        if (market.getPatch(listingId, patchId).topBidder != brand) revert BidNotPlaced();

        emit AutoBidPlaced(brand, listingId, patchId, amount, msg.sender);
    }
}
