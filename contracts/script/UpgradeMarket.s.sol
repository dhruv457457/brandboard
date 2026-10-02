// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";

/// @notice Upgrades a live PatchedMarket proxy to the current code. The proxy address, every listing and all escrowed
/// money stay as they are; only the logic changes. Needs the DEFAULT_ADMIN_ROLE key.
/// Env: DEPLOYER_PRIVATE_KEY (the admin), MARKET_ADDRESS (the proxy).
///
/// Dry run against the live chain, sending nothing (read the output first):
///   forge script script/UpgradeMarket.s.sol --rpc-url monad_testnet
/// Then the real thing:
///   forge script script/UpgradeMarket.s.sol --rpc-url monad_testnet --broadcast
contract UpgradeMarket is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));

        // Read before, to compare after.
        uint256 nextListing = market.nextListingId();
        uint256 escrow = market.usdc().balanceOf(address(market));
        uint16 fee = market.feeBps();
        require(market.hasRole(market.DEFAULT_ADMIN_ROLE(), vm.addr(pk)), "this key is not the market admin");
        require(!market.upgradesFrozen(), "upgrades are frozen");

        vm.startBroadcast(pk);
        address implementation = address(new PatchedMarket());
        market.upgradeToAndCall(implementation, "");
        vm.stopBroadcast();

        // Nothing may have moved.
        require(market.nextListingId() == nextListing, "listing counter changed");
        require(market.usdc().balanceOf(address(market)) == escrow, "escrow changed");
        require(market.feeBps() == fee, "fee changed");
        require(market.MIN_PROOF_WINDOW() == 1 hours, "new code is not active");

        console.log("PatchedMarket proxy (unchanged)", address(market));
        console.log("New implementation             ", implementation);
        console.log("Listings                        ", nextListing - 1);
        console.log("USDC in escrow                  ", escrow);
    }
}
