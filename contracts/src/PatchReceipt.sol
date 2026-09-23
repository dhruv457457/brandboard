// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {PatchedMarket} from "./PatchedMarket.sol";

/// @title PatchReceipt
/// @notice One token per won patch. The token *is* the patch spot: its holder receives refunds and can
///         dispute. Only the market can mint or move tokens, so resale royalties are always enforced.
///         The artwork is drawn on-chain as SVG.
contract PatchReceipt is ERC721, IERC2981 {
    using Strings for uint256;

    error OnlyMarket();
    error MarketAlreadySet();
    error TransfersDisabled();

    address public immutable deployer;
    PatchedMarket public market;

    constructor() ERC721("Patched Receipt", "PATCH") {
        deployer = msg.sender;
    }

    /// @notice One-time wiring after the market is deployed.
    function setMarket(PatchedMarket market_) external {
        if (msg.sender != deployer || address(market) != address(0)) revert MarketAlreadySet();
        market = market_;
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
        return interfaceId == type(IERC2981).interfaceId || super.supportsInterface(interfaceId);
    }

    // ─────────────────────────────── Metadata ───────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        (
            bytes32 brand,
            bytes32 label,
            bytes32 eventName,
            PatchedMarket.Surface surface,
            uint96 amount,
        ) = market.receiptData(tokenId);
        (uint256 listingId, uint8 patchId) = market.listingOf(tokenId);

        string memory brandStr = brand == bytes32(0) ? "Your brand here" : _clean(brand);
        string memory labelStr = _clean(label);
        string memory eventStr = eventName == bytes32(0) ? _surfaceName(surface) : _clean(eventName);
        string memory price = _usdc(amount);

        string memory svg = _svg(brandStr, labelStr, eventStr, price, patchId, listingId);
        bytes memory json = abi.encodePacked(
            '{"name":"Patch #',
            listingId.toString(),
            "-",
            uint256(patchId).toString(),
            " - ",
            labelStr,
            '","description":"Proof that ',
            brandStr,
            " won this patch on Patched. The holder owns the spot and its escrow rights.",
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Surface","value":"',
            _surfaceName(surface),
            '"},{"trait_type":"Patch","value":"',
            labelStr,
            '"},{"trait_type":"Event","value":"',
            eventStr,
            '"},{"trait_type":"Winning bid (USDC)","value":"',
            price,
            '"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(json));
    }

    function _svg(
        string memory brand,
        string memory label,
        string memory eventStr,
        string memory price,
        uint8 patchId,
        uint256 listingId
    ) internal pure returns (string memory) {
        string[5] memory pastels = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
        string memory fill = pastels[patchId % 5];
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#FAFAF7"/>',
            '<text x="28" y="50" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="26" fill="#0B0B0C">patched</text>',
            '<rect x="330" y="26" width="42" height="30" rx="8" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="3" transform="rotate(-8 351 41)"/>',
            '<g transform="rotate(-4 200 200)"><rect x="70" y="100" width="268" height="200" rx="28" fill="#0B0B0C"/>',
            '<rect x="62" y="92" width="268" height="200" rx="28" fill="',
            fill,
            '" stroke="#0B0B0C" stroke-width="5"/>',
            '<rect x="78" y="108" width="236" height="168" rx="18" fill="none" stroke="#0B0B0C" stroke-opacity=".5" stroke-width="3" stroke-dasharray="10 8"/>',
            '<text x="196" y="198" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" fill="#0B0B0C">',
            brand,
            '</text><text x="196" y="236" text-anchor="middle" font-family="monospace" font-size="20" fill="#0B0B0C">$',
            price,
            " USDC</text></g>",
            '<text x="28" y="360" font-family="monospace" font-size="15" fill="#0B0B0C">',
            label,
            " / ",
            eventStr,
            '</text><text x="372" y="360" text-anchor="end" font-family="monospace" font-size="15" fill="#5F5B53">#',
            listingId.toString(),
            "-",
            uint256(patchId).toString(),
            "</text></svg>"
        );
    }

    /// @dev bytes32 → string, keeping only characters that are safe inside both SVG and JSON.
    function _clean(bytes32 value) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && value[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) {
            bytes1 c = value[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c == " "
                || c == "." || c == "-" || c == "_";
            out[i] = ok ? c : bytes1("?");
        }
        return string(out);
    }

    /// @dev 6-decimal USDC amount → "1234.50".
    function _usdc(uint96 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 cents = (amount % 1e6) / 1e4;
        return string.concat(whole.toString(), ".", cents < 10 ? "0" : "", cents.toString());
    }

    function _surfaceName(PatchedMarket.Surface s) internal pure returns (string memory) {
        if (s == PatchedMarket.Surface.Outfit) return "Outfit";
        if (s == PatchedMarket.Surface.Car) return "Car";
        return "Team hoodie";
    }
}
