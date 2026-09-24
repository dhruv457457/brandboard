// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PatchedMarket} from "./PatchedMarket.sol";

/// @title PatchSweeper
/// @notice Bid on several patches of one listing in a single transaction, all or nothing. Every bid is placed
///         through PatchedMarket.bidFor, so the bids, receipt NFTs and outbid refunds belong to the caller.
///         Holds no funds between calls: it pulls exactly the sum of the bids and passes each one on.
contract PatchSweeper is ReentrancyGuard {
    using SafeERC20 for IERC20;

    PatchedMarket public immutable market;
    IERC20 public immutable usdc;

    event Swept(address indexed brand, uint256 indexed listingId, uint8[] patchIds, uint96[] amounts, uint256 total);

    error LengthMismatch();
    error Empty();
    error BidNotPlaced(uint8 patchId);

    constructor(PatchedMarket market_) {
        market = market_;
        usdc = market_.usdc();
    }

    /// @notice Place `amounts[i]` on `patchIds[i]` for the caller. Reverts entirely if any bid can't be placed.
    function sweep(uint256 listingId, uint8[] calldata patchIds, uint96[] calldata amounts) public nonReentrant {
        uint256 n = patchIds.length;
        if (n == 0) revert Empty();
        if (amounts.length != n) revert LengthMismatch();

        uint256 total;
        for (uint256 i; i < n; ++i) total += amounts[i];
        usdc.safeTransferFrom(msg.sender, address(this), total);
        usdc.forceApprove(address(market), total);

        for (uint256 i; i < n; ++i) {
            market.bidFor(msg.sender, listingId, patchIds[i], amounts[i]);
            // bidFor forwards the money instead of reverting when a bid is invalid; make it all-or-nothing.
            if (market.getPatch(listingId, patchIds[i]).topBidder != msg.sender) revert BidNotPlaced(patchIds[i]);
        }
        emit Swept(msg.sender, listingId, patchIds, amounts, total);
    }

    /// @notice sweep() with an EIP-2612 permit for the total, so the whole sweep is one signature + one tx.
    function sweepWithPermit(
        uint256 listingId,
        uint8[] calldata patchIds,
        uint96[] calldata amounts,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        uint256 total;
        for (uint256 i; i < amounts.length; ++i) total += amounts[i];
        try IERC20Permit(address(usdc)).permit(msg.sender, address(this), total, deadline, v, r, s) {} catch {}
        sweep(listingId, patchIds, amounts);
    }
}
