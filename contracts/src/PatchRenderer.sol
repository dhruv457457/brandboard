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
/// @notice The patch NFT drawn as what it is: an embroidered patch. A big stitched patch sits on dark cloth under a
///         studio light, its thread border follows the price tier (cotton, silk, gold), passport ink stamps land as the
///         creator proves each step, and a thread along the bottom is sewn one knot further each time. It is the on-chain
///         twin of apps/web/src/lib/patchCard.ts, so keep the two in step.
///         Plain SVG: gradients, patterns and three filters (raised-thread lighting, ink wear, a soft shadow). System
///         fonts, no images, no scripts.
library PatchArt {
    using Strings for uint256;

    uint8 internal constant WON = 0;
    uint8 internal constant PRINTED = 1;
    uint8 internal constant SEEN = 2;
    uint8 internal constant DELIVERED = 3;
    uint8 internal constant REFUNDED = 4;
    uint8 internal constant DISPUTED = 5;

    string internal constant DISPLAY = "Arial Black, Arial, Helvetica, sans-serif";
    string internal constant MONO = "Courier New, monospace";
    string internal constant INK = "#0B0B0C";
    string internal constant ORANGE = "#FF5A1F";
    string internal constant CREAM = "#F4EFE3";
    string internal constant MUTED = "#A39B8C";

    function render(PatchCard memory c) internal pure returns (string memory) {
        uint256 tier = c.amount >= 1_000e6 ? 2 : c.amount >= 100e6 ? 1 : 0; // cotton, silk, gold
        uint256 done = _done(c.stage);
        bool refunded = c.stage == REFUNDED;
        return string.concat(
            '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img">',
            _defs(c, tier, refunded),
            refunded ? '<g filter="url(#grey)" opacity=".85">' : "<g>",
            _backdrop(c, tier),
            _patch(c, tier),
            _stamps(c, done),
            _overlay(c),
            _top(c, tier),
            _caption(c),
            _track(c, tier, done),
            string.concat(
                '<text x="500" y="968" text-anchor="middle" font-family="',
                MONO,
                '" font-weight="700" font-size="15" letter-spacing="5" fill="#6E675B">PATCHED &#183; MONAD</text><rect width="1000" height="1000" fill="url(#vig)"/></g></svg>'
            )
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

    /// @dev The five patch outlines, centred on (0, 0), the width the brand name may use, and the scale that makes all
    ///      five read about the same size on the card. Chosen by patch number.
    function _shape(uint8 patchId) private pure returns (string memory d, uint256 maxW, string memory scale) {
        uint8 i = patchId % 5;
        if (i == 0) {
            return (
                "M-216.5 -175 H216.5 A73.5 73.5 0 0 1 290 -101.5 V101.5 A73.5 73.5 0 0 1 216.5 175 H-216.5 A73.5 73.5 0 0 1 -290 101.5 V-101.5 A73.5 73.5 0 0 1 -216.5 -175 Z",
                420,
                "1.06"
            );
        }
        if (i == 1) return ("M-175 0 a175 175 0 1 0 350 0 a175 175 0 1 0 -350 0 Z", 262, "1.4");
        if (i == 2) {
            return ("M-226.2 -175 Q0 -206.5 226.2 -175 V8.8 Q226.2 122.5 0 183.8 Q-226.2 122.5 -226.2 8.8 Z", 330, "1.2");
        }
        if (i == 3) return ("M-290 0 L-145 -175 L145 -175 L290 0 L145 175 L-145 175 Z", 330, "1.06");
        return (
            string.concat(
                "M160 0 A34.4 34.4 0 0 1 147.8 61.2 A34.4 34.4 0 0 1 113.1 113.1 A34.4 34.4 0 0 1 61.2 147.8 ",
                "A34.4 34.4 0 0 1 0 160 A34.4 34.4 0 0 1 -61.2 147.8 A34.4 34.4 0 0 1 -113.1 113.1 ",
                "A34.4 34.4 0 0 1 -147.8 61.2 A34.4 34.4 0 0 1 -160 0 A34.4 34.4 0 0 1 -147.8 -61.2 ",
                "A34.4 34.4 0 0 1 -113.1 -113.1 A34.4 34.4 0 0 1 -61.2 -147.8 A34.4 34.4 0 0 1 0 -160 ",
                "A34.4 34.4 0 0 1 61.2 -147.8 A34.4 34.4 0 0 1 113.1 -113.1 A34.4 34.4 0 0 1 147.8 -61.2 ",
                "A34.4 34.4 0 0 1 160 0 Z"
            ),
            230,
            "1.5"
        );
    }

    /// @dev A font size that fits `text` in `maxW` (Arial Black runs about 0.66 em per character), capped at `max`.
    function _fit(string memory text, uint256 maxW, uint256 max) private pure returns (uint256 size) {
        uint256 n = bytes(text).length;
        if (n < 3) n = 3;
        size = (maxW * 100) / (n * 66);
        if (size > max) size = max;
    }

    /// @dev What each price tier looks like: backdrop light and dark, the glow, the thread border, the accent.
    function _tier(uint256 tier)
        private
        pure
        returns (string memory bg0, string memory bg1, string memory glow, string memory stops, string memory rim)
    {
        if (tier == 2) {
            return (
                "#5A410C",
                "#0F0A01",
                "#FFD76A",
                '<stop offset="0" stop-color="#8A6100"/><stop offset=".25" stop-color="#F7D774"/><stop offset=".5" stop-color="#B8860B"/><stop offset=".75" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/>',
                "#FFD76A"
            );
        }
        if (tier == 1) {
            return (
                "#3B2F8F",
                "#0C0A26",
                "#FF8AD8",
                '<stop offset="0" stop-color="#836EF9"/><stop offset=".35" stop-color="#FF8AD8"/><stop offset=".7" stop-color="#7FD3FF"/><stop offset="1" stop-color="#B49CFF"/>',
                "#B49CFF"
            );
        }
        return (
            "#3A322C",
            "#0E0D0C",
            "#FF7A45",
            '<stop offset="0" stop-color="#FFFBF0"/><stop offset=".5" stop-color="#D6CCB4"/><stop offset="1" stop-color="#FBF5E4"/>',
            "#FF7A45"
        );
    }

    // ───────────────────────────── Parts ─────────────────────────────

    function _defs(PatchCard memory c, uint256 tier, bool grey) private pure returns (string memory) {
        (string memory bg0, string memory bg1, string memory glow, string memory stops,) = _tier(tier);
        (string memory d,,) = _shape(c.patchId);
        string memory lights = string.concat(
            '<defs><radialGradient id="bg" cx=".5" cy=".42" r=".78"><stop offset="0" stop-color="',
            bg0,
            '"/><stop offset="1" stop-color="',
            bg1,
            '"/></radialGradient><radialGradient id="glow" cx=".5" cy=".46" r=".5"><stop offset="0" stop-color="',
            glow,
            '" stop-opacity=".55"/><stop offset="1" stop-color="',
            glow,
            '" stop-opacity="0"/></radialGradient><linearGradient id="thread" x1="0" y1="0" x2="1" y2="1">',
            stops,
            "</linearGradient>",
            tier == 2
                ? '<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(28 .5 .5)"><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></linearGradient>'
                : ""
        );
        return string.concat(
            lights,
            '<radialGradient id="vig" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>',
            '<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>',
            '<pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 2H8M0 6H8" stroke="#fff" stroke-opacity=".045" stroke-width="2"/><path d="M2 0V8M6 0V8" stroke="#000" stroke-opacity=".16" stroke-width="2"/></pattern>',
            '<pattern id="twill" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="2.4" height="6" fill="#000" opacity=".15"/><rect x="3.2" width="1" height="6" fill="#fff" opacity=".12"/></pattern>',
            '<pattern id="satin" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(60)"><rect width="2.4" height="7" fill="#fff" opacity=".26"/></pattern>',
            _filters(),
            '<path id="shape" d="',
            d,
            '"/>',
            grey ? '<filter id="grey"><feColorMatrix type="saturate" values="0.1"/></filter>' : "",
            "</defs>"
        );
    }

    /// @dev The three filters: a soft shadow, raised-thread lighting for the patch, and worn ink for the stamps.
    function _filters() private pure returns (string memory) {
        return string.concat(
            '<filter id="blur" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="14"/></filter>',
            '<filter id="puff" x="-10%" y="-10%" width="120%" height="125%"><feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/><feSpecularLighting in="b" surfaceScale="9" specularConstant="1.1" specularExponent="60" lighting-color="#fff" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sc"/><feComposite in="SourceGraphic" in2="sc" operator="arithmetic" k1="0" k2="1" k3=".7" k4="0"/></filter>',
            '<filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 6.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>'
        );
    }

    /// @dev The cloth the patch is sewn on, lit from the middle, with a faint sewing pattern of the surface.
    function _backdrop(PatchCard memory c, uint256) private pure returns (string memory) {
        return string.concat(
            '<rect width="1000" height="1000" fill="url(#bg)"/><rect width="1000" height="1000" fill="url(#weave)"/><g fill="none" stroke="#F4EFE3" stroke-opacity=".11" stroke-width="3.5" stroke-dasharray="11 9" stroke-linejoin="round" stroke-linecap="round">',
            _pattern(c.surface),
            '</g><rect width="1000" height="1000" fill="url(#glow)"/>'
        );
    }

    /// @dev A sewing-pattern outline of each surface, drawn big and faint behind the patch.
    function _pattern(uint8 surface) private pure returns (string memory) {
        if (surface == 1) {
            return '<path transform="translate(500 470) scale(1.5)" d="M-340 190 C-340 150 -320 135 -268 128 L-190 70 C-160 40 -120 28 -60 26 L92 26 C140 26 170 40 200 70 L272 128 C322 135 340 150 340 190 L340 240 L-340 240 Z"/><circle transform="translate(500 470) scale(1.5)" cx="-190" cy="242" r="52"/><circle transform="translate(500 470) scale(1.5)" cx="190" cy="242" r="52"/>';
        }
        if (surface == 2) {
            return '<path transform="translate(500 90) scale(1.4)" d="M-120 40 Q-60 -10 0 -10 Q60 -10 120 40 L240 120 L300 330 L220 360 L180 230 L180 600 L-180 600 L-180 230 L-220 360 L-300 330 L-240 120 Z"/><path transform="translate(500 90) scale(1.4)" d="M-95 30 Q0 140 95 30 M-110 470 Q0 500 110 470 L110 560 L-110 560 Z"/>';
        }
        return '<path transform="translate(500 90) scale(1.35)" d="M-110 0 Q0 60 110 0 L250 90 L300 290 L215 320 L180 210 L180 600 L-180 600 L-180 210 L-215 320 L-300 290 L-250 90 Z"/><path transform="translate(500 90) scale(1.35)" d="M-110 0 Q0 60 110 0"/>';
    }

    /// @dev The embroidered patch: a soft shadow, a dark outline, the cloth, twill, a merrowed border in the tier's thread,
    ///      a running stitch, and the brand name stitched in satin. A refunded patch is unpicked: only its stitch holes are
    ///      left.
    function _patch(PatchCard memory c, uint256 tier) private pure returns (string memory) {
        (, uint256 maxW, string memory scale) = _shape(c.patchId);
        if (c.stage == REFUNDED) {
            return string.concat(
                '<g transform="translate(500 440) rotate(-3) scale(',
                scale,
                ')"><use href="#shape" fill="none" stroke="#F4EFE3" stroke-opacity=".55" stroke-width="10" stroke-dasharray="4 18" stroke-linecap="round"/></g>'
            );
        }
        string[5] memory cloth = ["#FF5A1F", "#16161A", "#F4EFE3", "#836EF9", "#1F9D6B"];
        string[5] memory thread = ["#FFF4E6", "#F4EFE3", "#16161A", "#FFFFFF", "#F4FFF8"];
        string memory fillC = cloth[c.patchId % 5];
        string memory threadC = thread[c.patchId % 5];
        string memory body = string.concat(
            '<g transform="translate(500 440) rotate(-3) scale(',
            scale,
            ')"><use href="#shape" transform="translate(9 22)" fill="#000" opacity=".6" filter="url(#blur)"/><g filter="url(#puff)"><use href="#shape" fill="#0B0B0C" stroke="#0B0B0C" stroke-width="42" stroke-linejoin="round"/><use href="#shape" fill="',
            fillC,
            '"/><use href="#shape" fill="url(#twill)"/><use href="#shape" fill="none" stroke="url(#thread)" stroke-width="30" stroke-linejoin="round"/>'
        );
        return string.concat(
            body,
            '<use href="#shape" fill="none" stroke="#0B0B0C" stroke-opacity=".38" stroke-width="30" stroke-dasharray="2.4 4.2"/><use href="#shape" fill="none" stroke="#fff" stroke-opacity=".34" stroke-width="30" stroke-dasharray="1.2 5.4" stroke-dashoffset="2"/><use href="#shape" transform="scale(.8)" fill="none" stroke="',
            threadC,
            '" stroke-opacity=".7" stroke-width="4.5" stroke-dasharray="15 10" stroke-linecap="round"/>',
            _word(c.brand, maxW, threadC),
            '<use href="#shape" fill="url(#gloss)"/>',
            tier == 2 ? '<use href="#shape" fill="url(#sheen)"/>' : "",
            "</g></g>"
        );
    }

    /// @dev The brand name: a shadow, the satin thread, and the diagonal sheen of the stitches.
    function _word(string memory brand, uint256 maxW, string memory threadC) private pure returns (string memory) {
        uint256 size = _fit(brand, maxW, 108);
        string memory y = ((size * 35) / 100).toString();
        string memory sz = size.toString();
        string memory attrs = string.concat('" text-anchor="middle" font-family="', DISPLAY, '" font-size="', sz, '" ');
        return string.concat(
            '<text x="3" y="',
            ((size * 35) / 100 + 5).toString(),
            attrs,
            'fill="#000" opacity=".38" stroke="#000" stroke-width="3">',
            brand,
            '</text><text x="0" y="',
            y,
            attrs,
            'fill="',
            threadC,
            '" stroke="',
            threadC,
            '" stroke-width="3" stroke-linejoin="round">',
            brand,
            '</text><text x="0" y="',
            y,
            attrs,
            'fill="url(#satin)">',
            brand,
            "</text>"
        );
    }

    /// @dev Passport stamps, one per proven step, in worn ink on a dark plate.
    function _stamps(PatchCard memory c, uint256 done) private pure returns (string memory out) {
        if (done >= 2) {
            out = _roundStamp("printed", 150, 212, 62, "-14", "#FF8A5C", "PRINTED", 23, _day(c.printedAt));
        }
        if (done >= 3) {
            out = string.concat(out, _roundStamp("seen", 852, 218, 58, "12", "#B6A8FF", "SEEN", 30, _day(c.seenAt)));
        }
        if (done >= 4) {
            out = string.concat(out, _rectStamp("delivered", 520, 566, 360, 40, "-7", "#3DDC97", "DELIVERED"));
        }
    }

    function _roundStamp(
        string memory k,
        uint256 cx,
        uint256 cy,
        uint256 r,
        string memory rot,
        string memory color,
        string memory word,
        uint256 wordSize,
        string memory sub
    ) private pure returns (string memory) {
        string memory at = string.concat(' cx="', cx.toString(), '" cy="', cy.toString(), '" r="');
        string memory rings = string.concat(
            '<circle',
            at,
            (r + 4).toString(),
            '" fill="#000" fill-opacity=".34"/><circle',
            at,
            r.toString(),
            '" fill="none" stroke="',
            color,
            '" stroke-width="7"/><circle',
            at,
            (r - 13).toString(),
            '" fill="none" stroke="',
            color,
            '" stroke-width="2.5" stroke-dasharray="5 5"/>'
        );
        return string.concat(
            '<g id="stamp-',
            k,
            '" transform="rotate(',
            rot,
            " ",
            cx.toString(),
            " ",
            cy.toString(),
            ')" filter="url(#ink)">',
            rings,
            string.concat(
                '<text x="',
                cx.toString(),
                '" y="',
                (cy + 6).toString(),
                '" text-anchor="middle" font-family="',
                DISPLAY,
                '" font-size="',
                wordSize.toString(),
                '" fill="',
                color,
                '">',
                word
            ),
            string.concat(
                '</text><text x="',
                cx.toString(),
                '" y="',
                (cy + 34).toString(),
                '" text-anchor="middle" font-family="',
                MONO,
                '" font-weight="700" font-size="17" fill="',
                color,
                '">',
                sub,
                "</text></g>"
            )
        );
    }

    /// @dev A rectangular rubber stamp with a double border, on a dark plate.
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
            ')" filter="url(#ink)"><rect x="',
            x.toString(),
            '" y="',
            y.toString(),
            '" width="',
            w.toString(),
            '" height="',
            h.toString(),
            '" rx="10" fill="#000" fill-opacity=".38" stroke="',
            color,
            '" stroke-width="8"/>'
        );
        string memory inner = string.concat(
            '<rect x="',
            (x + 11).toString(),
            '" y="',
            (y + 11).toString(),
            '" width="',
            (w - 22).toString(),
            '" height="',
            (h - 22).toString(),
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

    /// @dev Over the patch: an ink REFUNDED stamp, or hazard tape while a proof is disputed.
    function _overlay(PatchCard memory c) private pure returns (string memory) {
        if (c.stage == REFUNDED) {
            return _rectStamp("refunded", 240, 380, 520, 46, "-9", CREAM, string.concat("REFUNDED $", _usd(c.amount)));
        }
        if (c.stage != DISPUTED) return "";
        bytes memory stripes;
        for (uint256 k; k < 21; ++k) {
            stripes = abi.encodePacked(stripes, '<path d="M', (60 + k * 42).toString(), ' 400 l22 0 -26 72 -22 0z"/>');
        }
        return string.concat(
            '<g transform="rotate(-9 500 440)"><rect x="60" y="400" width="880" height="72" fill="#FFD400" stroke="#0B0B0C" stroke-width="4"/><g fill="#0B0B0C">',
            string(stripes),
            '</g><rect x="300" y="408" width="400" height="56" fill="#FFD400"/><text x="500" y="447" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="30" fill="#0B0B0C">PROOF DISPUTED</text></g>'
        );
    }

    /// @dev Top of the card: the sponsor number and tier thread on the left, the price on the right.
    function _top(PatchCard memory c, uint256 tier) private pure returns (string memory) {
        (,,,, string memory rim) = _tier(tier);
        // Receipts minted before sponsor numbers existed have none: show which spot it is instead.
        string memory num = c.sponsorNo > 0
            ? string.concat("No.", _pad3(c.sponsorNo))
            : string.concat("#", c.listingId.toString(), ".", (uint256(c.patchId) + 1).toString());
        string memory price = string.concat("$", _usd(c.amount));
        uint256 n = bytes(price).length;
        return string.concat(
            '<text x="64" y="86" font-family="',
            MONO,
            '" font-weight="700" font-size="30" fill="#F4EFE3">',
            num,
            '</text><text x="64" y="116" font-family="',
            MONO,
            '" font-weight="700" font-size="17" letter-spacing="3" fill="',
            rim,
            '">',
            tier == 2 ? "GOLD" : tier == 1 ? "SILK" : "COTTON",
            ' THREAD</text><rect x="768" y="52" width="168" height="62" rx="31" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="4"/><text x="852" y="',
            n <= 6 ? "94" : "90",
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-size="',
            n <= 4 ? "36" : n <= 6 ? "31" : "24",
            '" fill="#fff">',
            price,
            '<tspan font-family="',
            MONO,
            '" font-size="14" font-weight="700" dx="5">USDC</tspan></text>'
        );
    }

    /// @dev Under the patch: who it is on, and "OUTFIT · CHEST POCKET · ETHGLOBAL MUMBAI". With no event the card's event is
    ///      the surface name, so it is left out instead of repeating. Long lines get a smaller font.
    function _caption(PatchCard memory c) private pure returns (string memory) {
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
        uint256 size = n <= 44 ? 20 : (20 * 44) / n;
        if (size < 13) size = 13;
        uint256 whoLen = bytes(c.creator).length + 1;
        uint256 whoSize = 76_000 / ((whoLen < 4 ? 4 : whoLen) * 56);
        if (whoSize > 40) whoSize = 40;
        if (whoSize < 26) whoSize = 26;
        return string.concat(
            '<text x="64" y="776" font-family="',
            DISPLAY,
            '" font-size="',
            whoSize.toString(),
            '" fill="#F4EFE3">@',
            c.creator,
            '</text><text x="64" y="808" font-family="',
            MONO,
            '" font-weight="700" font-size="',
            size.toString(),
            '" fill="#A39B8C">',
            line,
            "</text>"
        );
    }

    /// @dev The thread: sewn one knot further for each proven step (won, printed, seen, delivered).
    function _track(PatchCard memory c, uint256 tier, uint256 done) private pure returns (string memory out) {
        (,,,, string memory rim) = _tier(tier);
        uint256[4] memory xs = [uint256(96), 365, 635, 904];
        out = string.concat(
            '<path d="M96 862 H904" stroke="#F4EFE3" stroke-opacity=".28" stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round"/><path d="M96 862 H',
            xs[done - 1].toString(),
            '" stroke="',
            rim,
            '" stroke-width="7" stroke-dasharray="14 7" stroke-linecap="round"/>'
        );
        for (uint256 i; i < 4; ++i) {
            out = string.concat(out, _step(i, xs[i], i < done, i == 2 ? _seenLabel(c) : _stepName(i)));
        }
    }

    function _stepName(uint256 i) private pure returns (string memory) {
        return i == 0 ? "WON" : i == 1 ? "PRINTED" : i == 2 ? "SEEN" : "DELIVERED";
    }

    /// @dev One knot on the thread: sewn (orange, ticked) or not yet (a dark ring), with its label under it.
    function _step(uint256 i, uint256 x, bool on, string memory label) private pure returns (string memory) {
        string memory xs = x.toString();
        string memory knot = on
            ? string.concat(
                '<circle cx="',
                xs,
                '" cy="862" r="17" fill="#FF5A1F" stroke="#F4EFE3" stroke-width="4"/><path d="M',
                (x - 7).toString(),
                ' 862 l5 6 10 -12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
            )
            : string.concat('<circle cx="', xs, '" cy="862" r="13" fill="#0B0B0C" stroke="#5A5348" stroke-width="3"/>');
        return string.concat(
            knot,
            '<text x="',
            xs,
            '" y="918" text-anchor="',
            i == 0 ? "start" : i == 3 ? "end" : "middle",
            i == 0 ? '" dx="-12' : i == 3 ? '" dx="12' : "",
            '" font-family="',
            MONO,
            '" font-weight="700" font-size="19" fill="',
            on ? CREAM : "#6E675B",
            '">',
            label,
            "</text>"
        );
    }

    function _seenLabel(PatchCard memory c) private pure returns (string memory) {
        if (c.stage != SEEN) return "SEEN";
        return string.concat("SEEN ", uint256(c.seen).toString(), "/", uint256(c.seenOf).toString());
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
