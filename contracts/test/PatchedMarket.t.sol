// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";

contract CreateListingTest is BaseTest {
    function test_create_pullsBondAndStartsPending() public {
        uint256 id = _create(4);
        PatchedMarket.Listing memory L = market.getListing(id);
        assertEq(L.creator, creator);
        assertEq(uint8(L.status), uint8(PatchedMarket.Status.Pending));
        assertEq(L.patchCount, 4);
        assertEq(L.milestoneCount, 2);
        assertEq(L.hardEndsAt, biddingEnd + 1 days);
        assertEq(usdc.balanceOf(address(market)), BOND);
        assertEq(market.getPatch(id, 3).buyNow, BUY_NOW);
    }

    function test_create_revertsWhenMilestonesDontSumTo100() public {
        uint16[] memory bps = new uint16[](2);
        bps[0] = 4000;
        bps[1] = 5000;
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.createListing(_params(2, bps));
    }

    function test_create_revertsWhenDeadlinesNotIncreasing() public {
        PatchedMarket.ListingParams memory p = _params(2, _twoMilestones());
        p.deadlines[1] = p.deadlines[0];
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.createListing(p);
    }

    function test_create_revertsWhenFloorAboveBuyNow() public {
        PatchedMarket.ListingParams memory p = _params(2, _twoMilestones());
        p.floors[0] = BUY_NOW + 1;
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.createListing(p);
    }

    function test_create_newCreatorCap() public {
        _setCapAndExtension(1_000e6, 1 days);
        // 3 patches x 500 = 1,500 > 1,000 cap
        PatchedMarket.ListingParams memory p = _params(3, _twoMilestones());
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.OverNewCreatorCap.selector);
        market.createListing(p);
    }

    function test_create_rejectsInactiveEvent() public {
        PatchedMarket.ListingParams memory p = _params(1, _twoMilestones());
        p.eventId = 7;
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.EventInactive.selector);
        market.createListing(p);
    }

    function test_create_withEvent() public {
        vm.prank(admin);
        uint32 eventId = market.createEvent("Token2049", uint40(block.timestamp + 10 days), uint40(block.timestamp + 12 days));
        PatchedMarket.ListingParams memory p = _params(1, _twoMilestones());
        p.eventId = eventId;
        vm.prank(creator);
        uint256 id = market.createListing(p);
        assertEq(market.getListing(id).eventId, eventId);
    }

    function test_approve_reject_cancel() public {
        uint256 a = _create(1);
        uint256 b = _create(1);
        uint256 c = _create(1);
        uint256 before = usdc.balanceOf(creator);

        vm.startPrank(admin);
        market.approveListing(a);
        market.rejectListing(b, 3);
        vm.stopPrank();
        vm.prank(creator);
        market.cancelListing(c);

        assertEq(uint8(market.getListing(a).status), uint8(PatchedMarket.Status.Active));
        assertEq(uint8(market.getListing(b).status), uint8(PatchedMarket.Status.Rejected));
        assertEq(uint8(market.getListing(c).status), uint8(PatchedMarket.Status.Cancelled));
        assertEq(usdc.balanceOf(creator), before + 2 * BOND);
    }

    function test_cancel_revertsAfterFirstBid() public {
        uint256 id = _createActive(1);
        _bid(alice, id, 0, FLOOR);
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.NotActive.selector);
        market.cancelListing(id);
    }

    function test_onlyAdminApproves() public {
        uint256 id = _create(1);
        vm.prank(alice);
        vm.expectRevert();
        market.approveListing(id);
    }
}

