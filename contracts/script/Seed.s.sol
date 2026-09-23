// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

/// @notice Testnet demo data: small-dollar params, one event, one approved outfit listing.
/// Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS, USDC_ADDRESS.
contract Seed is Script {
    function run() external returns (uint256 listingId) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));

        vm.startBroadcast(pk);
        // testnet: $5 bond, $1 minimum step, everything else default
        market.setParams(500, 500, 500, 1e6, 5e6, 1_000e6, 5 minutes, 1 days, 72 hours);
        uint32 eventId = market.createEvent("Token2049 Demo", uint40(block.timestamp + 10 days), uint40(block.timestamp + 12 days));

        PatchedMarket.ListingParams memory p;
        p.surface = PatchedMarket.Surface.Outfit;
        p.eventId = eventId;
        p.biddingEndsAt = uint40(block.timestamp + 3 days);
        p.bond = 5e6;
        p.floors = new uint96[](3);
        p.buyNows = new uint96[](3);
        p.labels = new bytes32[](3);
        (p.floors[0], p.floors[1], p.floors[2]) = (1e6, 1e6, 2e6);
        (p.buyNows[0], p.buyNows[1], p.buyNows[2]) = (5e6, 5e6, 10e6);
        (p.labels[0], p.labels[1], p.labels[2]) = (bytes32("Neckline"), bytes32("Waist belt"), bytes32("Skirt center"));
        p.milestoneBps = new uint16[](2);
        (p.milestoneBps[0], p.milestoneBps[1]) = (4000, 6000);
        p.deadlines = new uint40[](2);
        (p.deadlines[0], p.deadlines[1]) = (uint40(block.timestamp + 10 days), uint40(block.timestamp + 15 days));
        p.metadataURI = "patched://demo/mira-token2049";
        p.metadataHash = keccak256("patched demo listing v1");

        usdc.approve(address(market), type(uint256).max);
        listingId = market.createListing(p);
        market.approveListing(listingId);
        vm.stopBroadcast();

        console.log("event   ", eventId);
        console.log("listing ", listingId);
    }
}
