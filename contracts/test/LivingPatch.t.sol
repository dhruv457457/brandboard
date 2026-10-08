// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {PatchRenderer, PatchCard, PatchArt} from "../src/PatchRenderer.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";
import {MarketFactory} from "../script/MarketFactory.sol";
import {PatchReceiptV1} from "./mocks/PatchReceiptV1.sol";
import {BaseTest} from "./Base.t.sol";

/// Lets a test read the renderer's internal card.
contract RendererHarness is PatchRenderer {
    constructor(address owner_) PatchRenderer(owner_, "") {}

    function card(PatchedMarket.TokenView memory v) external pure returns (PatchCard memory) {
        return _card(v);
    }
}

/// The Living Patch: stages follow the listing, the art redraws itself, and an upgrade strands nothing.
contract LivingPatchTest is BaseTest {
    event BatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId);

    function _tv(uint256 id, uint8 patchId) internal view returns (PatchedMarket.TokenView memory) {
        return market.tokenView(market.tokenIdOf(id, patchId));
    }

    function _svg(uint256 id, uint8 patchId) internal view returns (string memory) {
        return renderer.image(market, market.tokenIdOf(id, patchId));
    }

    function _has(string memory haystack, string memory needle) internal pure returns (bool) {
        return vm.contains(haystack, needle);
    }

    function test_won_stage_and_sponsor_numbers() public {
        uint256 id = _delivering(); // alice 200 on patch 0, bob 300 on patch 1
        PatchedMarket.TokenView memory a = _tv(id, 0);
        PatchedMarket.TokenView memory b = _tv(id, 1);
        assertEq(a.stage, market.STAGE_WON());
        assertEq(a.sponsorNo, 1);
        assertEq(b.sponsorNo, 2);
        assertEq(market.creatorSponsorCount(creator), 2);
        assertEq(a.amount, 200e6);
        assertEq(a.winner, alice);
        assertEq(a.creator, creator);
        assertEq(a.proofsDone, 0);
        assertEq(a.milestoneCount, 2);
    }

    function test_sponsor_numbers_continue_across_listings() public {
        _delivering();
        biddingEnd = uint40(block.timestamp + 2 days);
        uint256 second = _createActive(2);
        _bid(carol, second, 0, 150e6);
        vm.warp(biddingEnd);
        market.closeBidding(second);
        assertEq(_tv(second, 0).sponsorNo, 3);
    }

    function test_art_follows_the_listing_through_every_stage() public {
        vm.prank(alice);
        market.setBrandName("Nodeflux");
        vm.prank(creator);
        market.setBrandName("mira");
        uint256 id = _delivering();

        string memory won = _svg(id, 0);
        assertTrue(_has(won, ">WON</text>"));
        assertTrue(_has(won, "Nodeflux"));
        assertTrue(_has(won, "The first brand to back @mira."));
        assertFalse(_has(won, 'id="stamp-printed"')); // no stamp before a proof

        _submit(id, 0);
        PatchedMarket.TokenView memory v = _tv(id, 0);
        assertEq(v.stage, market.STAGE_PRINTED());
        assertEq(v.printedAt, block.timestamp);
        assertEq(v.proofURI, "ipfs://proof");
        string memory printed = _svg(id, 0);
        assertTrue(_has(printed, ">PRINTED</text>"));
        assertTrue(_has(printed, 'id="stamp-printed"'));
        assertFalse(_has(printed, 'id="stamp-seen"'));
        assertEq(market.proofURIOf(id, 0), "ipfs://proof");
        assertEq(market.proofAt(id, 0), block.timestamp);

        // Release, then the second proof: seen 1 of 1.
        uint256 t = biddingEnd;
        vm.warp(t + 73 hours);
        market.release(id, 0);
        _submit(id, 1);
        assertEq(_tv(id, 0).stage, market.STAGE_SEEN());
        assertTrue(_has(_svg(id, 0), ">SEEN 1/1</text>"));

        vm.warp(t + 146 hours);
        market.release(id, 1);
        assertEq(_tv(id, 0).stage, market.STAGE_DELIVERED());
        string memory done = _svg(id, 0);
        assertTrue(_has(done, ">DELIVERED</text>"));
        assertTrue(_has(done, 'id="stamp-delivered"'));
        assertTrue(_has(done, ">SEEN</text>")); // the seen stamp stays on the delivered card
    }

    function test_failed_listing_is_refunded_and_unpicked() public {
        uint256 id = _delivering();
        vm.warp(biddingEnd + 8 days); // past the first deadline, no proof
        market.markFailed(id);
        assertEq(_tv(id, 0).stage, market.STAGE_REFUNDED());
        string memory svg = _svg(id, 0);
        assertTrue(_has(svg, "REFUNDED $200"));
        assertTrue(_has(svg, 'id="grey"'));
    }

    function test_dispute_marks_the_token_until_resolved() public {
        uint256 id = _delivering();
        _submit(id, 0);
        vm.prank(alice);
        market.dispute(id, 0, 0, "ipfs://why");
        assertEq(_tv(id, 0).stage, market.STAGE_DISPUTED());
        assertEq(_tv(id, 1).stage, market.STAGE_PRINTED()); // bob did not dispute
        assertTrue(_has(_svg(id, 0), "PROOF DISPUTED"));

        vm.prank(admin);
        market.resolveDispute(id, 0, 0, 5000);
        assertEq(_tv(id, 0).stage, market.STAGE_PRINTED());
    }

    function test_cover_uri_is_kept_and_the_newest_wins() public {
        uint256 id = _delivering();
        vm.prank(creator);
        market.submitProof(id, 0, keccak256("a"), "ipfs://proof-a", "ipfs://photo-a");
        assertEq(_tv(id, 0).coverURI, "ipfs://photo-a");
        assertEq(market.proofCoverOf(id, 0), "ipfs://photo-a");

        vm.warp(uint256(biddingEnd) + 73 hours);
        market.release(id, 0);
        // A proof without a cover keeps showing the last cover.
        _submit(id, 1);
        PatchedMarket.TokenView memory v = _tv(id, 0);
        assertEq(v.coverURI, "ipfs://photo-a");
        assertEq(v.proofURI, "ipfs://proof");
    }

    function test_proofs_tell_the_receipt_to_refresh() public {
        uint256 id = _delivering();
        vm.expectEmit(address(receipt));
        emit BatchMetadataUpdate(id << 8, (id << 8) | 0xFF);
        _submit(id, 0);
    }

    function test_no_brand_name_shows_a_short_address_not_a_placeholder() public {
        uint256 id = _delivering();
        string memory svg = _svg(id, 0);
        assertFalse(_has(svg, "Your brand here"));
        assertTrue(_has(svg, "0x"));
        assertTrue(_has(svg, ".."));
    }

    function test_long_brand_names_shrink_to_fit() public {
        vm.prank(alice);
        market.setBrandName("Patched Test Brand Studio Ltd");
        uint256 id = _delivering();
        string memory svg = _svg(id, 0);
        // 29 characters: on the rounded patch (420 wide) 42000 / (29 * 66) = 21px, in the card header (480 wide) 25px.
        assertTrue(_has(svg, 'font-size="21"'));
        assertTrue(_has(svg, 'font-size="25"'));
    }

    function test_names_keep_their_case_in_the_metadata() public {
        vm.prank(creator);
        market.setBrandName("mira-demo");
        uint256 id = _delivering();
        PatchedMarket.TokenView memory v = _tv(id, 0);
        PatchCard memory c = new RendererHarness(address(this)).card(v);
        // The card shouts the creator's name in capitals; drawing it must not change the name used for the traits.
        PatchArt.render(c);
        assertEq(c.creator, "mira-demo");
        assertEq(c.eventStr, "Outfit");
    }

    function test_a_receipt_without_a_sponsor_number_shows_which_spot_it_is() public {
        uint256 id = _delivering();
        PatchedMarket.TokenView memory v = _tv(id, 0);
        v.sponsorNo = 0; // minted before sponsor numbers existed
        PatchCard memory c = new RendererHarness(address(this)).card(v);
        string memory svg = PatchArt.render(c);
        assertFalse(_has(svg, "No.000"));
        assertTrue(_has(svg, string.concat(">#", vm.toString(id), ".1<")));
    }

    function test_token_uri_is_json_with_the_traits() public {
        vm.prank(alice);
        market.setBrandName("Nodeflux");
        uint256 id = _delivering();
        string memory uri = receipt.tokenURI(market.tokenIdOf(id, 0));
        assertTrue(_has(uri, "data:application/json;base64,"));
        assertGt(bytes(uri).length, 5000);
    }

    function test_no_event_does_not_repeat_the_surface() public {
        uint256 id = _delivering(); // _params uses eventId 0
        assertEq(_tv(id, 0).eventName, bytes32(0));
        string memory svg = _svg(id, 0);
        assertTrue(_has(svg, '">OUTFIT &#183; '));
        assertFalse(_has(svg, "&#183; OUTFIT<"));
    }

    function test_tiers_follow_the_winning_bid() public {
        PatchedMarket.ListingParams memory p = _params(3, _twoMilestones());
        p.floors[0] = 50e6;
        p.floors[2] = 1_000e6;
        p.buyNows[2] = 3_000e6;
        vm.prank(creator);
        uint256 id = market.createListing(p);
        vm.prank(admin);
        market.approveListing(id);
        _bid(alice, id, 0, 50e6);
        _bid(bob, id, 1, 450e6);
        _bid(carol, id, 2, 1_000e6);
        vm.warp(biddingEnd);
        market.closeBidding(id);
        assertTrue(_has(_svg(id, 0), "COTTON"));
        assertTrue(_has(_svg(id, 1), "SILK"));
        string memory gold = _svg(id, 2);
        assertTrue(_has(gold, "GOLD"));
        assertTrue(_has(gold, ">$1,000<"));
        assertTrue(_has(gold, 'id="sheen"'));
    }

    function test_collection_metadata_and_interfaces() public view {
        assertTrue(_has(receipt.contractURI(), "data:application/json;base64,"));
        assertTrue(receipt.supportsInterface(0x49064906)); // ERC-4906
        assertTrue(receipt.supportsInterface(0x2a55205a)); // ERC-2981
        assertTrue(receipt.supportsInterface(0x80ac58cd)); // ERC-721
    }

    function test_transfers_stay_market_only() public {
        uint256 id = _delivering();
        uint256 tokenId = market.tokenIdOf(id, 0);
        vm.prank(alice);
        vm.expectRevert(PatchReceipt.TransfersDisabled.selector);
        receipt.transferFrom(alice, bob, tokenId);
    }

    function test_renderer_is_swappable_by_the_owner_only() public {
        PatchRenderer next = new PatchRenderer(address(this), "");
        vm.prank(alice);
        vm.expectRevert();
        receipt.setRenderer(next);
        receipt.setRenderer(next);
        assertEq(address(receipt.renderer()), address(next));
    }

    function test_jsonUnsafeProofLinkCannotBreakTheMetadata() public {
        uint256 id = _delivering();
        vm.prank(creator);
        market.submitProof(id, 0, keccak256("x"), 'ipfs://a"},{"trait_type":"Hack', "ipfs://ok");
        string memory uri = receipt.tokenURI(market.tokenIdOf(id, 0));
        assertGt(bytes(uri).length, 100); // does not revert
    }
}

