// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title TestUSD
/// @notice A worthless 6-decimal dollar token for testing Patched on mainnet before switching to real USDC.
///         Anyone can take FAUCET_AMOUNT from the faucet once per FAUCET_COOLDOWN. Supports EIP-2612 permit
///         and exposes version() like USDC, so the app's permit flow works unchanged.
contract TestUSD is ERC20, ERC20Permit {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address => uint256) public lastFaucet;

    error FaucetCooldown(uint256 availableAt);

    constructor() ERC20("Patched Test USD", "tUSD") ERC20Permit("Patched Test USD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice EIP-712 domain version, matching what the app reads from USDC.
    function version() external pure returns (string memory) {
        return "1";
    }

    /// @notice Mint FAUCET_AMOUNT to the caller, at most once per FAUCET_COOLDOWN.
    function faucet() external {
        uint256 next = lastFaucet[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucet[msg.sender] != 0 && block.timestamp < next) revert FaucetCooldown(next);
        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
