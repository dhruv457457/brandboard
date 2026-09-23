// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../../src/PatchedMarket.sol";
import {PatchReceipt} from "../../src/PatchReceipt.sol";
import {IPatchReceipt} from "../../src/interfaces/IPatchReceipt.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Drives the market through random sequences of every user-facing action.
contract Handler is Test {
    PatchedMarket internal market;
    MockUSDC internal usdc;
    address internal admin;

    address[] public creators;
    address[] public brands;
    uint256[] public listings;
    mapping(bytes32 => uint256) public ok;

    constructor(PatchedMarket market_, MockUSDC usdc_, address admin_) {
        market = market_;
        usdc = usdc_;
        admin = admin_;
        for (uint256 i; i < 3; ++i) creators.push(makeAddr(string.concat("creator", vm.toString(i))));
        for (uint256 i; i < 4; ++i) brands.push(makeAddr(string.concat("brand", vm.toString(i))));
        address[] memory all = new address[](7);
        for (uint256 i; i < 3; ++i) all[i] = creators[i];
        for (uint256 i; i < 4; ++i) all[3 + i] = brands[i];
        for (uint256 i; i < all.length; ++i) {
            usdc.mint(all[i], 1_000_000e6);
            vm.prank(all[i]);
            usdc.approve(address(market), type(uint256).max);
        }
    }

    function listingCount() external view returns (uint256) {
        return listings.length;
    }

    function _listing(uint256 seed) internal view returns (uint256) {
        return listings[seed % listings.length];
    }

    function create(uint256 seed, uint8 patches, uint8 milestones) external {
        patches = uint8(bound(patches, 1, 5));
        milestones = uint8(bound(milestones, 1, 4));
        uint40 end = uint40(vm.getBlockTimestamp() + 1 days);
        PatchedMarket.ListingParams memory p;
        p.surface = PatchedMarket.Surface(seed % 3);
        p.biddingEndsAt = end;
        p.bond = 25e6;
        p.floors = new uint96[](patches);
        p.buyNows = new uint96[](patches);
        p.labels = new bytes32[](patches);
        for (uint256 i; i < patches; ++i) {
            p.floors[i] = uint96(bound(uint256(keccak256(abi.encode(seed, i))), 1e6, 200e6));
            p.buyNows[i] = p.floors[i] * 4;
        }
        p.milestoneBps = new uint16[](milestones);
        p.deadlines = new uint40[](milestones);
        uint16 left = 10_000;
        for (uint256 i; i < milestones; ++i) {
            p.milestoneBps[i] = i == milestones - 1 ? left : 10_000 / milestones;
            left -= p.milestoneBps[i];
            p.deadlines[i] = end + uint40((i + 1) * 5 days);
        }
        if (seed % 4 == 0) {
            p.payees = new address[](2);
            p.shares = new uint16[](2);
            (p.payees[0], p.payees[1]) = (creators[(seed + 1) % 3], brands[seed % 4]);
            (p.shares[0], p.shares[1]) = (6000, 4000);
        }
        vm.prank(creators[seed % 3]);
        listings.push(market.createListing(p));
        vm.prank(admin);
        market.approveListing(listings[listings.length - 1]);
    }

    function bid(uint256 seed, uint8 patchId, uint96 extra) external {
        if (listings.length == 0) return;
        // bid on one of the three newest listings, which are the ones still open
        uint256 recent = listings.length < 3 ? listings.length : 3;
        uint256 id = listings[listings.length - 1 - seed % recent];
        patchId = uint8(bound(patchId, 0, 4));
        uint96 amount = market.minNextBid(id, patchId) + uint96(bound(extra, 0, 300e6));
        vm.prank(brands[seed % 4]);
        try market.bid(id, patchId, amount) { ok["bid"]++; } catch {}
    }

    function warp(uint32 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1 minutes, 8 hours));
    }

    function close(uint256 seed) external {
        if (listings.length == 0) return;
        try market.closeBidding(_listing(seed)) { ok["close"]++; } catch {}
    }

    function submit(uint256 seed) external {
        if (listings.length == 0) return;
        uint256 id = _listing(seed);
        PatchedMarket.Listing memory L = market.getListing(id);
        vm.prank(L.creator);
        try market.submitProof(id, L.nextMilestone, bytes32(seed), "") { ok["submit"]++; } catch {}
    }

    function dispute(uint256 seed, uint8 patchId) external {
        if (listings.length == 0) return;
        uint256 id = _listing(seed);
        PatchedMarket.Listing memory L = market.getListing(id);
        patchId = uint8(bound(patchId, 0, 4));
        if (L.soldMask & (uint16(1) << patchId) == 0) return;
        address holder = IPatchReceipt(address(market.receipt())).ownerOf(market.tokenIdOf(id, patchId));
        vm.prank(holder);
        try market.dispute(id, L.nextMilestone, patchId, "") { ok["dispute"]++; } catch {}
    }

    function release(uint256 seed) external {
        if (listings.length == 0) return;
        uint256 id = _listing(seed);
        try market.release(id, market.getListing(id).nextMilestone) { ok["release"]++; } catch {}
    }

    function resolve(uint256 seed, uint8 milestone, uint8 patchId, uint16 share) external {
        if (listings.length == 0) return;
        vm.prank(admin);
        try market.resolveDispute(_listing(seed), uint8(bound(milestone, 0, 3)), uint8(bound(patchId, 0, 4)), uint16(bound(share, 0, 10_000))) { ok["resolve"]++; }
            catch {}
    }

    function fail(uint256 seed) external {
        if (listings.length == 0) return;
        try market.markFailed(_listing(seed)) { ok["fail"]++; } catch {}
    }

    function resale(uint256 seed, uint8 patchId, uint96 price) external {
        if (listings.length == 0) return;
        uint256 id = _listing(seed);
        patchId = uint8(bound(patchId, 0, 4));
        if (market.getListing(id).soldMask & (uint16(1) << patchId) == 0) return;
        uint256 tokenId = market.tokenIdOf(id, patchId);
        address holder = IPatchReceipt(address(market.receipt())).ownerOf(tokenId);
        address buyer = brands[(seed + 1) % 4];
        if (buyer == holder) return;
        price = uint96(bound(price, 1e6, 2_000e6));
        vm.prank(holder);
        try market.listForResale(tokenId, price) {} catch { return; }
        vm.prank(buyer);
        try market.buyResale(tokenId, price) { ok["resale"]++; } catch {}
    }

    function toggleBlock(uint256 seed) external {
        // occasionally block a brand (like Circle's blocklist) to exercise the refund fallback
        usdc.setBlocked(brands[seed % 4], seed % 5 == 0);
    }

    function withdraw(uint256 seed) external {
        address who = seed % 2 == 0 ? brands[seed % 4] : creators[seed % 3];
        vm.prank(who);
        try market.withdraw() { ok["withdraw"]++; } catch {}
    }
}

