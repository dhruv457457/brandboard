// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The NFT minted to the winner of each patch. Only the market can mint or move it.
interface IPatchReceipt {
    function mint(address to, uint256 tokenId) external;
    function marketTransfer(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @notice The Living Patch receipt: the market tells it when a listing's tokens changed (ERC-4906), so
///         marketplaces and the website refresh the art.
interface IPatchReceiptV2 is IPatchReceipt {
    function refresh(uint256 listingId) external;
}
