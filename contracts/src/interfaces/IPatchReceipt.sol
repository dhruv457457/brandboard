// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The NFT minted to the winner of each patch. Only the market can mint or move it.
interface IPatchReceipt {
    function mint(address to, uint256 tokenId) external;
    function marketTransfer(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}