contract BiddingTest is BaseTest {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createActive(2);
    }

    function test_bid_firstBidAtFloor() public {
        _bid(alice, id, 0, FLOOR);
        PatchedMarket.Patch memory P = market.getPatch(id, 0);
        assertEq(P.topBidder, alice);
        assertEq(P.topBid, FLOOR);
        assertEq(usdc.balanceOf(address(market)), BOND + FLOOR);
    }

    function test_bid_belowFloorReverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PatchedMarket.BidTooLow.selector, FLOOR));
        market.bid(id, 0, FLOOR - 1);
    }

    function test_bid_minIncrementIsFivePercentOrFiveDollars() public {
        _bid(alice, id, 0, FLOOR); // 100 → min next = max(5%, $5) = 105
        assertEq(market.minNextBid(id, 0), 105e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(PatchedMarket.BidTooLow.selector, uint96(105e6)));
        market.bid(id, 0, 104e6);

        _bid(bob, id, 0, 200e6); // 200 → min next = 210
        assertEq(market.minNextBid(id, 0), 210e6);
    }

    function test_bid_outbidRefundsPreviousInstantly() public {
        uint256 aliceStart = usdc.balanceOf(alice);
        _bid(alice, id, 0, FLOOR);
        _bid(bob, id, 0, 150e6);
        assertEq(usdc.balanceOf(alice), aliceStart);
        assertEq(market.getPatch(id, 0).topBidder, bob);
        assertEq(usdc.balanceOf(address(market)), BOND + 150e6);
    }

    function test_bid_refundFallsBackToWithdrawWhenBlocked() public {
        _bid(alice, id, 0, FLOOR);
        usdc.setBlocked(alice, true);
        _bid(bob, id, 0, 150e6); // must not revert even though alice can't receive
        assertEq(market.refundable(alice), FLOOR);

        usdc.setBlocked(alice, false);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        market.withdraw();
        assertEq(usdc.balanceOf(alice), before + FLOOR);
        assertEq(market.refundable(alice), 0);
    }

    function test_bid_creatorCannotBid() public {
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.CreatorCannotBid.selector);
        market.bid(id, 0, FLOOR);
    }

    function test_bid_badPatch() public {
        vm.prank(alice);
        vm.expectRevert(PatchedMarket.BadPatch.selector);
        market.bid(id, 5, FLOOR);
    }

    function test_bid_pendingListingReverts() public {
        uint256 pending = _create(1);
        vm.prank(alice);
        vm.expectRevert(PatchedMarket.NotActive.selector);
        market.bid(pending, 0, FLOOR);
    }

    function test_bid_afterEndReverts() public {
        vm.warp(biddingEnd);
        vm.prank(alice);
        vm.expectRevert(PatchedMarket.BiddingOver.selector);
        market.bid(id, 0, FLOOR);
    }

    function test_buyNow_locksPatchAtBuyNowPrice() public {
        _bid(alice, id, 0, FLOOR);
        _bid(bob, id, 0, BUY_NOW + 999e6); // overpay is capped at buy-now
        PatchedMarket.Patch memory P = market.getPatch(id, 0);
        assertTrue(P.bought);
        assertEq(P.topBid, BUY_NOW);
        assertEq(usdc.balanceOf(address(market)), BOND + BUY_NOW);

        vm.prank(carol);
        vm.expectRevert(PatchedMarket.AlreadyBought.selector);
        market.bid(id, 0, BUY_NOW);
    }

    function test_buyNow_allowedEvenWhenBelowMinIncrement() public {
        _bid(alice, id, 0, 490e6); // min next would be 514.5 > buy-now 500
        assertEq(market.minNextBid(id, 0), BUY_NOW);
        _bid(bob, id, 0, BUY_NOW);
        assertTrue(market.getPatch(id, 0).bought);
    }

    function test_antiSnipe_extendsListing() public {
        vm.warp(biddingEnd - 2 minutes);
        _bid(alice, id, 0, FLOOR);
        assertEq(market.getListing(id).biddingEndsAt, block.timestamp + 5 minutes);
    }

    function test_antiSnipe_neverPastHardEnd() public {
        _setCapAndExtension(100_000e6, 3 minutes);
        uint256 capped = _createActive(1);
        uint40 hardEnd = market.getListing(capped).hardEndsAt;
        assertEq(hardEnd, biddingEnd + 3 minutes);

        vm.warp(biddingEnd - 1 minutes);
        _bid(alice, capped, 0, FLOOR); // would extend to end + 4m, capped at end + 3m
        assertEq(market.getListing(capped).biddingEndsAt, hardEnd);

        vm.warp(hardEnd - 10 seconds);
        _bid(bob, capped, 0, market.minNextBid(capped, 0)); // no further extension possible
        assertEq(market.getListing(capped).biddingEndsAt, hardEnd);
    }

    function test_antiSnipe_noExtensionOutsideWindow() public {
        _bid(alice, id, 0, FLOOR);
        assertEq(market.getListing(id).biddingEndsAt, biddingEnd);
    }

    function test_bidWithPermit() public {
        (address signer, uint256 pk) = makeAddrAndKey("permitBrand");
        usdc.mint(signer, 1_000e6);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                usdc.DOMAIN_SEPARATOR(),
                keccak256(
                    abi.encode(
                        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                        signer,
                        address(market),
                        uint256(FLOOR),
                        usdc.nonces(signer),
                        deadline
                    )
                )
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        vm.prank(signer);
        market.bidWithPermit(id, 1, FLOOR, deadline, v, r, s);
        assertEq(market.getPatch(id, 1).topBidder, signer);
    }

    function testFuzz_bid_neverBelowMinimum(uint96 first, uint96 second) public {
        first = uint96(bound(first, FLOOR, BUY_NOW - 1));
        _bid(alice, id, 0, first);
        uint96 min = market.minNextBid(id, 0);
        second = uint96(bound(second, 1, 2 * BUY_NOW));
        vm.prank(bob);
        if (second < min) {
            vm.expectRevert();
            market.bid(id, 0, second);
        } else {
            market.bid(id, 0, second);
            PatchedMarket.Patch memory P = market.getPatch(id, 0);
            assertEq(P.topBidder, bob);
            assertEq(P.topBid, second >= BUY_NOW ? BUY_NOW : second);
        }
    }

    function test_pause_blocksBids() public {
        vm.prank(admin);
        market.pause();
        vm.prank(alice);
        vm.expectRevert();
        market.bid(id, 0, FLOOR);
    }
}

