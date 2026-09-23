// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

/// @notice Random end-to-end stories (bids, buy-now, disputes, resales, releases, failure) with the
///         solvency rule checked after every step: the market holds exactly what it owes.
contract LifecycleFuzzTest is BaseTest {
    uint256 internal id;

    struct Story {
        uint8 patches;
        uint8 milestones;
        uint256 bidSeed;
        uint16 disputeMask;
        uint16 resaleMask;
        uint16 share;
        uint8 failAt;
        bool blockAlice;
    }

    function testFuzz_lifecycleStaysSolvent(Story memory s) public {
        s.patches = uint8(bound(s.patches, 1, 6));
        s.milestones = uint8(bound(s.milestones, 1, 4));
        s.failAt = uint8(bound(s.failAt, 0, s.milestones)); // == milestones → no failure
        s.share = uint16(bound(s.share, 0, 10_000));

        // create + approve with an uneven milestone plan
        uint16[] memory bps = new uint16[](s.milestones);
        uint16 left = 10_000;
        for (uint256 k; k < s.milestones; ++k) {
            bps[k] = k == s.milestones - 1 ? left : uint16(10_000 / s.milestones - k * 7);
            left -= bps[k];
        }
        vm.prank(creator);
        id = market.createListing(_params(s.patches, bps));
        vm.prank(admin);
        market.approveListing(id);
        _check();

        // bidding: up to 3 bids per patch from different brands, sometimes buy-now
        address[3] memory brands = [alice, bob, carol];
        for (uint8 i; i < s.patches; ++i) {
            uint256 r = uint256(keccak256(abi.encode(s.bidSeed, i)));
            uint256 rounds = r % 4;
            for (uint256 j; j < rounds; ++j) {
                if (market.getPatch(id, i).bought) break;
                uint96 min = market.minNextBid(id, i);
                uint96 amount = min + uint96((r >> (j * 16)) % 80e6);
                address who = brands[(r >> (j * 8)) % 3];
                if (who == alice && usdc.blocked(alice)) who = bob; // a blocked address can't pay either
                _bid(who, id, i, amount);
                if (s.blockAlice && j == 0) usdc.setBlocked(alice, true);
                _check();
            }
        }
        usdc.setBlocked(alice, false);

        vm.warp(biddingEnd);
        market.closeBidding(id);
        _check();
        PatchedMarket.Listing memory L = market.getListing(id);
        if (L.status == PatchedMarket.Status.Unsold) return;

        // resales before delivery
        for (uint8 i; i < s.patches; ++i) {
            if (L.soldMask & (uint16(1) << i) == 0 || s.resaleMask & (uint16(1) << i) == 0) continue;
            uint256 tokenId = market.tokenIdOf(id, i);
            address holder = receipt.ownerOf(tokenId);
            address buyer = holder == carol ? bob : carol;
            vm.prank(holder);
            market.listForResale(tokenId, 321e6);
            vm.prank(buyer);
            market.buyResale(tokenId, 321e6);
            _check();
        }

        // milestones
        for (uint8 k; k < s.milestones; ++k) {
            if (k == s.failAt) {
                vm.warp(L.deadlines[k] + 1);
                market.markFailed(id);
                _check();
                break;
            }
            _submit(id, k);
            for (uint8 i; i < s.patches; ++i) {
                if (L.soldMask & (uint16(1) << i) == 0 || s.disputeMask & (uint16(1) << ((i + k) % 16)) == 0) continue;
                vm.prank(receipt.ownerOf(market.tokenIdOf(id, i)));
                market.dispute(id, k, i, "");
            }
            // settle one dispute early (before release) to exercise that path
            if (k == 0) _resolveAll(k, s.share, 1);
            vm.warp(vm.getBlockTimestamp() + 72 hours);
            market.release(id, k);
            _check();
            _resolveAll(k, s.share, type(uint8).max);
            _check();
        }

        // after everything settles, only credited refunds may remain
        PatchedMarket.Status end = market.getListing(id).status;
        assertTrue(end == PatchedMarket.Status.Completed || end == PatchedMarket.Status.Failed);
        assertEq(usdc.balanceOf(address(market)), _refundables());
    }

    function _resolveAll(uint8 k, uint16 share, uint8 max) internal {
        PatchedMarket.Milestone memory ms = market.getMilestone(id, k);
        uint8 done;
        for (uint8 i; i < 16 && done < max; ++i) {
            uint16 bit = uint16(1) << i;
            if (ms.disputedMask & bit == 0 || ms.resolvedMask & bit != 0) continue;
            vm.prank(admin);
            market.resolveDispute(id, k, i, share);
            ++done;
            _check();
        }
    }

    function _check() internal view {
        assertEq(usdc.balanceOf(address(market)), _liabilities() + _refundables(), "market is not exactly solvent");
    }

    function _refundables() internal view returns (uint256) {
        return market.refundable(alice) + market.refundable(bob) + market.refundable(carol)
            + market.refundable(creator);
    }

    function _liabilities() internal view returns (uint256 owed) {
        PatchedMarket.Listing memory L = market.getListing(id);
        PatchedMarket.Status s = L.status;
        if (s == PatchedMarket.Status.Pending || s == PatchedMarket.Status.Active || s == PatchedMarket.Status.Delivering) {
            owed += L.bond;
        }
        if (s == PatchedMarket.Status.Active) {
            for (uint8 i; i < L.patchCount; ++i) owed += market.getPatch(id, i).topBid;
            return owed;
        }
        if (s != PatchedMarket.Status.Delivering && s != PatchedMarket.Status.Completed && s != PatchedMarket.Status.Failed) {
            return owed;
        }
        for (uint8 i; i < L.patchCount; ++i) {
            uint16 bit = uint16(1) << i;
            if (L.soldMask & bit == 0) continue;
            uint96 win = market.getPatch(id, i).topBid;
            for (uint8 k; k < L.milestoneCount; ++k) {
                PatchedMarket.Milestone memory ms = market.getMilestone(id, k);
                bool resolved = ms.resolvedMask & bit != 0;
                if (k >= L.nextMilestone) {
                    if (s == PatchedMarket.Status.Delivering && !resolved) owed += _portion(L, win, k);
                } else if (ms.disputedMask & bit != 0 && !resolved) {
                    owed += _portion(L, win, k);
                }
            }
        }
    }

    function _portion(PatchedMarket.Listing memory L, uint96 win, uint8 m) internal pure returns (uint96) {
        uint96 paid;
        for (uint8 k; k < m; ++k) paid += uint96(uint256(win) * L.milestoneBps[k] / 10_000);
        if (m == L.milestoneCount - 1) return win - paid;
        return uint96(uint256(win) * L.milestoneBps[m] / 10_000);
    }
}
