// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

/// @notice Testnet helper: an approved 1-patch listing whose bidding ends in BIDDING_SECONDS
///         (default 120) and whose first milestone is due shortly after. For keeper / payout tests.
/// Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS, USDC_ADDRESS, optional BIDDING_SECONDS, BOND.
contract QuickListing is Script {
    function run() external returns (uint256 listingId) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        uint40 secs = uint40(vm.envOr("BIDDING_SECONDS", uint256(120)));
        uint64 bond = uint64(vm.envOr("BOND", uint256(market.minBond())));

        PatchedMarket.ListingParams memory p;
        p.surface = PatchedMarket.Surface.Hoodie;
        p.biddingEndsAt = uint40(block.timestamp) + secs;
        p.bond = bond;
        p.floors = new uint96[](1);
        p.buyNows = new uint96[](1);
        p.labels = new bytes32[](1);
        (p.floors[0], p.buyNows[0], p.labels[0]) = (1e6, 5e6, bytes32("Chest"));
        p.milestoneBps = new uint16[](2);
        (p.milestoneBps[0], p.milestoneBps[1]) = (4000, 6000);
        p.deadlines = new uint40[](2);
        (p.deadlines[0], p.deadlines[1]) = (p.biddingEndsAt + 1 days, p.biddingEndsAt + 2 days);
        p.metadataURI = "patched://quick";
        p.metadataHash = keccak256(abi.encode("quick listing", block.timestamp));

        vm.startBroadcast(pk);
        usdc.approve(address(market), bond);
        listingId = market.createListing(p);
        market.approveListing(listingId);
        vm.stopBroadcast();
        console.log("listing", listingId);
    }
}