contract SolvencyInvariantTest is StdInvariant, Test {
    MockUSDC internal usdc;
    PatchedMarket internal market;
    Handler internal handler;
    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        PatchReceipt receipt = new PatchReceipt();
        market = new PatchedMarket(IERC20(address(usdc)), IPatchReceipt(address(receipt)), admin, treasury);
        receipt.setMarket(market);
        vm.prank(admin);
        market.setParams(500, 500, 500, 5e6, 25e6, 1_000_000e6, 5 minutes, 1 days, 72 hours);

        handler = new Handler(market, usdc, admin);
        targetContract(address(handler));
        bytes4[] memory actions = new bytes4[](13);
        actions[0] = Handler.create.selector;
        actions[1] = Handler.bid.selector;
        actions[2] = Handler.bid.selector; // bids are the hot path, weight them up
        actions[3] = Handler.warp.selector;
        actions[4] = Handler.close.selector;
        actions[5] = Handler.submit.selector;
        actions[6] = Handler.dispute.selector;
        actions[7] = Handler.release.selector;
        actions[8] = Handler.resolve.selector;
        actions[9] = Handler.fail.selector;
        actions[10] = Handler.resale.selector;
        actions[11] = Handler.toggleBlock.selector;
        actions[12] = Handler.withdraw.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: actions}));
    }

    /// @notice The contract holds exactly what it owes: bonds, live top bids, unreleased escrow,
    ///         held disputes and credited refunds. Nothing is created or lost.
    function afterInvariant() public view {
        string[9] memory names = ["bid", "close", "submit", "dispute", "release", "resolve", "fail", "resale", "withdraw"];
        for (uint256 i; i < names.length; ++i) console.log(names[i], handler.ok(bytes32(bytes(names[i]))));
    }

    function invariant_balanceEqualsLiabilities() public view {
        assertEq(usdc.balanceOf(address(market)), _liabilities());
    }

    function _liabilities() internal view returns (uint256 owed) {
        uint256 n = handler.listingCount();
        for (uint256 j; j < n; ++j) {
            uint256 id = handler.listings(j);
            PatchedMarket.Listing memory L = market.getListing(id);
            PatchedMarket.Status s = L.status;

            if (s == PatchedMarket.Status.Pending || s == PatchedMarket.Status.Active || s == PatchedMarket.Status.Delivering) {
                owed += L.bond;
            }
            if (s == PatchedMarket.Status.Active) {
                for (uint8 i; i < L.patchCount; ++i) owed += market.getPatch(id, i).topBid;
            }
            if (s == PatchedMarket.Status.Delivering || s == PatchedMarket.Status.Completed || s == PatchedMarket.Status.Failed) {
                for (uint8 i; i < L.patchCount; ++i) {
                    if (L.soldMask & (uint16(1) << i) == 0) continue;
                    uint96 win = market.getPatch(id, i).topBid;
                    uint16 bit = uint16(1) << i;
                    for (uint8 k; k < L.milestoneCount; ++k) {
                        uint96 part = _portion(L, win, k);
                        PatchedMarket.Milestone memory ms = market.getMilestone(id, k);
                        bool disputed = ms.disputedMask & bit != 0;
                        bool resolved = ms.resolvedMask & bit != 0;
                        if (k >= L.nextMilestone) {
                            // not released yet: held while delivering (refunded on failure),
                            // unless a dispute on it was already settled early
                            if (s == PatchedMarket.Status.Delivering && !resolved) owed += part;
                        } else if (disputed && !resolved) {
                            owed += part; // released milestone, but this patch is still held
                        }
                    }
                }
            }
        }
        owed += _refundables();
    }

    function _refundables() internal view returns (uint256 total) {
        for (uint256 i; i < 3; ++i) total += market.refundable(handler.creators(i));
        for (uint256 i; i < 4; ++i) total += market.refundable(handler.brands(i));
    }

    function _portion(PatchedMarket.Listing memory L, uint96 win, uint8 m) internal pure returns (uint96) {
        uint96 paid;
        for (uint8 k; k < m; ++k) paid += uint96(uint256(win) * L.milestoneBps[k] / 10_000);
        if (m == L.milestoneCount - 1) return win - paid;
        return uint96(uint256(win) * L.milestoneBps[m] / 10_000);
    }
}
