// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchSpotter} from "../src/PatchSpotter.sol";

/// @notice Deploys PatchSpotter (on-chain "spotted" photos) for an existing PatchedMarket. It needs no roles on the market.
/// Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS.
///
/// forge script script/DeploySpotter.s.sol --rpc-url <rpc> --broadcast
contract DeploySpotter is Script {
    function run() external returns (PatchSpotter spotter) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));

        vm.startBroadcast(pk);
        spotter = new PatchSpotter(market);
        vm.stopBroadcast();

        console.log("PatchSpotter   ", address(spotter));
        console.log("block          ", block.number);
    }
}
