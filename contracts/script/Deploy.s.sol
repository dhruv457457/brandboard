// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {PatchRenderer} from "../src/PatchRenderer.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";
import {MarketFactory} from "./MarketFactory.sol";

/// @notice Deploys PatchReceipt + PatchedMarket (behind an upgradeable proxy) and wires them together.
/// Env: DEPLOYER_PRIVATE_KEY, USDC_ADDRESS, optional ADMIN_ADDRESS / TREASURY_ADDRESS (default: deployer),
/// SITE_PATCH_URL (where the website shows a token, e.g. https://monad.patched.world/patch/).
///
/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
contract Deploy is Script {
    function run() external returns (PatchedMarket market, PatchReceipt receipt) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address usdc = vm.envAddress("USDC_ADDRESS");
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        vm.startBroadcast(pk);
        receipt = new PatchReceipt(deployer);
        PatchRenderer renderer = new PatchRenderer(deployer, vm.envOr("SITE_PATCH_URL", string("")));
        receipt.setRenderer(renderer);
        address implementation;
        (market, implementation) = MarketFactory.deploy(IERC20(usdc), IPatchReceipt(address(receipt)), admin, treasury);
        receipt.setMarket(market);
        vm.stopBroadcast();

        console.log("PatchReceipt ", address(receipt));
        console.log("PatchRenderer", address(renderer));
        console.log("PatchedMarket (proxy, the address everyone uses)", address(market));
        console.log("PatchedMarket implementation", implementation);
        console.log("block        ", block.number);
    }
}
