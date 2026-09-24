// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PatchAutoBidder} from "../src/PatchAutoBidder.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

contract PatchAutoBidderTest is BaseTest {
    PatchAutoBidder internal auto_;
    address internal keeper = makeAddr("keeper");
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        auto_ = new PatchAutoBidder(market);
        id = _createActive(2);
        vm.prank(alice);
        usdc.approve(address(auto_), type(uint256).max);
    }

    function _auto(uint96 max) internal {
        vm.prank(alice);
        auto_.setAutoBid(id, 0, max);
    }

    function test_opensAtFloor() public {
        _auto(300e6);
        vm.prank(keeper);
        uint96 amount = auto_.execute(alice, id, 0);
        assertEq(amount, FLOOR);
        PatchedMarket.Patch memory p = market.getPatch(id, 0);
        assertEq(p.topBidder, alice);
        assertEq(p.topBid, FLOOR);
        assertEq(usdc.balanceOf(address(auto_)), 0, "holds no funds");
    }

    function test_answersOutbidAtMinimumStep() public {
        _auto(300e6);
        _bid(alice, id, 0, 100e6);
        _bid(bob, id, 0, 150e6);
        uint256 before = usdc.balanceOf(alice);

        vm.prank(keeper);
        uint96 amount = auto_.execute(alice, id, 0);
        assertEq(amount, market.getPatch(id, 0).topBid);
        assertEq(amount, 157_500_000); // 150 + 5%
        assertEq(market.getPatch(id, 0).topBidder, alice);
        // alice's first bid (100) was already refunded when bob outbid her; now 157.5 is locked
        assertEq(before - usdc.balanceOf(alice), amount);
    }

    function test_revertsWhenLeading() public {
        _auto(300e6);
        _bid(alice, id, 0, 100e6);
        vm.expectRevert(PatchAutoBidder.AlreadyLeading.selector);
        auto_.execute(alice, id, 0);
    }

    function test_neverExceedsMax() public {
        _auto(200e6);
        _bid(bob, id, 0, 200e6);
        vm.expectRevert(abi.encodeWithSelector(PatchAutoBidder.OverMax.selector, uint96(210e6), uint96(200e6)));
        auto_.execute(alice, id, 0);
    }

    function test_noRuleNoBid() public {
        vm.expectRevert(PatchAutoBidder.NoAutoBid.selector);
        auto_.execute(alice, id, 0);
        _auto(300e6);
        _auto(0); // turned off
        vm.expectRevert(PatchAutoBidder.NoAutoBid.selector);
        auto_.execute(alice, id, 0);
    }

    function test_rulesAreIsolatedPerPatch() public {
        _auto(300e6);
        vm.expectRevert(PatchAutoBidder.NoAutoBid.selector);
        auto_.execute(alice, id, 1);
    }

    function test_revertsAfterBiddingEnds() public {
        _auto(300e6);
        _bid(bob, id, 0, 150e6);
        vm.warp(biddingEnd);
        uint256 before = usdc.balanceOf(alice);
        vm.expectRevert(PatchAutoBidder.BidNotPlaced.selector);
        auto_.execute(alice, id, 0);
        assertEq(usdc.balanceOf(alice), before);
    }

    function test_buysAtBuyNowWhenStepPassesIt() public {
        vm.prank(alice);
        auto_.setAutoBid(id, 0, BUY_NOW);
        _bid(bob, id, 0, 480e6); // next step (504) passes buy-now (500)
        vm.prank(keeper);
        uint96 amount = auto_.execute(alice, id, 0);
        assertEq(amount, BUY_NOW);
        PatchedMarket.Patch memory p = market.getPatch(id, 0);
        assertTrue(p.bought);
        assertEq(p.topBidder, alice);
    }

    function test_twoAutoBiddersSettleAtTheLowerMaxPlusStep() public {
        _auto(300e6);
        vm.prank(bob);
        usdc.approve(address(auto_), type(uint256).max);
        vm.prank(bob);
        auto_.setAutoBid(id, 0, 250e6);

        // ping-pong until someone runs out of room
        for (uint256 i; i < 40; ++i) {
            address leader = market.getPatch(id, 0).topBidder;
            address other = leader == alice ? bob : alice;
            try auto_.execute(other, id, 0) {} catch { break; }
        }
        PatchedMarket.Patch memory p = market.getPatch(id, 0);
        assertEq(p.topBidder, alice, "higher max wins");
        assertLe(uint256(p.topBid), uint256(300e6));
        assertGt(uint256(p.topBid), uint256(250e6) * 100 / 105, "bob was pushed near his max");
    }

    function test_permitSetsAllowanceAndRuleInOneCall() public {
        (address brand, uint256 pk) = makeAddrAndKey("permit-brand");
        usdc.mint(brand, 1_000e6);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                brand, address(auto_), 3_000e6, usdc.nonces(brand), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
        vm.prank(brand);
        auto_.setAutoBidWithPermit(id, 0, 300e6, 3_000e6, deadline, v, r, s);
        assertEq(usdc.allowance(brand, address(auto_)), 3_000e6);
        assertEq(auto_.maxBid(brand, id, 0), 300e6);

        auto_.execute(brand, id, 0);
        assertEq(market.getPatch(id, 0).topBidder, brand);
    }
}
