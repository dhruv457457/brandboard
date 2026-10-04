// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {PatchRenderer} from "../src/PatchRenderer.sol";

/// @notice Deploys a fresh PatchRenderer and points the receipt at it, so art or metadata fixes go live without touching
/// a token, the market or any escrow. Needs the receipt owner's key. Env: DEPLOYER_PRIVATE_KEY, RECEIPT_ADDRESS,
/// SITE_PATCH_URL (where the website shows a token).
///
/// Dry run first (sends nothing):  forge script script/SwapRenderer.s.sol --rpc-url monad_testnet --code-size-limit 131072
/// Then for real:                  forge script script/SwapRenderer.s.sol --rpc-url monad_testnet --code-size-limit 131072 --broadcast
contract SwapRenderer is Script {
    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        PatchReceipt receipt = PatchReceipt(vm.envAddress("RECEIPT_ADDRESS"));
        string memory siteUrl = vm.envOr("SITE_PATCH_URL", string(""));
        require(receipt.owner() == deployer, "this key does not own the receipt");

        vm.startBroadcast(pk);
        PatchRenderer renderer = new PatchRenderer(deployer, siteUrl);
        receipt.setRenderer(renderer);
        vm.stopBroadcast();

        require(address(receipt.renderer()) == address(renderer), "renderer not swapped");
        console.log("Receipt (unchanged)", address(receipt));
        console.log("New renderer       ", address(renderer));
    }
}