contract CloseTest is BaseTest {
    function test_close_mintsReceiptsToWinners() public {
        uint256 id = _delivering();
        PatchedMarket.Listing memory L = market.getListing(id);
        assertEq(uint8(L.status), uint8(PatchedMarket.Status.Delivering));
        assertEq(L.totalEscrow, 500e6);
        assertEq(L.soldMask, 0x3);
        assertEq(receipt.ownerOf(market.tokenIdOf(id, 0)), alice);
        assertEq(receipt.ownerOf(market.tokenIdOf(id, 1)), bob);
    }

    function test_close_beforeEndReverts() public {
        uint256 id = _createActive(2);
        _bid(alice, id, 0, FLOOR);
        vm.expectRevert(PatchedMarket.BiddingNotOver.selector);
        market.closeBidding(id);
    }

    function test_close_earlyWhenEverythingBought() public {
        uint256 id = _createActive(1);
        _bid(alice, id, 0, BUY_NOW);
        market.closeBidding(id);
        assertEq(uint8(market.getListing(id).status), uint8(PatchedMarket.Status.Delivering));
    }

    function test_close_unsoldReturnsBond() public {
        uint256 id = _createActive(1);
        uint256 before = usdc.balanceOf(creator);
        vm.warp(biddingEnd);
        market.closeBidding(id);
        assertEq(uint8(market.getListing(id).status), uint8(PatchedMarket.Status.Unsold));
        assertEq(usdc.balanceOf(creator), before + BOND);
    }

    function test_receipt_cannotBeTransferredDirectly() public {
        uint256 id = _delivering();
        uint256 tokenId = market.tokenIdOf(id, 0);
        vm.prank(alice);
        vm.expectRevert(PatchReceipt.TransfersDisabled.selector);
        receipt.transferFrom(alice, carol, tokenId);
    }

    function test_receipt_tokenURIIsOnchainJson() public {
        vm.prank(alice);
        market.setBrandName("Nodeflux");
        uint256 id = _delivering();
        string memory uri = receipt.tokenURI(market.tokenIdOf(id, 0));
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i; i < n; ++i) out[i] = b[i];
        return string(out);
    }
}

