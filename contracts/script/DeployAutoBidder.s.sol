// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchAutoBidder} from "../src/PatchAutoBidder.sol";

/// @notice Deploys PatchAutoBidder for an existing PatchedMarket. It needs no roles on the market.
/// Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS.
///
/// forge script script/DeployAutoBidder.s.sol --rpc-url <rpc> --broadcast
contract DeployAutoBidder is Script {
    function run() external returns (PatchAutoBidder autoBidder) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));

        vm.startBroadcast(pk);
        autoBidder = new PatchAutoBidder(market);
        vm.stopBroadcast();

        console.log("PatchAutoBidder", address(autoBidder));
        console.log("block          ", block.number);
    }
}
