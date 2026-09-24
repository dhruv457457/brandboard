// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PatchedMarket} from "../../src/PatchedMarket.sol";
import {PatchAutoBidder} from "../../src/PatchAutoBidder.sol";

/// Runs against the deployed testnet contracts on a fork: FORK_URL=<monad testnet rpc> forge test --match-contract AutoBidFork
contract AutoBidForkTest is Test {
    PatchedMarket market = PatchedMarket(0xd3808dE425493934f036f8E77ef5a4de332e9552);
    PatchAutoBidder auto_ = PatchAutoBidder(0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA);
    address brand = makeAddr("fork-brand");
    address rival = makeAddr("fork-rival");
    address keeper = 0xa55A55Ea92299E9340e046c99feA131b08aB4E74;

    function setUp() public {
        string memory url = vm.envOr("FORK_URL", string(""));
        if (bytes(url).length == 0) vm.skip(true);
        vm.createSelectFork(url);
    }

    function test_deployedAutoBidderAnswersAnOutbid() public {
        IERC20 usdc = market.usdc();
        assertEq(address(auto_.usdc()), address(usdc));
        assertEq(address(auto_.market()), address(market));
        deal(address(usdc), brand, 100e6);
        deal(address(usdc), rival, 100e6);
        vm.prank(brand);
        usdc.approve(address(auto_), type(uint256).max);
        vm.prank(rival);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(brand);
        auto_.setAutoBid(2, 6, 30e6);
        vm.prank(keeper);
        auto_.execute(brand, 2, 6); // opens at the floor
        assertEq(market.getPatch(2, 6).topBidder, brand);

        vm.prank(rival);
        market.bid(2, 6, 20e6);
        vm.prank(keeper);
        uint96 amount = auto_.execute(brand, 2, 6);
        assertEq(amount, 21e6); // 20 + max(5%, $1)
        assertEq(market.getPatch(2, 6).topBidder, brand);
        assertEq(usdc.balanceOf(brand), 100e6 - 21e6, "earlier bid refunded, one bid locked");
    }
}