contract MilestoneTest is BaseTest {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _delivering(); // alice 200 on patch 0, bob 300 on patch 1
    }

    function test_fullHappyPath() public {
        uint256 creatorStart = usdc.balanceOf(creator);

        _submit(id, 0);
        vm.expectRevert(PatchedMarket.ReviewNotOver.selector);
        market.release(id, 0);

        vm.warp(vm.getBlockTimestamp() + 72 hours);
        market.release(id, 0); // 40% of 500 = 200, fee 10
        assertEq(usdc.balanceOf(creator), creatorStart + 190e6);
        assertEq(usdc.balanceOf(treasury), 10e6);

        _submit(id, 1);
        vm.warp(vm.getBlockTimestamp() + 72 hours);
        market.release(id, 1); // 60% = 300, fee 15, plus bond back
        assertEq(usdc.balanceOf(creator), creatorStart + 190e6 + 285e6 + BOND);
        assertEq(usdc.balanceOf(treasury), 25e6);
        assertEq(usdc.balanceOf(address(market)), 0);

        assertEq(uint8(market.getListing(id).status), uint8(PatchedMarket.Status.Completed));
        (uint32 completed,, uint128 earned) = market.reputation(creator);
        assertEq(completed, 1);
        assertEq(earned, 475e6);
    }

    function test_submitProof_onlyCurrentMilestone() public {
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.WrongMilestone.selector);
        market.submitProof(id, 1, bytes32(0), "");
    }

    function test_submitProof_afterDeadlineReverts() public {
        vm.warp(market.getListing(id).deadlines[0] + 1);
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.DeadlinePassed.selector);
        market.submitProof(id, 0, bytes32(0), "");
    }

    function test_fastTrack_releasesImmediately() public {
        _submit(id, 0);
        vm.prank(admin);
        market.fastTrack(id, 0);
        market.release(id, 0);
        assertEq(market.getListing(id).nextMilestone, 1);
    }

    function test_dispute_holdsOnlyThatPatch_thenSplit() public {
        uint256 creatorStart = usdc.balanceOf(creator);
        uint256 aliceStart = usdc.balanceOf(alice);
        _submit(id, 0);

        vm.prank(alice);
        market.dispute(id, 0, 0, "ipfs://reason");

        vm.warp(vm.getBlockTimestamp() + 72 hours);
        market.release(id, 0); // only bob's 40% of 300 = 120, fee 6
        assertEq(usdc.balanceOf(creator), creatorStart + 114e6);

        // alice's 40% of 200 = 80 → split 50/50
        vm.prank(admin);
        market.resolveDispute(id, 0, 0, 5000);
        assertEq(usdc.balanceOf(alice), aliceStart + 40e6);
        assertEq(usdc.balanceOf(creator), creatorStart + 114e6 + 38e6);

        vm.prank(admin);
        vm.expectRevert(PatchedMarket.NotDisputed.selector);
        market.resolveDispute(id, 0, 0, 5000);
    }

    function test_dispute_onlyHolder() public {
        _submit(id, 0);
        vm.prank(carol);
        vm.expectRevert(PatchedMarket.NotHolder.selector);
        market.dispute(id, 0, 0, "");
    }

    function test_dispute_afterWindowReverts() public {
        _submit(id, 0);
        vm.warp(vm.getBlockTimestamp() + 72 hours);
        vm.prank(alice);
        vm.expectRevert(PatchedMarket.ReviewOver.selector);
        market.dispute(id, 0, 0, "");
    }

    function test_markFailed_refundsHoldersAndSlashesBond() public {
        uint256 aliceStart = usdc.balanceOf(alice);
        uint256 bobStart = usdc.balanceOf(bob);

        _submit(id, 0);
        vm.warp(vm.getBlockTimestamp() + 72 hours);
        market.release(id, 0);

        vm.expectRevert(PatchedMarket.DeadlineNotPassed.selector);
        market.markFailed(id);

        vm.warp(market.getListing(id).deadlines[1] + 1);
        market.markFailed(id);

        // 60% left: alice 120, bob 180; bond 25 split 200:300 → 10 / 15
        assertEq(usdc.balanceOf(alice), aliceStart + 130e6);
        assertEq(usdc.balanceOf(bob), bobStart + 195e6);
        assertEq(usdc.balanceOf(address(market)), 0);
        assertEq(uint8(market.getListing(id).status), uint8(PatchedMarket.Status.Failed));
        (, uint32 failed,) = market.reputation(creator);
        assertEq(failed, 1);
    }
}

