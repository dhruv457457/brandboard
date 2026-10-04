// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {PatchRenderer} from "../src/PatchRenderer.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";

/// @notice Moves a live market to the Living Patch: upgrades the market logic, deploys the renderer and the new receipt,
/// wires them together and tells the market to mint new listings on the new receipt. Listings that already exist keep
/// their tokens on the old receipt, so nothing is stranded. The proxy address and all escrowed money stay as they are.
/// Needs the DEFAULT_ADMIN_ROLE key. Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS, SITE_PATCH_URL.
///
/// Dry run first (sends nothing):  forge script script/UpgradeReceipt.s.sol --rpc-url monad_testnet
/// Then for real:                  forge script script/UpgradeReceipt.s.sol --rpc-url monad_testnet --broadcast
contract UpgradeReceipt is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));
        string memory siteUrl = vm.envOr("SITE_PATCH_URL", string(""));

        address oldReceipt = address(market.receipt());
        uint256 nextListing = market.nextListingId();
        uint256 escrow = market.usdc().balanceOf(address(market));
        require(market.hasRole(market.DEFAULT_ADMIN_ROLE(), deployer), "this key is not the market admin");
        require(!market.upgradesFrozen(), "upgrades are frozen");

        vm.startBroadcast(pk);
        address implementation = address(new PatchedMarket());
        market.upgradeToAndCall(implementation, "");
        PatchRenderer renderer = new PatchRenderer(deployer, siteUrl);
        PatchReceipt receipt = new PatchReceipt(deployer);
        receipt.setRenderer(renderer);
        receipt.setMarket(market);
        market.setReceipt(IPatchReceipt(address(receipt)));
        vm.stopBroadcast();

        require(market.nextListingId() == nextListing, "listing counter changed");
        require(market.usdc().balanceOf(address(market)) == escrow, "escrow changed");
        require(address(market.legacyReceipt()) == oldReceipt, "old receipt not kept");
        require(address(market.receipt()) == address(receipt), "new receipt not active");
        require(market.legacyBelowListing() == nextListing, "cut-off listing wrong");

        console.log("PatchedMarket proxy (unchanged)", address(market));
        console.log("New implementation             ", implementation);
        console.log("PatchReceipt (new)             ", address(receipt));
        console.log("PatchRenderer                  ", address(renderer));
        console.log("PatchReceipt (old, kept)       ", oldReceipt);
        console.log("First listing on the new receipt", nextListing);
    }
}
