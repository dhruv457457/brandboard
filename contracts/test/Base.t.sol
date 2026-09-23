// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";

abstract contract BaseTest is Test {
    MockUSDC internal usdc;
    PatchReceipt internal receipt;
    PatchedMarket internal market;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice"); // brand
    address internal bob = makeAddr("bob"); // brand
    address internal carol = makeAddr("carol"); // brand

    uint96 internal constant FLOOR = 100e6;
    uint96 internal constant BUY_NOW = 500e6;
    uint64 internal constant BOND = 25e6;
    uint40 internal biddingEnd;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        receipt = new PatchReceipt();
        market = new PatchedMarket(IERC20(address(usdc)), IPatchReceipt(address(receipt)), admin, treasury);
        receipt.setMarket(market);
        biddingEnd = uint40(block.timestamp + 2 days);
        // most tests use a seasoned creator; the cap itself is tested explicitly
        _setCapAndExtension(100_000e6, 1 days);

        address[4] memory users = [creator, alice, bob, carol];
        for (uint256 i; i < users.length; ++i) {
            usdc.mint(users[i], 100_000e6);
            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);
        }
    }

    // ─────────────── helpers ───────────────

    function _setCapAndExtension(uint96 cap, uint32 maxExtension) internal {
        vm.prank(admin);
        market.setParams(500, 500, 500, 5e6, 25e6, cap, 5 minutes, maxExtension, 72 hours);
    }

    function _params(uint256 patches, uint16[] memory bps) internal view returns (PatchedMarket.ListingParams memory p) {
        p.surface = PatchedMarket.Surface.Outfit;
        p.biddingEndsAt = biddingEnd;
        p.bond = BOND;
        p.floors = new uint96[](patches);
        p.buyNows = new uint96[](patches);
        p.labels = new bytes32[](patches);
        for (uint256 i; i < patches; ++i) {
            p.floors[i] = FLOOR;
            p.buyNows[i] = BUY_NOW;
            p.labels[i] = bytes32(abi.encodePacked("Patch ", bytes1(uint8(65 + i))));
        }
        p.milestoneBps = bps;
        p.deadlines = new uint40[](bps.length);
        for (uint256 i; i < bps.length; ++i) {
            p.deadlines[i] = biddingEnd + uint40((i + 1) * 7 days);
        }
        p.metadataURI = "ipfs://listing";
        p.metadataHash = keccak256("listing");
    }

    function _twoMilestones() internal pure returns (uint16[] memory bps) {
        bps = new uint16[](2);
        bps[0] = 4000;
        bps[1] = 6000;
    }

    function _create(uint256 patches) internal returns (uint256 id) {
        vm.prank(creator);
        id = market.createListing(_params(patches, _twoMilestones()));
    }

    function _createActive(uint256 patches) internal returns (uint256 id) {
        id = _create(patches);
        vm.prank(admin);
        market.approveListing(id);
    }

    function _bid(address who, uint256 id, uint8 patchId, uint96 amount) internal {
        vm.prank(who);
        market.bid(id, patchId, amount);
    }

    /// Active listing with 3 patches; alice wins patch 0 at 200, bob wins patch 1 at 300; patch 2 unsold. Closed.
    function _delivering() internal returns (uint256 id) {
        id = _createActive(3);
        _bid(alice, id, 0, 200e6);
        _bid(bob, id, 1, 300e6);
        vm.warp(biddingEnd);
        market.closeBidding(id);
    }

    function _submit(uint256 id, uint8 m) internal {
        vm.prank(creator);
        market.submitProof(id, m, keccak256(abi.encode(m)), "ipfs://proof");
    }
}
