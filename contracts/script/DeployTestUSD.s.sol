// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {TestUSD} from "../src/TestUSD.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";

/// @notice Mainnet test run: deploys TestUSD, PatchReceipt and a PatchedMarket that uses TestUSD instead of
///         USDC, with testing-friendly limits. Swap to real USDC later with Deploy.s.sol.
/// Env: DEPLOYER_PRIVATE_KEY, optional EXTRA_ADMIN (gets ADMIN_ROLE, e.g. the team's wallet).
///
/// forge script script/DeployTestUSD.s.sol --rpc-url https://rpc.monad.xyz --broadcast
contract DeployTestUSD is Script {
    function run() external returns (TestUSD token, PatchedMarket market, PatchReceipt receipt) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address extraAdmin = vm.envOr("EXTRA_ADMIN", address(0));

        vm.startBroadcast(pk);
        token = new TestUSD();
        receipt = new PatchReceipt();
        market = new PatchedMarket(IERC20(address(token)), IPatchReceipt(address(receipt)), deployer, deployer);
        receipt.setMarket(market);
        // fee 5%, royalty 5%, step +5% or +$1, bond $1, new-creator cap $1000, 5 min anti-snipe,
        // 1 day max extension, 72 h dispute window.
        market.setParams(500, 500, 500, 1e6, 1e6, 1_000e6, 5 minutes, 1 days, 72 hours);
        if (extraAdmin != address(0)) market.grantRole(market.ADMIN_ROLE(), extraAdmin);
        vm.stopBroadcast();

        console.log("TestUSD      ", address(token));
        console.log("PatchReceipt ", address(receipt));
        console.log("PatchedMarket", address(market));
        console.log("block        ", block.number);
    }
}
