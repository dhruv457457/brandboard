// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {PatchedMarket} from "./PatchedMarket.sol";
import {IPatchRenderer} from "./interfaces/IPatchRenderer.sol";

/// @notice What the art needs to draw one card. Built from `PatchedMarket.tokenView`.
struct PatchCard {
    string brand;
    string label;
    string eventStr;
    string creator;
    uint256 listingId;
    uint8 patchId;
    uint8 surface;
    uint8 stage;
    uint8 seen;
    uint8 seenOf;
    uint32 sponsorNo;
    uint96 amount;
    uint40 printedAt;
    uint40 seenAt;
}

/// @title PatchArt
/// @notice The patch NFT as a collectible trading card (design: docs/nft-plan.md section 8). A thread-coloured frame
///         shows the price tier, the art window shows the garment with the embroidered patch sewn on, passport stamps
///         pile up as the creator proves each step, and a four-step track runs along the bottom. It is the on-chain twin
///         of apps/web/src/lib/patchCard.ts, so keep the two in step.
///         Plain SVG only: patterns, gradients and one colour filter. System fonts, no images, no scripts.
library PatchArt {
    using Strings for uint256;

    uint8 internal constant WON = 0;
    uint8 internal constant PRINTED = 1;
    uint8 internal constant SEEN = 2;
    uint8 internal constant DELIVERED = 3;
    uint8 internal constant REFUNDED = 4;
    uint8 internal constant DISPUTED = 5;

    string internal constant DISPLAY = "Arial Black, Arial, Helvetica, sans-serif";
    string internal constant BODY = "Arial, Helvetica, sans-serif";
    string internal constant MONO = "Courier New, monospace";
    string internal constant INK = "#0B0B0C";
    string internal constant ORANGE = "#FF5A1F";

    function render(PatchCard memory c) internal pure returns (string memory) {
        uint256 tier = c.amount >= 1_000e6 ? 2 : c.amount >= 100e6 ? 1 : 0; // cotton, silk, gold
        uint256 done = _done(c.stage);
        return string.concat(
            '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img">',
            _defs(tier, c.stage == REFUNDED),
            '<rect width="1000" height="1000" fill="#FAFAF7"/><rect width="1000" height="1000" fill="url(#dots)"/>',
            c.stage == REFUNDED ? '<g filter="url(#grey)" opacity=".8">' : "<g>",
            _frame(c, tier),
            _window(c),
            _stamps(c, done),
            _overlay(c),
            _typeLine(c),
            _flavour(c),
            _track(c, done),
            _footer(c, tier),
            "</g></svg>"
        );
    }

    /// @dev How many of the four steps (won, printed, seen, delivered) are lit.
    function _done(uint8 stage) internal pure returns (uint256) {
        if (stage == WON || stage == REFUNDED) return 1;
        if (stage == PRINTED || stage == DISPUTED) return 2;
        if (stage == SEEN) return 3;
        return 4;
    }

    // ───────────────────────────── Shapes ─────────────────────────────

    /// @dev The five patch outlines, centred on (0, 0), and the width the brand name may use. Chosen by patch number.
    function _shape(uint8 patchId) private pure returns (string memory d, uint256 maxW) {
        uint8 i = patchId % 5;
        if (i == 0) {
            return (
                "M-216.5 -175 H216.5 A73.5 73.5 0 0 1 290 -101.5 V101.5 A73.5 73.5 0 0 1 216.5 175 H-216.5 A73.5 73.5 0 0 1 -290 101.5 V-101.5 A73.5 73.5 0 0 1 -216.5 -175 Z",
                420
            );
        }
        if (i == 1) return ("M-175 0 a175 175 0 1 0 350 0 a175 175 0 1 0 -350 0 Z", 262);
        if (i == 2) {
            return ("M-226.2 -175 Q0 -206.5 226.2 -175 V8.8 Q226.2 122.5 0 183.8 Q-226.2 122.5 -226.2 8.8 Z", 330);
        }
        if (i == 3) return ("M-290 0 L-145 -175 L145 -175 L290 0 L145 175 L-145 175 Z", 330);
        return (
            string.concat(
                "M160 0 A34.4 34.4 0 0 1 147.8 61.2 A34.4 34.4 0 0 1 113.1 113.1 A34.4 34.4 0 0 1 61.2 147.8 ",
                "A34.4 34.4 0 0 1 0 160 A34.4 34.4 0 0 1 -61.2 147.8 A34.4 34.4 0 0 1 -113.1 113.1 ",
                "A34.4 34.4 0 0 1 -147.8 61.2 A34.4 34.4 0 0 1 -160 0 A34.4 34.4 0 0 1 -147.8 -61.2 ",
                "A34.4 34.4 0 0 1 -113.1 -113.1 A34.4 34.4 0 0 1 -61.2 -147.8 A34.4 34.4 0 0 1 0 -160 ",
                "A34.4 34.4 0 0 1 61.2 -147.8 A34.4 34.4 0 0 1 113.1 -113.1 A34.4 34.4 0 0 1 147.8 -61.2 ",
                "A34.4 34.4 0 0 1 160 0 Z"
            ),
            230
        );
    }

    /// @dev A font size that fits `text` in `maxW` (Arial Black runs about 0.66 em per character), capped at `max`.
    function _fit(string memory text, uint256 maxW, uint256 max) private pure returns (uint256 size) {
        uint256 n = bytes(text).length;
        if (n < 3) n = 3;
        size = (maxW * 100) / (n * 66);
        if (size > max) size = max;
    }

    // ───────────────────────────── Parts ─────────────────────────────

    function _defs(uint256 tier, bool grey) private pure returns (string memory) {
        string memory frame = tier == 2
            ? '<linearGradient id="tier" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A6100"/><stop offset=".3" stop-color="#F7D774"/><stop offset=".55" stop-color="#B8860B"/><stop offset=".8" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/></linearGradient><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            : tier == 1
                ? '<linearGradient id="tier" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#836EF9"/><stop offset=".5" stop-color="#FF8AD8"/><stop offset="1" stop-color="#7FD3FF"/></linearGradient>'
                : '<linearGradient id="tier" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A2A2A"/><stop offset="1" stop-color="#0B0B0C"/></linearGradient>';
        return string.concat(
            "<defs>",
            frame,
            '<pattern id="satin" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="3.5" height="9" fill="#fff" opacity=".28"/></pattern>',
            '<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.2" fill="#E2DDD0"/></pattern>',
            '<pattern id="half" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="9" cy="9" r="3" fill="#fff" opacity=".45"/></pattern>',
            grey ? '<filter id="grey"><feColorMatrix type="saturate" values="0.1"/></filter>' : "",
            "</defs>"
        );
    }

    /// @dev The card: hard shadow, thread-coloured frame, cream panel, brand name and the price coin.
    function _frame(PatchCard memory c, uint256 tier) private pure returns (string memory) {
        string memory price = string.concat("$", _usd(c.amount));
        uint256 n = bytes(price).length;
        return string.concat(
            '<rect x="70" y="40" width="860" height="930" rx="44" fill="#0B0B0C" transform="translate(14 14)"/><rect x="70" y="40" width="860" height="930" rx="44" fill="url(#tier)" stroke="#0B0B0C" stroke-width="8"/>',
            tier == 2 ? '<rect x="70" y="40" width="860" height="930" rx="44" fill="url(#sheen)"/>' : "",
            '<rect x="100" y="70" width="800" height="870" rx="28" fill="#F4EFE3" stroke="#0B0B0C" stroke-width="5"/><text x="130" y="140" font-family="',
            DISPLAY,
            '" font-size="',
            _fit(c.brand, 480, 60).toString(),
            '" fill="#0B0B0C">',
            c.brand,
            '</text><circle cx="815" cy="118" r="56" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="5"/><text x="815" y="114" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="',
            n <= 4 ? "32" : n <= 6 ? "26" : "20",
            '" fill="#fff">',
            price,
            '</text><text x="815" y="140" text-anchor="middle" font-family="',
            MONO,
            '" font-weight="700" font-size="15" fill="#fff">USDC</text>'
        );
    }

    /// @dev The art window: a pastel halftone, the garment for the surface, and the patch sewn on (or unpicked).
    function _window(PatchCard memory c) private pure returns (string memory) {
        string memory fill = c.surface == 0 ? "#D9CCFF" : c.surface == 1 ? "#BFE3FF" : "#FFE58F";
        return string.concat(
            '<rect x="130" y="180" width="740" height="430" rx="18" fill="',
            fill,
            '" stroke="#0B0B0C" stroke-width="5"/><rect x="130" y="180" width="740" height="430" rx="18" fill="url(#half)"/>',
            _garment(c.surface),
            c.stage == REFUNDED ? _unpicked(c) : _patch(c)
        );
    }

    function _garment(uint8 surface) private pure returns (string memory) {
        if (surface == 1) {
            return '<g transform="translate(500 300) scale(.95)"><path d="M-330 200 Q-330 130 -260 115 L-170 30 Q-145 5 -100 5 L110 5 Q150 5 175 30 L255 115 Q330 130 330 200 L330 260 L-330 260 Z" fill="#fff" stroke="#0B0B0C" stroke-width="9" stroke-linejoin="round"/><path d="M-150 110 L-95 40 L-10 40 L-10 110 Z M20 110 L20 40 L100 40 L160 110 Z" fill="#E8F2FF" stroke="#0B0B0C" stroke-width="6" stroke-linejoin="round"/><circle cx="-190" cy="262" r="58" fill="#0B0B0C"/><circle cx="-190" cy="262" r="24" fill="#fff"/><circle cx="190" cy="262" r="58" fill="#0B0B0C"/><circle cx="190" cy="262" r="24" fill="#fff"/></g>';
        }
        if (surface == 2) {
            return '<g transform="translate(500 205) scale(.66)"><path d="M-120 40 Q-60 -10 0 -10 Q60 -10 120 40 L240 120 L300 330 L220 360 L180 230 L180 600 L-180 600 L-180 230 L-220 360 L-300 330 L-240 120 Z" fill="#fff" stroke="#0B0B0C" stroke-width="9" stroke-linejoin="round"/><path d="M-95 30 Q0 140 95 30" fill="none" stroke="#0B0B0C" stroke-width="8" stroke-linecap="round"/><path d="M-30 95 L-38 190 M30 95 L38 190" stroke="#0B0B0C" stroke-width="7" stroke-linecap="round"/><path d="M-110 470 Q0 500 110 470 L110 560 L-110 560 Z" fill="none" stroke="#0B0B0C" stroke-width="7" stroke-linejoin="round"/></g>';
        }
        return '<g transform="translate(500 215) scale(.62)"><path d="M-110 0 Q0 60 110 0 L250 90 L300 290 L215 320 L180 210 L180 600 L-180 600 L-180 210 L-215 320 L-300 290 L-250 90 Z" fill="#fff" stroke="#0B0B0C" stroke-width="9" stroke-linejoin="round"/><path d="M-110 0 Q0 60 110 0" fill="none" stroke="#0B0B0C" stroke-width="8"/></g>';
    }

    /// @dev Where the patch sits on the garment: chest for clothes, the door for a car.
    function _at(uint8 surface) private pure returns (string memory) {
        return surface == 1 ? "translate(500 430) scale(.36) rotate(-3)" : "translate(500 380) scale(.36) rotate(-3)";
    }

    /// @dev Embroidered: hard shadow, pastel satin, a merrowed edge in the tier's thread, a stitch ring, the name.
    function _patch(PatchCard memory c) private pure returns (string memory) {
        string[5] memory pastels = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
        (string memory d, uint256 maxW) = _shape(c.patchId);
        uint256 size = _fit(c.brand, maxW, 108);
        return string.concat(
            '<g transform="',
            _at(c.surface),
            '"><path d="',
            d,
            '" transform="translate(14 16)" fill="#0B0B0C"/><path d="',
            d,
            '" fill="',
            pastels[c.patchId % 5],
            '"/><path d="',
            d,
            '" fill="url(#satin)"/>',
            _edge(d),
            '<text x="0" y="',
            ((size * 35) / 100).toString(),
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="',
            size.toString(),
            '" fill="#0B0B0C">',
            c.brand,
            "</text></g>"
        );
    }

    function _edge(string memory d) private pure returns (string memory) {
        return string.concat(
            '<path d="',
            d,
            '" fill="none" stroke="url(#tier)" stroke-width="22"/><path d="',
            d,
            '" fill="none" stroke="#0B0B0C" stroke-opacity=".35" stroke-width="22" stroke-dasharray="2.5 4.5"/><path d="',
            d,
            '" transform="scale(.84)" fill="none" stroke="#0B0B0C" stroke-opacity=".55" stroke-width="4" stroke-dasharray="12 8"/>'
        );
    }

    /// @dev A refunded patch is unpicked: only its stitch holes are left on the garment.
    function _unpicked(PatchCard memory c) private pure returns (string memory) {
        (string memory d,) = _shape(c.patchId);
        return string.concat(
            '<path d="',
            d,
            '" transform="',
            _at(c.surface),
            '" fill="none" stroke="#0B0B0C" stroke-opacity=".6" stroke-width="10" stroke-dasharray="4 16" stroke-linecap="round"/>'
        );
    }

    /// @dev Passport stamps in the window, one per proven step.
    function _stamps(PatchCard memory c, uint256 done) private pure returns (string memory out) {
        if (done >= 2) {
            out = _roundStamp("printed", "235", "290", "62", "-14", ORANGE, "PRINTED", "22", _day(c.printedAt));
        }
        if (done >= 3) {
            out = string.concat(
                out, _roundStamp("seen", "770", "300", "58", "12", "#836EF9", "SEEN", "28", _day(c.seenAt))
            );
        }
        if (done >= 4) {
            out = string.concat(out, _rectStamp("delivered", 530, 500, 310, 38, "-8", ORANGE, "DELIVERED"));
        }
    }

    function _roundStamp(
        string memory k,
        string memory cx,
        string memory cy,
        string memory r,
        string memory rot,
        string memory color,
        string memory word,
        string memory wordSize,
        string memory sub
    ) private pure returns (string memory) {
        uint256 y = _toUint(cy);
        string memory open = string.concat(
            '<g id="stamp-',
            k,
            '" transform="rotate(',
            rot,
            " ",
            cx,
            " ",
            cy,
            ')" opacity=".88"><circle cx="',
            cx,
            '" cy="',
            cy,
            '" r="',
            r,
            '" fill="none" stroke="',
            color,
            '" stroke-width="6"/><circle cx="',
            cx,
            '" cy="',
            cy,
            '" r="',
            (_toUint(r) - 12).toString()
        );
        string memory middle = string.concat(
            '" fill="none" stroke="',
            color,
            '" stroke-width="2" stroke-dasharray="5 5"/><text x="',
            cx,
            '" y="',
            (y + 6).toString(),
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="',
            wordSize,
            '" fill="',
            color,
            '">',
            word
        );
        return string.concat(
            open,
            middle,
            '</text><text x="',
            cx,
            '" y="',
            (y + 32).toString(),
            '" text-anchor="middle" font-family="',
            MONO,
            '" font-weight="700" font-size="16" fill="',
            color,
            '">',
            sub,
            "</text></g>"
        );
    }

    /// @dev A rectangular rubber stamp with a double border.
    function _rectStamp(
        string memory k,
        uint256 x,
        uint256 y,
        uint256 w,
        uint256 size,
        string memory rot,
        string memory color,
        string memory word
    ) private pure returns (string memory) {
        uint256 h = (size * 18) / 10;
        string memory outer = string.concat(
            '<g id="stamp-',
            k,
            '" transform="rotate(',
            rot,
            " ",
            (x + w / 2).toString(),
            " ",
            (y + 40).toString(),
            ')" opacity=".9"><rect x="',
            x.toString(),
            '" y="',
            y.toString(),
            '" width="',
            w.toString(),
            '" height="',
            h.toString(),
            '" rx="10" fill="none" stroke="',
            color,
            '" stroke-width="7"/>'
        );
        string memory inner = string.concat(
            '<rect x="',
            (x + 10).toString(),
            '" y="',
            (y + 10).toString(),
            '" width="',
            (w - 20).toString(),
            '" height="',
            (h - 20).toString(),
            '" rx="5" fill="none" stroke="',
            color,
            '" stroke-width="2.5"/>'
        );
        return string.concat(
            outer,
            inner,
            '<text x="',
            (x + w / 2).toString(),
            '" y="',
            (y + (size * 125) / 100).toString(),
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="',
            size.toString(),
            '" letter-spacing="3" fill="',
            color,
            '">',
            word,
            "</text></g>"
        );
    }

    /// @dev Over the window: an ink REFUNDED stamp, or hazard tape while a proof is disputed.
    function _overlay(PatchCard memory c) private pure returns (string memory) {
        if (c.stage == REFUNDED) {
            return _rectStamp("refunded", 240, 330, 520, 46, "-9", INK, string.concat("REFUNDED $", _usd(c.amount)));
        }
        if (c.stage != DISPUTED) return "";
        bytes memory stripes;
        for (uint256 k; k < 20; ++k) {
            stripes = abi.encodePacked(stripes, '<path d="M', (90 + k * 42).toString(), ' 360 l22 0 -26 70 -22 0z"/>');
        }
        return string.concat(
            '<g transform="rotate(-9 500 400)"><rect x="90" y="360" width="820" height="70" fill="#FFD400" stroke="#0B0B0C" stroke-width="4"/><g fill="#0B0B0C">',
            string(stripes),
            '</g><rect x="300" y="368" width="400" height="54" fill="#FFD400"/><text x="500" y="406" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="30" fill="#0B0B0C">PROOF DISPUTED</text></g>'
        );
    }

    /// @dev "OUTFIT · CHEST POCKET · ETHGLOBAL MUMBAI". With no event the card's event is the surface name, so it is
    ///      left out instead of repeating. Long lines get a smaller font.
    function _typeLine(PatchCard memory c) private pure returns (string memory) {
        string memory surface = c.surface == 0 ? "Outfit" : c.surface == 1 ? "Car" : "Team hoodie";
        bool hasEvent = keccak256(bytes(c.eventStr)) != keccak256(bytes(surface));
        string memory line = string.concat(
            _upper(surface),
            " &#183; ",
            _upper(c.label),
            hasEvent ? string.concat(" &#183; ", _upper(c.eventStr)) : ""
        );
        // Each "&#183;" is six bytes that draw one character.
        uint256 n = bytes(line).length - (hasEvent ? 10 : 5);
        uint256 size = n <= 52 ? 22 : (22 * 52) / n;
        return string.concat(
            '<rect x="130" y="630" width="740" height="56" rx="12" fill="#fff" stroke="#0B0B0C" stroke-width="4"/><text x="150" y="668" font-family="',
            MONO,
            '" font-weight="700" font-size="',
            size.toString(),
            '" fill="#0B0B0C">',
            line,
            "</text>"
        );
    }

    function _flavour(PatchCard memory c) private pure returns (string memory) {
        string memory who = string.concat("@", c.creator);
        string memory line;
        if (c.sponsorNo == 1) line = string.concat("The first brand to back ", who, ".");
        else if (c.sponsorNo > 1) line = string.concat("Sponsor #", uint256(c.sponsorNo).toString(), " of ", who, ".");
        else line = string.concat("A spot on ", who, ".");
        return string.concat(
            '<text x="130" y="742" font-family="',
            BODY,
            '" font-style="italic" font-size="26" fill="#5F5B53">',
            line,
            "</text>"
        );
    }

    /// @dev Four numbered steps: won, printed, seen, delivered. Lit steps are orange.
    function _track(PatchCard memory c, uint256 done) private pure returns (string memory out) {
        for (uint256 i; i < 4; ++i) {
            out = string.concat(out, _step(i, i < done, i == 2 ? _seenLabel(c) : _stepName(i)));
        }
    }

    function _stepName(uint256 i) private pure returns (string memory) {
        return i == 0 ? "WON" : i == 1 ? "PRINTED" : i == 2 ? "SEEN" : "DELIVERED";
    }

    function _step(uint256 i, bool on, string memory label) private pure returns (string memory) {
        string memory x = (175 + i * 220).toString();
        return string.concat(
            string.concat(
                '<circle cx="',
                x,
                '" cy="820" r="32" fill="',
                on ? ORANGE : "#fff",
                '" stroke="#0B0B0C" stroke-width="4"/><text x="',
                x,
                '" y="831" text-anchor="middle" font-family="',
                DISPLAY,
                '" font-size="28" fill="',
                on ? "#fff" : "#B5AFA3",
                '">',
                (i + 1).toString()
            ),
            '</text><text x="',
            x,
            '" y="876" text-anchor="middle" font-family="',
            MONO,
            '" font-weight="700" font-size="19" fill="',
            on ? INK : "#8A857B",
            '">',
            label,
            "</text>"
        );
    }

    function _seenLabel(PatchCard memory c) private pure returns (string memory) {
        if (c.stage != SEEN) return "SEEN";
        return string.concat("SEEN ", uint256(c.seen).toString(), "/", uint256(c.seenOf).toString());
    }

    function _footer(PatchCard memory c, uint256 tier) private pure returns (string memory) {
        // Receipts minted before sponsor numbers existed have none: show which spot it is instead.
        string memory num = c.sponsorNo > 0
            ? string.concat("No.", _pad3(c.sponsorNo))
            : string.concat("#", c.listingId.toString(), ".", (uint256(c.patchId) + 1).toString());
        return string.concat(
            '<text x="130" y="922" font-family="',
            MONO,
            '" font-weight="700" font-size="20" fill="#0B0B0C">',
            num,
            '</text><text x="500" y="922" text-anchor="middle" font-family="',
            MONO,
            '" font-weight="700" font-size="20" fill="#8A857B">',
            tier == 2 ? "GOLD" : tier == 1 ? "SILK" : "COTTON",
            ' THREAD</text><text x="870" y="922" text-anchor="end" font-family="',
            MONO,
            '" font-weight="700" font-size="20" fill="#0B0B0C">PATCHED &#183; MONAD</text>'
        );
    }

    // ───────────────────────────── Text helpers ─────────────────────────────

    /// @dev 420000000 -> "420", 1234500000 -> "1,234.50": whole dollars with thousands commas; cents only if there are some.
    function _usd(uint96 amount) internal pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 cents = (amount % 1e6) / 1e4;
        bytes memory digits = bytes(whole.toString());
        bytes memory out = new bytes(digits.length + (digits.length - 1) / 3);
        uint256 j = out.length;
        for (uint256 i = digits.length; i > 0; --i) {
            out[--j] = digits[i - 1];
            if ((digits.length - i) % 3 == 2 && i > 1) out[--j] = ",";
        }
        string memory dollars = string(out);
        if (cents == 0) return dollars;
        return string.concat(dollars, ".", cents < 10 ? "0" : "", cents.toString());
    }

    function _pad3(uint32 n) private pure returns (string memory) {
        string memory s = uint256(n).toString();
        if (n < 10) return string.concat("00", s);
        if (n < 100) return string.concat("0", s);
        return s;
    }

    /// @dev Upper-cases a copy; the caller's string is left alone (the traits and description reuse it).
    function _upper(string memory s) internal pure returns (string memory) {
        bytes memory src = bytes(s);
        bytes memory b = new bytes(src.length);
        for (uint256 i; i < src.length; ++i) {
            b[i] = src[i] >= 0x61 && src[i] <= 0x7A ? bytes1(uint8(src[i]) - 32) : src[i];
        }
        return string(b);
    }

    function _toUint(string memory s) private pure returns (uint256 n) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            n = n * 10 + (uint8(b[i]) - 48);
        }
    }

    /// @dev "SEP 28" in UTC (days-to-civil-date), or empty when the date is unknown.
    function _day(uint40 ts) internal pure returns (string memory) {
        if (ts == 0) return "";
        int256 z = int256(uint256(ts) / 86400) + 719468;
        int256 era = z / 146097;
        int256 doe = z - era * 146097;
        int256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        int256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        int256 mp = (5 * doy + 2) / 153;
        uint256 day = uint256(doy - (153 * mp + 2) / 5 + 1);
        uint256 month = uint256(mp < 10 ? mp + 3 : mp - 9);
        bytes memory months = "JANFEBMARAPRMAYJUNJULAUGSEPOCTNOVDEC";
        bytes memory m = new bytes(3);
        for (uint256 i; i < 3; ++i) {
            m[i] = months[(month - 1) * 3 + i];
        }
        return string.concat(string(m), " ", day.toString());
    }
}

