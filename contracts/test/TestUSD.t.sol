// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestUSD} from "../src/TestUSD.sol";
import {PatchedMarket} from "../src/PatchedMarket.sol";
import {PatchReceipt} from "../src/PatchReceipt.sol";
import {IPatchReceipt} from "../src/interfaces/IPatchReceipt.sol";

contract TestUSDTest is Test {
    TestUSD token;
    address alice = makeAddr("alice");

    function setUp() public {
        vm.warp(1_800_000_000);
        token = new TestUSD();
    }

    function test_metadata() public view {
        assertEq(token.decimals(), 6);
        assertEq(token.symbol(), "tUSD");
        assertEq(token.version(), "1");
        (, string memory name, string memory version,,,,) = token.eip712Domain();
        assertEq(name, "Patched Test USD");
        assertEq(version, token.version());
    }

    function test_faucetOncePerDay() public {
        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 1_000e6);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TestUSD.FaucetCooldown.selector, vm.getBlockTimestamp() + 1 days));
        token.faucet();

        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(alice);
        token.faucet();
        assertEq(token.balanceOf(alice), 2_000e6);
    }

    /// The market's bidWithPermit path works with this token's permit.
    function test_permitWorksWithMarket() public {
        PatchReceipt receipt = new PatchReceipt();
        PatchedMarket market = new PatchedMarket(IERC20(address(token)), IPatchReceipt(address(receipt)), address(this), address(this));
        receipt.setMarket(market);

        (address owner, uint256 pk) = makeAddrAndKey("brand");
        vm.prank(owner);
        token.faucet();

        uint256 deadline = vm.getBlockTimestamp() + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner, address(market), 50e6, token.nonces(owner), deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)));
        token.permit(owner, address(market), 50e6, deadline, v, r, s);
        assertEq(token.allowance(owner, address(market)), 50e6);
    }
}