contract ResaleTest is BaseTest {
    uint256 internal id;
    uint256 internal tokenId;

    function setUp() public override {
        super.setUp();
        id = _delivering();
        tokenId = market.tokenIdOf(id, 0); // alice's patch
    }

    function test_resale_paysSellerAndRoyaltyAndMovesRights() public {
        uint256 aliceStart = usdc.balanceOf(alice);
        uint256 creatorStart = usdc.balanceOf(creator);

        vm.prank(alice);
        market.listForResale(tokenId, 700e6);
        vm.prank(carol);
        market.buyResale(tokenId, 700e6);

        assertEq(receipt.ownerOf(tokenId), carol);
        assertEq(usdc.balanceOf(alice), aliceStart + 665e6);
        assertEq(usdc.balanceOf(creator), creatorStart + 35e6);
        assertEq(market.resalePrice(tokenId), 0);

        // carol now holds the dispute rights, alice doesn't
        _submit(id, 0);
        vm.prank(alice);
        vm.expectRevert(PatchedMarket.NotHolder.selector);
        market.dispute(id, 0, 0, "");
        vm.prank(carol);
        market.dispute(id, 0, 0, "");
    }

    function test_resale_priceProtection() public {
        vm.prank(alice);
        market.listForResale(tokenId, 700e6);
        vm.prank(carol);
        vm.expectRevert(PatchedMarket.PriceAboveMax.selector);
        market.buyResale(tokenId, 600e6);
    }

    function test_resale_onlyHolderCanList() public {
        vm.prank(bob);
        vm.expectRevert(PatchedMarket.NotHolder.selector);
        market.listForResale(tokenId, 700e6);
    }

    function test_resale_royaltyInfo() public view {
        (address to, uint256 amount) = receipt.royaltyInfo(tokenId, 1_000e6);
        assertEq(to, creator);
        assertEq(amount, 50e6);
    }
}

contract TeamSplitTest is BaseTest {
    function test_payoutsSplitAcrossTeam() public {
        address m1 = makeAddr("member1");
        address m2 = makeAddr("member2");
        address m3 = makeAddr("member3");
        PatchedMarket.ListingParams memory p = _params(1, _twoMilestones());
        p.surface = PatchedMarket.Surface.Hoodie;
        p.payees = new address[](3);
        p.shares = new uint16[](3);
        (p.payees[0], p.payees[1], p.payees[2]) = (m1, m2, m3);
        (p.shares[0], p.shares[1], p.shares[2]) = (3334, 3333, 3333);

        vm.prank(creator);
        uint256 id = market.createListing(p);
        vm.prank(admin);
        market.approveListing(id);
        _bid(alice, id, 0, 300e6);
        vm.warp(biddingEnd);
        market.closeBidding(id);

        _submit(id, 0);
        vm.warp(vm.getBlockTimestamp() + 72 hours);
        market.release(id, 0); // 120 gross, 6 fee, 114 net
        assertEq(usdc.balanceOf(m1) + usdc.balanceOf(m2) + usdc.balanceOf(m3), 114e6);
        assertEq(usdc.balanceOf(m1), 38_007_600); // 114 * 33.34%
    }

    function test_sharesMustSumTo100() public {
        PatchedMarket.ListingParams memory p = _params(1, _twoMilestones());
        p.payees = new address[](2);
        p.shares = new uint16[](2);
        (p.payees[0], p.payees[1]) = (alice, bob);
        (p.shares[0], p.shares[1]) = (5000, 4000);
        vm.prank(creator);
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.createListing(p);
    }
}