/// @title PatchRenderer
/// @notice Turns a receipt token into its metadata: the card above plus traits that follow the token's life. It is
///         separate from the receipt so the art can be fixed or redrawn later (`PatchReceipt.setRenderer`) without
///         touching a single token.
contract PatchRenderer is Ownable, IPatchRenderer {
    using Strings for uint256;

    /// @notice Where the website shows a token, e.g. "https://monad.patched.world/patch/". Empty = no link.
    string public siteUrl;

    constructor(address owner_, string memory siteUrl_) Ownable(owner_) {
        siteUrl = siteUrl_;
    }

    function setSiteUrl(string calldata siteUrl_) external onlyOwner {
        siteUrl = siteUrl_;
    }

    /// @notice The raw SVG for a token.
    function image(PatchedMarket market, uint256 tokenId) public view returns (string memory) {
        return PatchArt.render(_card(market.tokenView(tokenId)));
    }

    function tokenURI(address market, uint256 tokenId) external view returns (string memory) {
        PatchedMarket.TokenView memory v = PatchedMarket(market).tokenView(tokenId);
        PatchCard memory c = _card(v);
        string memory svg = PatchArt.render(c);
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(
                abi.encodePacked(
                    '{"name":"Patch #',
                    c.listingId.toString(),
                    "-",
                    uint256(c.patchId).toString(),
                    " - ",
                    c.label,
                    '","description":"',
                    _description(c, v),
                    '","image":"data:image/svg+xml;base64,',
                    Base64.encode(bytes(svg)),
                    '"',
                    _links(tokenId, v),
                    ',"attributes":[',
                    _traits(c, v),
                    "]}"
                )
            )
        );
    }

    // ───────────────────────────── Internals ─────────────────────────────

    function _card(PatchedMarket.TokenView memory v) internal pure returns (PatchCard memory c) {
        c.brand = v.brand == bytes32(0) ? _short(v.winner) : _clean(v.brand);
        c.label = _clean(v.label);
        c.eventStr = v.eventName == bytes32(0) ? _surfaceName(v.surface) : _clean(v.eventName);
        c.creator = v.creatorName == bytes32(0) ? _short(v.creator) : _clean(v.creatorName);
        c.listingId = v.listingId;
        c.patchId = v.patchId;
        c.surface = uint8(v.surface);
        c.stage = v.stage;
        c.sponsorNo = v.sponsorNo;
        c.amount = v.amount;
        c.printedAt = v.printedAt;
        c.seenAt = v.seenAt;
        c.seenOf = v.milestoneCount > 0 ? v.milestoneCount - 1 : 0;
        c.seen = v.proofsDone > 0 ? v.proofsDone - 1 : 0;
    }

    function _description(PatchCard memory c, PatchedMarket.TokenView memory v)
        internal
        pure
        returns (string memory)
    {
        string memory who = c.sponsorNo > 0
            ? string.concat(c.brand, " backed ", c.creator, " (sponsor No.", uint256(c.sponsorNo).toString(), "). ")
            : string.concat(c.brand, " backed ", c.creator, ". ");
        if (v.stage == PatchArt.DELIVERED) {
            return string.concat(who, "The creator delivered and was paid. This patch is a permanent record that it happened.");
        }
        if (v.stage == PatchArt.REFUNDED) {
            return string.concat(who, "The creator did not deliver, so the escrow went back to the holder. The patch is unpicked.");
        }
        if (v.stage == PatchArt.DISPUTED) {
            return string.concat(who, "The holder has disputed the latest proof. The money stays held until it is settled.");
        }
        return string.concat(who, "The holder owns the spot and its escrow rights. The art updates as the creator proves each step.");
    }

    function _links(uint256 tokenId, PatchedMarket.TokenView memory v) internal view returns (string memory out) {
        if (bytes(siteUrl).length != 0) {
            out = string.concat(',"external_url":"', _uri(siteUrl), tokenId.toString(), '"');
        }
        if (bytes(v.proofURI).length != 0) out = string.concat(out, ',"proof":"', _uri(v.proofURI), '"');
        if (bytes(v.coverURI).length != 0) out = string.concat(out, ',"proof_image":"', _uri(v.coverURI), '"');
    }

    function _traits(PatchCard memory c, PatchedMarket.TokenView memory v) internal pure returns (string memory) {
        // What the card draws for the surface.
        string memory art = v.surface == PatchedMarket.Surface.Outfit
            ? "Tee"
            : v.surface == PatchedMarket.Surface.Car ? "Car" : "Hoodie";
        string memory thread = v.amount >= 1_000e6 ? "Gold" : v.amount >= 100e6 ? "Silk" : "Cotton";
        string[5] memory shapes = ["Rounded", "Round", "Shield", "Hexagon", "Scalloped"];
        return string.concat(
            _trait("Stage", _stageName(v.stage)),
            ",",
            c.sponsorNo > 0 ? string.concat(_num("Sponsor #", c.sponsorNo), ",") : "",
            _trait("Proofs", string.concat(uint256(v.proofsDone).toString(), "/", uint256(v.milestoneCount).toString())),
            ",",
            _trait("Creator", c.creator),
            ",",
            _trait("Brand", c.brand),
            ",",
            _trait("Surface", _surfaceName(v.surface)),
            ",",
            _trait("Patch", c.label),
            v.eventName == bytes32(0) ? "" : string.concat(",", _trait("Event", c.eventStr)),
            ",",
            _trait("Winning bid (USDC)", PatchArt._usd(v.amount)),
            ",",
            _trait("Thread", thread),
            ",",
            _trait("Shape", shapes[v.patchId % 5]),
            ",",
            _trait("Art", art),
            ",",
            _num("Listing", v.listingId)
        );
    }

    function _trait(string memory name, string memory value) private pure returns (string memory) {
        return string.concat('{"trait_type":"', name, '","value":"', value, '"}');
    }

    function _num(string memory name, uint256 value) private pure returns (string memory) {
        return string.concat('{"trait_type":"', name, '","display_type":"number","value":', value.toString(), "}");
    }

    function _stageName(uint8 stage) private pure returns (string memory) {
        string[6] memory names = ["Won", "Printed", "Seen", "Delivered", "Refunded", "Disputed"];
        return names[stage];
    }

    function _surfaceName(PatchedMarket.Surface s) private pure returns (string memory) {
        if (s == PatchedMarket.Surface.Outfit) return "Outfit";
        if (s == PatchedMarket.Surface.Car) return "Car";
        return "Team hoodie";
    }

    /// @dev bytes32 -> string, keeping only characters that are safe inside both SVG and JSON.
    function _clean(bytes32 value) internal pure returns (string memory) {
        uint256 len;
        while (len < 32 && value[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) {
            bytes1 ch = value[i];
            bool ok = (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || (ch >= "0" && ch <= "9") || ch == " "
                || ch == "." || ch == "-" || ch == "_";
            out[i] = ok ? ch : bytes1("?");
        }
        return string(out);
    }

    /// @dev A link from user input, made safe to place inside a JSON string: printable ASCII only, no quote,
    ///      backslash or angle bracket.
    function _uri(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length);
        for (uint256 i; i < b.length; ++i) {
            bytes1 ch = b[i];
            bool ok = ch > 0x20 && ch < 0x7F && ch != '"' && ch != "\\" && ch != "<" && ch != ">";
            out[i] = ok ? ch : bytes1("?");
        }
        return string(out);
    }

    /// @dev 0x8fBf...99D1 for an address with no name.
    function _short(address a) internal pure returns (string memory) {
        bytes memory f = bytes(Strings.toHexString(a)); // "0x" + 40 hex characters
        bytes memory out = new bytes(12);
        for (uint256 i; i < 6; ++i) {
            out[i] = f[i];
        }
        out[6] = ".";
        out[7] = ".";
        for (uint256 i; i < 4; ++i) {
            out[8 + i] = f[38 + i];
        }
        return string(out);
    }
}
