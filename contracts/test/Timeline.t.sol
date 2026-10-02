// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PatchedMarket} from "../src/PatchedMarket.sol";
import {BaseTest} from "./Base.t.sol";

/// Timing and money-out tests from a mentor review (Michal Prevratil, 2026-10-02). The base tests use generous fixed
/// deadlines (a week after the auction); these use tight ones and the things that move the clock: late bids that extend
/// the auction, a pause, and admin settings that change while a deal is running. Each test says what SHOULD happen.
contract TimelineTest is BaseTest {
    uint256 internal id;

    /// A listing whose first proof deadline is just after the scheduled auction end.
    function _tight(uint40 firstDeadlineAfterEnd) internal returns (uint256 listingId) {
        PatchedMarket.ListingParams memory p = _params(2, _twoMilestones());
        p.deadlines[0] = biddingEnd + firstDeadlineAfterEnd;
        p.deadlines[1] = biddingEnd + firstDeadlineAfterEnd + 7 days;
        vm.prank(creator);
        listingId = market.createListing(p);
        vm.prank(admin);
        market.approveListing(listingId);
    }

    /// Bid in the last seconds, over and over, until the auction end has moved past `target` (or can't move more).
    function _extendPast(uint256 listingId, uint40 target) internal {
        address[2] memory bidders = [alice, bob];
        uint256 i;
        while (market.getListing(listingId).biddingEndsAt <= target) {
            uint40 end = market.getListing(listingId).biddingEndsAt;
            if (end >= market.getListing(listingId).hardEndsAt) break;
            vm.warp(end - 1);
            _bid(bidders[i++ % 2], listingId, 0, market.minNextBid(listingId, 0));
        }
    }

    // ───────────── 1. late bids must not make honest delivery impossible ─────────────

    function test_lateBidsCannotPushTheAuctionPastTheFirstProofDeadline() public {
        id = _tight(1 hours);
        uint40 deadline0 = market.getListing(id).deadlines[0];
        _extendPast(id, deadline0);

        vm.warp(market.getListing(id).biddingEndsAt);
        market.closeBidding(id);

        // The creator must still have time to deliver the first proof...
        vm.prank(creator);
        market.submitProof(id, 0, keccak256("proof"), "ipfs://proof");
        // ...and nobody can fail the listing the moment it closes.
        vm.expectRevert(PatchedMarket.WrongMilestone.selector);
        market.markFailed(id);
    }

    function test_lateBidsCannotLetABidderTakeTheCreatorsBond() public {
        id = _tight(1 hours);
        _extendPast(id, market.getListing(id).deadlines[0]);
        vm.warp(market.getListing(id).biddingEndsAt);
        market.closeBidding(id);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.expectRevert(PatchedMarket.DeadlineNotPassed.selector);
        market.markFailed(id);
        assertEq(usdc.balanceOf(alice), aliceBefore);
        assertEq(usdc.balanceOf(bob), bobBefore);
    }

    function testFuzz_firstDeadlineIsAlwaysReachableAfterClose(uint40 gap, uint8 bids) public {
        gap = uint40(bound(gap, 1, 2 days));
        bids = uint8(bound(bids, 0, 40));
        id = _tight(gap);
        address[2] memory bidders = [alice, bob];
        for (uint256 i; i < bids; ++i) {
            uint40 end = market.getListing(id).biddingEndsAt;
            if (end >= market.getListing(id).hardEndsAt || market.minNextBid(id, 0) >= BUY_NOW) break;
            vm.warp(end - 1);
            _bid(bidders[i % 2], id, 0, market.minNextBid(id, 0));
        }
        if (market.getListing(id).soldMask == 0 && market.getPatch(id, 0).topBidder == address(0)) _bid(alice, id, 0, FLOOR);
        vm.warp(market.getListing(id).biddingEndsAt);
        market.closeBidding(id);

        // Whatever the bidding did, the creator gets at least an hour after the close to post the first proof.
        assertGe(market.getListing(id).deadlines[0], block.timestamp + 1 hours);
        vm.prank(creator);
        market.submitProof(id, 0, keccak256("proof"), "ipfs://proof");
    }

    // ───────────── 2. a pause stops the calls, not the clock ─────────────

    function test_pausedThroughAProofDeadline_creatorGetsGraceAfterUnpause() public {
        id = _delivering();
        uint40 deadline0 = market.getListing(id).deadlines[0];

        vm.warp(deadline0 - 1 hours);
        vm.prank(admin);
        market.pause();
        vm.warp(deadline0 + 2 hours); // the deadline passes while paused
        vm.prank(admin);
        market.unpause();

        // Anyone calling markFailed right after the unpause must not be able to fail an honest creator...
        vm.expectRevert(PatchedMarket.DeadlineNotPassed.selector);
        market.markFailed(id);
        // ...who can still deliver.
        vm.prank(creator);
        market.submitProof(id, 0, keccak256("proof"), "ipfs://proof");
    }

    function test_pauseDoesNotProtectACreatorWhoWasAlreadyLate() public {
        id = _delivering();
        uint40 deadline0 = market.getListing(id).deadlines[0];
        vm.warp(deadline0 + 1); // already late, then a pause happens
        vm.prank(admin);
        market.pause();
        skip(3 days);
        vm.prank(admin);
        market.unpause();
        market.markFailed(id); // a missed deadline still fails the listing
        assertEq(uint8(market.getListing(id).status), uint8(PatchedMarket.Status.Failed));
    }

    // ───────────── 3. admin settings must not rewrite a deal in progress ─────────────

    function test_feeChangedMidDeal_doesNotChangeTheListingsFee() public {
        id = _delivering(); // fee was 5% when this listing was created
        _submit(id, 0);

        vm.prank(admin);
        market.setParams(1000, 500, 500, 5e6, 25e6, 100_000e6, 5 minutes, 1 days, 72 hours); // fee to 10%

        skip(72 hours);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        market.release(id, 0);
        // (200 + 300) * 40% = 200 gross, 5% fee = 10, not 10% = 20
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 10e6);
    }

    function test_reviewWindowChangedMidDeal_doesNotChangeTheListingsWindow() public {
        id = _delivering(); // review window was 72 hours when created
        vm.prank(admin);
        market.setParams(500, 500, 500, 5e6, 25e6, 100_000e6, 5 minutes, 1 days, 14 days);

        _submit(id, 0);
        assertEq(market.getMilestone(id, 0).reviewEndsAt, block.timestamp + 72 hours);
    }

    function test_newListingsPickUpTheNewFee() public {
        vm.prank(admin);
        market.setParams(100, 500, 500, 5e6, 25e6, 100_000e6, 5 minutes, 1 days, 72 hours); // 1%
        id = _delivering();
        _submit(id, 0);
        skip(72 hours);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        market.release(id, 0);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 2e6); // 1% of 200
    }

    /// Listings created before this version have no saved terms: they use the current settings, as they always did.
    function test_listingFromBeforeTheUpgrade_usesCurrentSettings() public {
        id = _delivering();
        // _terms is the mapping at storage slot 17: clear this listing's entry to look like a pre-upgrade listing
        vm.store(address(market), keccak256(abi.encode(id, uint256(17))), bytes32(0));
        vm.prank(admin);
        market.setParams(1000, 500, 500, 5e6, 25e6, 100_000e6, 5 minutes, 1 days, 14 days); // fee 10%, review 14 days

        _submit(id, 0);
        assertEq(market.getMilestone(id, 0).reviewEndsAt, block.timestamp + 14 days);
        skip(14 days);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        market.release(id, 0);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 20e6); // 10% of 200
    }

    // ───────────── 4. disputed money must have a way out ─────────────

    function test_unresolvedDisputeCanBeSettledByAnyoneAfterTheTimeout() public {
        id = _delivering();
        _submit(id, 0);
        vm.prank(alice);
        market.dispute(id, 0, 0, "json:{}");
        skip(72 hours);
        market.release(id, 0); // bob's part is paid; alice's disputed part stays held

        // Before the timeout nobody but an admin can settle it.
        vm.expectRevert(PatchedMarket.DisputeNotStale.selector);
        market.settleStale(id, 0, 0);

        // Admin never answers. After the timeout anyone can split it down the middle.
        vm.warp(market.getMilestone(id, 0).reviewEndsAt + 30 days);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        market.settleStale(id, 0, 0);
        // Patch 0 was won at 200; milestone 0 is 40% = 80. Half to the creator (minus 5% fee), half back to alice.
        assertEq(usdc.balanceOf(alice) - aliceBefore, 40e6);
        assertEq(usdc.balanceOf(treasury) - treasuryBefore, 2e6);

        // It can only be settled once, and an admin can't settle it again either.
        vm.expectRevert(PatchedMarket.NotDisputed.selector);
        market.settleStale(id, 0, 0);
        vm.prank(admin);
        vm.expectRevert(PatchedMarket.NotDisputed.selector);
        market.resolveDispute(id, 0, 0, 5000);
    }

    // ───────────── 5. who actually gets paid (independent of the contract's own math) ─────────────

    /// alice wins patch 0 at 200, bob patch 1 at 300; milestones 40% / 60%; fee 5%. Every number below is worked out by
    /// hand, not read from the contract, so a mistake that the solvency invariant shares with the code is caught here.
    function test_payoutRecipients_fullLifecycle() public {
        id = _delivering();
        uint256 creatorStart = usdc.balanceOf(creator); // after paying the 25 bond
        uint256 treasuryStart = usdc.balanceOf(treasury);
        uint256 aliceStart = usdc.balanceOf(alice);
        uint256 bobStart = usdc.balanceOf(bob);
        assertEq(usdc.balanceOf(address(market)), 500e6 + 25e6); // winning bids + bond

        _submit(id, 0);
        skip(72 hours);
        market.release(id, 0);
        // 40% of 500 = 200 gross: creator 190, treasury 10
        assertEq(usdc.balanceOf(creator) - creatorStart, 190e6);
        assertEq(usdc.balanceOf(treasury) - treasuryStart, 10e6);
        assertEq(usdc.balanceOf(address(market)), 300e6 + 25e6);

        _submit(id, 1);
        skip(72 hours);
        market.release(id, 1);
        // 60% of 500 = 300 gross: creator 285, treasury 15; the 25 bond goes back to the creator
        assertEq(usdc.balanceOf(creator) - creatorStart, 190e6 + 285e6 + 25e6);
        assertEq(usdc.balanceOf(treasury) - treasuryStart, 25e6);
        assertEq(usdc.balanceOf(alice), aliceStart);
        assertEq(usdc.balanceOf(bob), bobStart);
        assertEq(usdc.balanceOf(address(market)), 0); // nothing left behind
    }

    function test_payoutRecipients_missedDeadline() public {
        id = _delivering();
        _submit(id, 0);
        skip(72 hours);
        market.release(id, 0); // creator paid 40%; 300 of the bids and the 25 bond are still held
        uint256 aliceStart = usdc.balanceOf(alice);
        uint256 bobStart = usdc.balanceOf(bob);
        uint256 creatorStart = usdc.balanceOf(creator);

        vm.warp(market.getListing(id).deadlines[1] + 1);
        market.markFailed(id);
        // alice: remaining 60% of 200 = 120, bond share 25 * 200 / 500 = 10  -> 130
        // bob:   remaining 60% of 300 = 180, bond share 25 * 300 / 500 = 15  -> 195 (takes the rounding remainder)
        assertEq(usdc.balanceOf(alice) - aliceStart, 130e6);
        assertEq(usdc.balanceOf(bob) - bobStart, 195e6);
        assertEq(usdc.balanceOf(creator), creatorStart); // the creator gets nothing more
        assertEq(usdc.balanceOf(address(market)), 0);
    }
}
