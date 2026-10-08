// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {PatchRenderer} from "../src/PatchRenderer.sol";
import {PatchAutoBidder} from "../src/PatchAutoBidder.sol";
import {PatchSweeper} from "../src/PatchSweeper.sol";
import {PatchSpotter} from "../src/PatchSpotter.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";
import {MarketFactory} from "./MarketFactory.sol";

interface IERC20Meta {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

/// @notice The real thing: the whole Patched suite on Monad mainnet with real USDC, in one broadcast. It refuses to run
/// on any other chain or against anything that is not 6-decimal "USDC".
/// Env: DEPLOYER_PRIVATE_KEY, SITE_PATCH_URL; optional ADMIN_ADDRESS / TREASURY_ADDRESS (default: deployer).
///
/// Dry run:  forge script script/DeployMainnet.s.sol --rpc-url $MONAD_MAINNET_RPC_URL --code-size-limit 131072
/// For real: add --broadcast
contract DeployMainnet is Script {
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    function run() external {
        require(block.chainid == 143, "this is the Monad mainnet script");
        require(keccak256(bytes(IERC20Meta(USDC).symbol())) == keccak256("USDC"), "not USDC");
        require(IERC20Meta(USDC).decimals() == 6, "USDC should have 6 decimals");

        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        vm.startBroadcast(pk);
        PatchReceipt receipt = new PatchReceipt(deployer);
        PatchRenderer renderer = new PatchRenderer(deployer, vm.envOr("SITE_PATCH_URL", string("")));
        receipt.setRenderer(renderer);
        (PatchedMarket market, address implementation) =
            MarketFactory.deploy(IERC20(USDC), IPatchReceipt(address(receipt)), deployer, treasury);
        receipt.setMarket(market);
        // fee 1%, royalty 5%, step +5% or at least $1, creator stake $5, new creators capped at $200 of buy-now,
        // 5 min anti-snipe, up to 1 day of extension, 72 h to dispute a proof.
        market.setParams(100, 500, 500, 1e6, 5e6, 200e6, 5 minutes, 1 days, 72 hours);
        PatchAutoBidder autoBidder = new PatchAutoBidder(market);
        PatchSweeper sweeper = new PatchSweeper(market);
        PatchSpotter spotter = new PatchSpotter(market);
        if (admin != deployer) {
            market.grantRole(market.ADMIN_ROLE(), admin);
            market.grantRole(market.DEFAULT_ADMIN_ROLE(), admin);
        }
        vm.stopBroadcast();

        require(market.feeBps() == 100 && market.minBond() == 5e6, "params not set");
        require(address(market.usdc()) == USDC, "wrong token");
        console.log("PatchReceipt   ", address(receipt));
        console.log("PatchRenderer  ", address(renderer));
        console.log("PatchedMarket (proxy, the address everyone uses)", address(market));
        console.log("PatchedMarket implementation", implementation);
        console.log("PatchAutoBidder", address(autoBidder));
        console.log("PatchSweeper   ", address(sweeper));
        console.log("PatchSpotter   ", address(spotter));
        console.log("block          ", block.number);
    }
}