contract BidForTest is BaseTest {
    uint256 internal id;
    address internal intermediary = makeAddr("auroraIntermediary");

    function setUp() public override {
        super.setUp();
        id = _createActive(2);
        usdc.mint(intermediary, 10_000e6);
        vm.prank(intermediary);
        usdc.approve(address(market), type(uint256).max);
    }

    function _bidFor(address bidder, uint8 patchId, uint96 amount) internal {
        vm.prank(intermediary);
        market.bidFor(bidder, id, patchId, amount);
    }

    function test_bidFor_bidBelongsToBidderNotPayer() public {
        _bidFor(alice, 0, 150e6);
        PatchedMarket.Patch memory P = market.getPatch(id, 0);
        assertEq(P.topBidder, alice);
        assertEq(P.topBid, 150e6);
        assertEq(usdc.balanceOf(intermediary), 10_000e6 - 150e6);

        // outbid refund goes to alice, not to the intermediary
        uint256 aliceBefore = usdc.balanceOf(alice);
        _bid(bob, id, 0, 200e6);
        assertEq(usdc.balanceOf(alice), aliceBefore + 150e6);

        // winning receipt goes to the bidder
        _bidFor(alice, 1, 120e6);
        vm.warp(biddingEnd);
        market.closeBidding(id);
        assertEq(receipt.ownerOf(market.tokenIdOf(id, 1)), alice);
    }

    function test_bidFor_forwardsFundsWhenOutbidInTheMeantime() public {
        _bid(bob, id, 0, 300e6); // someone bid higher while alice's funds were in flight
        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.expectEmit(true, true, true, true);
        emit PatchedMarket.BidForwarded(id, 0, alice, intermediary, 200e6, PatchedMarket.BidTooLow.selector);
        _bidFor(alice, 0, 200e6);
        assertEq(market.getPatch(id, 0).topBidder, bob);
        assertEq(usdc.balanceOf(alice), aliceBefore + 200e6);
        assertEq(usdc.balanceOf(address(market)), BOND + 300e6);
    }

    function test_bidFor_forwardsWhenBiddingOver() public {
        vm.warp(biddingEnd);
        uint256 aliceBefore = usdc.balanceOf(alice);
        _bidFor(alice, 0, 200e6);
        assertEq(usdc.balanceOf(alice), aliceBefore + 200e6);
    }

    function test_bidFor_forwardsWhenCreatorIsBidder() public {
        uint256 before = usdc.balanceOf(creator);
        _bidFor(creator, 0, 200e6);
        assertEq(usdc.balanceOf(creator), before + 200e6);
        assertEq(market.getPatch(id, 0).topBidder, address(0));
    }

    function test_bidFor_buyNowForwardsExcess() public {
        uint256 aliceBefore = usdc.balanceOf(alice);
        _bidFor(alice, 0, BUY_NOW + 70e6);
        assertTrue(market.getPatch(id, 0).bought);
        assertEq(market.getPatch(id, 0).topBidder, alice);
        assertEq(usdc.balanceOf(alice), aliceBefore + 70e6);
        assertEq(usdc.balanceOf(intermediary), 10_000e6 - BUY_NOW - 70e6);
    }

    function test_bidFor_rejectsZeroBidder() public {
        vm.prank(intermediary);
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.bidFor(address(0), id, 0, 200e6);
    }

    function testFuzz_bidFor_neverStrandsFunds(uint96 amount, bool biddingOver) public {
        amount = uint96(bound(amount, 1, 2_000e6));
        if (biddingOver) vm.warp(biddingEnd);
        uint256 payerBefore = usdc.balanceOf(intermediary);
        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 marketBefore = usdc.balanceOf(address(market));
        _bidFor(alice, 0, amount);
        // every cent the intermediary paid is either escrowed as alice's bid or sitting in alice's wallet
        uint256 paid = payerBefore - usdc.balanceOf(intermediary);
        assertEq(paid, amount);
        assertEq(paid, (usdc.balanceOf(alice) - aliceBefore) + (usdc.balanceOf(address(market)) - marketBefore));
        assertEq(usdc.balanceOf(intermediary), payerBefore - amount);
    }
}
