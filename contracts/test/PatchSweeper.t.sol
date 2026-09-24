// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {BaseTest} from "./Base.t.sol";
import {PatchSweeper} from "../src/PatchSweeper.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

contract PatchSweeperTest is BaseTest {
    PatchSweeper internal sweeper;
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        sweeper = new PatchSweeper(market);
        id = _createActive(3);
        vm.prank(alice);
        usdc.approve(address(sweeper), type(uint256).max);
    }

    function _ids(uint8 a, uint8 b) internal pure returns (uint8[] memory x) {
        x = new uint8[](2);
        (x[0], x[1]) = (a, b);
    }

    function _amts(uint96 a, uint96 b) internal pure returns (uint96[] memory x) {
        x = new uint96[](2);
        (x[0], x[1]) = (a, b);
    }

    function test_sweepsTwoPatches() public {
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        sweeper.sweep(id, _ids(0, 2), _amts(100e6, 150e6));
        assertEq(market.getPatch(id, 0).topBidder, alice);
        assertEq(market.getPatch(id, 2).topBidder, alice);
        assertEq(market.getPatch(id, 2).topBid, 150e6);
        assertEq(before - usdc.balanceOf(alice), 250e6);
        assertEq(usdc.balanceOf(address(sweeper)), 0, "holds no funds");
    }

    function test_allOrNothing() public {
        _bid(bob, id, 2, 200e6);
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(PatchSweeper.BidNotPlaced.selector, uint8(2)));
        sweeper.sweep(id, _ids(0, 2), _amts(100e6, 150e6)); // 150 is below bob's 200
        assertEq(market.getPatch(id, 0).topBidder, address(0), "first bid rolled back");
        assertEq(usdc.balanceOf(alice), before);
    }

    function test_outbidRefundsGoToTheBrand() public {
        vm.prank(alice);
        sweeper.sweep(id, _ids(0, 1), _amts(100e6, 100e6));
        uint256 before = usdc.balanceOf(alice);
        _bid(bob, id, 0, 120e6);
        assertEq(usdc.balanceOf(alice) - before, 100e6);
    }

    function test_buyNowInsideASweepReturnsTheChange() public {
        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        sweeper.sweep(id, _ids(0, 1), _amts(600e6, 100e6)); // 600 > buy-now 500
        assertTrue(market.getPatch(id, 0).bought);
        assertEq(before - usdc.balanceOf(alice), 600e6, "paid buy-now 500 + bid 100");
        assertEq(usdc.balanceOf(address(sweeper)), 0);
    }

    function test_rejectsBadInput() public {
        vm.startPrank(alice);
        vm.expectRevert(PatchSweeper.Empty.selector);
        sweeper.sweep(id, new uint8[](0), new uint96[](0));
        vm.expectRevert(PatchSweeper.LengthMismatch.selector);
        sweeper.sweep(id, _ids(0, 1), new uint96[](1));
        vm.stopPrank();
    }

    function test_permitSweepInOneCall() public {
        (address brand, uint256 pk) = makeAddrAndKey("sweep-brand");
        usdc.mint(brand, 1_000e6);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                brand, address(sweeper), 250e6, usdc.nonces(brand), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash)));
        vm.prank(brand);
        sweeper.sweepWithPermit(id, _ids(0, 1), _amts(100e6, 150e6), deadline, v, r, s);
        assertEq(market.getPatch(id, 1).topBidder, brand);
        assertEq(usdc.balanceOf(brand), 750e6);
    }
}
