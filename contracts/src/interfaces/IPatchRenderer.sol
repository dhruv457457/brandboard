// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The drawing side of a receipt: a token in, its metadata out. Swappable, so the art can be fixed or redrawn
///         without touching a single token.
interface IPatchRenderer {
    function tokenURI(address market, uint256 tokenId) external view returns (string memory);
}