/// An upgrade from the first receipt must not strand a token: old listings keep theirs, new ones use the new receipt.
contract ReceiptUpgradeTest is BaseTest {
    PatchReceiptV1 internal oldReceipt;
    PatchReceipt internal newReceipt;

    function setUp() public override {
        super.setUp();
        // Re-wire the market the way the live testnet looked: the first receipt, no renderer.
        oldReceipt = new PatchReceiptV1();
        (market,) = MarketFactory.deploy(IERC20(address(usdc)), IPatchReceipt(address(oldReceipt)), admin, treasury);
        oldReceipt.setMarket(market);
        _setCapAndExtension(100_000e6, 1 days);
        address[4] memory users = [creator, alice, bob, carol];
        for (uint256 i; i < users.length; ++i) {
            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);
        }
        newReceipt = new PatchReceipt(address(this));
        newReceipt.setRenderer(renderer);
        newReceipt.setMarket(market);
    }

    function test_old_listing_keeps_its_tokens_new_listing_uses_the_new_receipt() public {
        uint256 oldId = _createActive(2);
        _bid(alice, oldId, 0, 200e6); // still bidding when the receipt is replaced

        vm.prank(admin);
        market.setReceipt(IPatchReceipt(address(newReceipt)));
        assertEq(address(market.legacyReceipt()), address(oldReceipt));
        assertEq(market.legacyBelowListing(), oldId + 1);
        assertEq(market.receiptFor(oldId), address(oldReceipt));

        uint256 newId = _createActive(2);
        assertEq(market.receiptFor(newId), address(newReceipt));
        _bid(bob, newId, 0, 300e6);

        vm.warp(biddingEnd);
        market.closeBidding(oldId);
        market.closeBidding(newId);
        assertEq(oldReceipt.ownerOf(market.tokenIdOf(oldId, 0)), alice);
        assertEq(newReceipt.ownerOf(market.tokenIdOf(newId, 0)), bob);

        // Money paths work on both receipts: holder-gated approve, resale.
        vm.prank(creator);
        market.submitProof(oldId, 0, keccak256("o"), "ipfs://old");
        vm.prank(alice);
        market.approveProof(oldId, 0, 0);
        vm.prank(creator);
        market.submitProof(newId, 0, keccak256("n"), "ipfs://new");
        vm.prank(bob);
        market.approveProof(newId, 0, 0);

        uint256 oldToken = market.tokenIdOf(oldId, 0);
        uint256 newToken = market.tokenIdOf(newId, 0);
        vm.prank(alice);
        market.listForResale(oldToken, 250e6);
        vm.prank(carol);
        market.buyResale(oldToken, 250e6);
        assertEq(oldReceipt.ownerOf(oldToken), carol);

        vm.prank(bob);
        market.listForResale(newToken, 350e6);
        vm.prank(carol);
        market.buyResale(newToken, 350e6);
        assertEq(newReceipt.ownerOf(newToken), carol);
    }

    function test_failing_old_listing_refunds_the_old_holder_after_the_switch() public {
        uint256 oldId = _createActive(1);
        _bid(alice, oldId, 0, 200e6);
        vm.warp(biddingEnd);
        market.closeBidding(oldId); // minted on the old receipt
        vm.prank(admin);
        market.setReceipt(IPatchReceipt(address(newReceipt)));

        uint256 before = usdc.balanceOf(alice);
        vm.warp(biddingEnd + 8 days);
        market.markFailed(oldId);
        assertGt(usdc.balanceOf(alice), before);
    }

    function test_setReceipt_only_once_and_only_admin() public {
        vm.prank(alice);
        vm.expectRevert();
        market.setReceipt(IPatchReceipt(address(newReceipt)));

        PatchReceipt another = new PatchReceipt(address(this));
        vm.startPrank(admin);
        market.setReceipt(IPatchReceipt(address(newReceipt)));
        vm.expectRevert(PatchedMarket.InvalidParams.selector);
        market.setReceipt(IPatchReceipt(address(another)));
        vm.stopPrank();
    }

    function test_listing_that_closes_after_the_switch_still_counts_for_sponsor_numbers() public {
        uint256 oldId = _createActive(1);
        _bid(alice, oldId, 0, 200e6);
        vm.prank(admin);
        market.setReceipt(IPatchReceipt(address(newReceipt)));
        vm.warp(biddingEnd);
        market.closeBidding(oldId);
        assertEq(market.sponsorNo(market.tokenIdOf(oldId, 0)), 1);
    }
}
