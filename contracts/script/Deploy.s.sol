// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";

/// @notice Deploys PatchReceipt + PatchedMarket and wires them together.
/// Env: DEPLOYER_PRIVATE_KEY, USDC_ADDRESS, optional ADMIN_ADDRESS / TREASURY_ADDRESS (default: deployer).
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
        receipt = new PatchReceipt();
        market = new PatchedMarket(IERC20(usdc), IPatchReceipt(address(receipt)), admin, treasury);
        receipt.setMarket(market);
        vm.stopBroadcast();

        console.log("PatchReceipt ", address(receipt));
        console.log("PatchedMarket", address(market));
        console.log("block        ", block.number);
    }
}
