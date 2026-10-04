// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {PatchedMarket} from "./PatchedMarket.sol";
import {IPatchRenderer} from "./interfaces/IPatchRenderer.sol";

/// @title PatchReceipt
/// @notice The Living Patch. One token per won patch; the token *is* the patch spot: its holder receives refunds and
///         can dispute. Only the market can mint or move tokens, so resale royalties are always enforced.
///         The art is drawn on-chain from the listing's state and redraws itself as the creator proves each step:
///         won, printed, seen, delivered (or refunded, or disputed). ERC-4906 tells marketplaces when it changed.
contract PatchReceipt is ERC721, Ownable, IERC2981 {
    error OnlyMarket();
    error MarketAlreadySet();
    error TransfersDisabled();

    /// @dev ERC-4906: marketplaces re-read these tokens' metadata.
    event MetadataUpdate(uint256 tokenId);
    event BatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId);
    event RendererSet(address renderer);
    event ContractURISet();

    PatchedMarket public market;
    IPatchRenderer public renderer;
    /// @dev Collection metadata (ERC-7572). Empty = the default built from the pieces below.
    string private _contractURI;

    constructor(address owner_) ERC721("Patched Living Patch", "PATCH") Ownable(owner_) {}

    /// @notice One-time wiring after the market is deployed.
    function setMarket(PatchedMarket market_) external onlyOwner {
        if (address(market) != address(0)) revert MarketAlreadySet();
        market = market_;
    }

    function setRenderer(IPatchRenderer renderer_) external onlyOwner {
        renderer = renderer_;
        emit RendererSet(address(renderer_));
        if (address(market) != address(0)) emit BatchMetadataUpdate(0, type(uint256).max);
    }

    /// @notice Override the collection metadata with a link (for example an ipfs:// JSON). Empty restores the default.
    function setContractURI(string calldata uri) external onlyOwner {
        _contractURI = uri;
        emit ContractURISet();
    }

    modifier onlyMarket() {
        if (msg.sender != address(market)) revert OnlyMarket();
        _;
    }

    function mint(address to, uint256 tokenId) external onlyMarket {
        _mint(to, tokenId);
    }

    function marketTransfer(address from, address to, uint256 tokenId) external onlyMarket {
        _transfer(from, to, tokenId);
    }

    /// @notice The market calls this whenever a listing's proofs, disputes or outcome change, so every token of the
    ///         listing is redrawn.
    function refresh(uint256 listingId) external onlyMarket {
        emit BatchMetadataUpdate(listingId << 8, (listingId << 8) | 0xFF);
    }

    /// @dev Block every transfer that does not come from the market (mints have from == 0).
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0) && msg.sender != address(market)) revert TransfersDisabled();
        return super._update(to, tokenId, auth);
    }

    // ─────────────────────────────── Royalties ───────────────────────────────

    function royaltyInfo(uint256 tokenId, uint256 salePrice) external view returns (address, uint256) {
        (,,,,, address creator) = market.receiptData(tokenId);
        return (creator, salePrice * market.royaltyBps() / 10_000);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, IERC165) returns (bool) {
        return interfaceId == type(IERC2981).interfaceId || interfaceId == 0x49064906
            || super.supportsInterface(interfaceId);
    }

    // ─────────────────────────────── Metadata ───────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return renderer.tokenURI(address(market), tokenId);
    }

    /// @notice Collection name, description and logo for explorers and marketplaces.
    function contractURI() external view returns (string memory) {
        if (bytes(_contractURI).length != 0) return _contractURI;
        string memory logo =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#FAFAF7"/><g transform="rotate(-8 50 50)"><rect x="24" y="24" width="56" height="56" rx="16" fill="#0B0B0C"/><rect x="19" y="19" width="56" height="56" rx="16" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="4"/><rect x="27" y="27" width="40" height="40" rx="10" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="6 5"/><path d="M38 62V32h11a8 8 0 0 1 0 16H38" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                abi.encodePacked(
                    '{"name":"Patched Living Patch","description":"One NFT per logo spot won on Patched. The art is drawn on-chain and changes as the creator proves each step: won, printed, seen, delivered. If the creator does not show up, the patch is unpicked and the holder is refunded.","image":"data:image/svg+xml;base64,',
                    Base64.encode(bytes(logo)),
                    '","external_link":"https://patched.world"}'
                )
            )
        );
    }
}
