// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchSweeper} from "../src/PatchSweeper.sol";

/// @notice Deploys PatchSweeper (multi-patch bids) for an existing PatchedMarket. It needs no roles on the market.
/// Env: DEPLOYER_PRIVATE_KEY, MARKET_ADDRESS.
///
/// forge script script/DeploySweeper.s.sol --rpc-url <rpc> --broadcast
contract DeploySweeper is Script {
    function run() external returns (PatchSweeper sweeper) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        PatchedMarket market = PatchedMarket(vm.envAddress("MARKET_ADDRESS"));

        vm.startBroadcast(pk);
        sweeper = new PatchSweeper(market);
        vm.stopBroadcast();

        console.log("PatchSweeper   ", address(sweeper));
        console.log("block          ", block.number);
    }
}
