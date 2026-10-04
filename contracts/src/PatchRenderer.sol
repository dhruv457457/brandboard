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
/// @notice The Living Patch card as an SVG string: an embroidered patch sewn onto the creator's fabric, a woven label
///         with the facts, and a passport stamp for every proven step. It is the on-chain twin of
///         apps/web/src/lib/patchCard.ts (no photo, system fonts only), so keep the two in step.
///         Plain SVG only: patterns, gradients, one drop shadow, clip paths and text on a path. No images, no scripts.
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

    function render(PatchCard memory c) internal pure returns (string memory) {
        bool progressed = c.stage == PRINTED || c.stage == SEEN || c.stage == DELIVERED;
        bool unpicked = c.stage == REFUNDED;
        (string memory d, uint256 inner) = _shape(c.patchId);
        uint256 tier = c.amount >= 1_000e6 ? 2 : c.amount >= 100e6 ? 1 : 0; // cotton, silk, gold

        // The patch moves left to make room for the stamps once there is something to stamp.
        string memory move = progressed
            ? "translate(-90 36) translate(500 430) scale(.74) translate(-500 -430)"
            : "translate(0 0) translate(500 430) scale(1) translate(-500 -430)";

        return string.concat(
            '<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="img">',
            _defs(c.surface, tier, unpicked, d),
            _background(c.surface, unpicked),
            '<g transform="',
            move,
            '">',
            unpicked ? _unpicked(d) : _patch(c, d, inner, tier),
            "</g>",
            _stamps(c, progressed),
            _banner(c),
            _header(c),
            _label(c, tier)
        );
    }

    // ───────────────────────────── Shapes ─────────────────────────────

    /// @dev The five outlines, centred on (500, 430), and the width the brand name may use. Chosen by patch number.
    function _shape(uint8 patchId) private pure returns (string memory d, uint256 inner) {
        uint8 i = patchId % 5;
        if (i == 0) {
            return (
                "M280 260 H720 A70 70 0 0 1 790 330 V530 A70 70 0 0 1 720 600 H280 A70 70 0 0 1 210 530 V330 A70 70 0 0 1 280 260 Z",
                470
            );
        }
        if (i == 1) return ("M265 430 a235 235 0 1 0 470 0 a235 235 0 1 0 -470 0 Z", 350);
        if (i == 2) return ("M275 225 Q500 180 725 225 V435 Q725 605 500 685 Q275 605 275 435 Z", 360);
        if (i == 3) {
            return (
                "M720.8 557.5 L500.0 685.0 L279.2 557.5 L279.2 302.5 L500.0 175.0 L720.8 302.5 Z", 310
            );
        }
        return (
            string.concat(
                "M715.0 430.0 A39.5 39.5 0 0 1 702.0 503.5 A39.5 39.5 0 0 1 664.7 568.2 A39.5 39.5 0 0 1 607.5 616.2 ",
                "A39.5 39.5 0 0 1 537.3 641.7 A39.5 39.5 0 0 1 462.7 641.7 A39.5 39.5 0 0 1 392.5 616.2 ",
                "A39.5 39.5 0 0 1 335.3 568.2 A39.5 39.5 0 0 1 298.0 503.5 A39.5 39.5 0 0 1 285.0 430.0 ",
                "A39.5 39.5 0 0 1 298.0 356.5 A39.5 39.5 0 0 1 335.3 291.8 A39.5 39.5 0 0 1 392.5 243.8 ",
                "A39.5 39.5 0 0 1 462.7 218.3 A39.5 39.5 0 0 1 537.3 218.3 A39.5 39.5 0 0 1 607.5 243.8 ",
                "A39.5 39.5 0 0 1 664.7 291.8 A39.5 39.5 0 0 1 702.0 356.5 A39.5 39.5 0 0 1 715.0 430.0 Z"
            ),
            330
        );
    }

    // ───────────────────────────── Parts ─────────────────────────────

    function _defs(uint8 surface, uint256 tier, bool unpicked, string memory d) private pure returns (string memory) {
        (string memory base, string memory hi) = surface == 0
            ? ("#22385C", "#2F4C78")
            : surface == 1 ? ("#1D5A45", "#2B7A5E") : ("#24212E", "#353046");
        string memory thread = tier == 2
            ? '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7A5300"/><stop offset=".3" stop-color="#F7D774"/><stop offset=".55" stop-color="#B8860B"/><stop offset=".8" stop-color="#FFF0A8"/><stop offset="1" stop-color="#8A6100"/></linearGradient><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".45"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/></linearGradient>'
            : tier == 1
                ? '<linearGradient id="silk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#836EF9"/><stop offset=".5" stop-color="#FF8AD8"/><stop offset="1" stop-color="#7FD3FF"/></linearGradient>'
                : "";
        return string.concat(
            '<defs><pattern id="twill" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="14" height="14" fill="',
            base,
            '"/><rect width="6" height="14" fill="',
            hi,
            '" opacity=".55"/></pattern>',
            '<pattern id="satin" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><rect width="4" height="9" fill="#fff" opacity=".22"/></pattern>',
            '<pattern id="thread" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-50)"><rect width="6" height="6" fill="#0B0B0C"/><rect width="2" height="6" fill="#fff" opacity=".18"/></pattern>',
            thread,
            '<filter id="lift" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#000" flood-opacity=".5"/></filter>',
            unpicked ? '<filter id="grey"><feColorMatrix type="saturate" values="0"/></filter>' : "",
            '<clipPath id="clip"><path d="',
            d,
            '"/></clipPath></defs>'
        );
    }

    function _background(uint8 surface, bool unpicked) private pure returns (string memory) {
        return string.concat(
            '<rect width="1000" height="1000" fill="url(#twill)"',
            unpicked ? ' filter="url(#grey)"' : "",
            '/><rect x="0" y="0" width="1000" height="1000" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="40"/>',
            surface == 1
                ? '<rect x="330" y="0" width="70" height="1000" fill="#F4EFE3" opacity=".9"/><rect x="600" y="0" width="70" height="1000" fill="#F4EFE3" opacity=".9"/>'
                : ""
        );
    }

    /// @dev A refunded patch is unpicked: only the stitch holes stay.
    function _unpicked(string memory d) private pure returns (string memory) {
        return string.concat(
            '<path d="',
            d,
            '" fill="#000" fill-opacity=".18"/><path d="',
            d,
            '" fill="none" stroke="#F4EFE3" stroke-opacity=".75" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round"/><path d="',
            d,
            '" transform="translate(500 430) scale(.9) translate(-500 -430)" fill="none" stroke="#F4EFE3" stroke-opacity=".45" stroke-width="4" stroke-dasharray="2 11" stroke-linecap="round"/>'
        );
    }

    /// @dev Pastel satin fill, a merrowed edge in the tier's thread, a stitch ring and the brand name.
    function _patch(PatchCard memory c, string memory d, uint256 inner, uint256 tier)
        private
        pure
        returns (string memory)
    {
        string[5] memory pastels = ["#BDEBD3", "#D9CCFF", "#FFE58F", "#BFE3FF", "#FFC9DA"];
        uint256 n = bytes(c.brand).length;
        if (n < 4) n = 4;
        uint256 size = (inner * 10) / (n * 6);
        if (size > 112) size = 112;
        string memory stroke = tier == 2 ? "url(#gold)" : tier == 1 ? "url(#silk)" : "#0B0B0C";

        return string.concat(
            '<g filter="url(#lift)"><path d="',
            d,
            '" fill="',
            pastels[c.patchId % 5],
            '"/><path d="',
            d,
            '" fill="url(#satin)"/><g clip-path="url(#clip)"><rect x="0" y="0" width="1000" height="390" fill="#fff" opacity=".18"/></g>',
            _edge(d, stroke, tier == 2),
            '<path d="',
            d,
            '" transform="translate(500 430) scale(.86) translate(-500 -430)" fill="none" stroke="#0B0B0C" stroke-opacity=".55" stroke-width="5" stroke-dasharray="13 9"/>',
            _brandText(c.brand, size),
            "</g>"
        );
    }

    function _edge(string memory d, string memory stroke, bool gold) private pure returns (string memory) {
        return string.concat(
            '<path d="',
            d,
            '" fill="none" stroke="',
            stroke,
            '" stroke-width="26"/><path d="',
            d,
            '" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="26" stroke-dasharray="2.5 4.5"/>',
            gold ? string.concat('<path d="', d, '" fill="none" stroke="url(#sheen)" stroke-width="26"/>') : ""
        );
    }

    function _brandText(string memory brand, uint256 size) private pure returns (string memory) {
        return string.concat(
            '<text x="500" y="',
            (430 + (size * 35) / 100).toString(),
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-weight="800" font-size="',
            size.toString(),
            '" letter-spacing="-0.02em" fill="url(#thread)" stroke="#0B0B0C" stroke-width="2">',
            brand,
            "</text>"
        );
    }

    function _stamps(PatchCard memory c, bool progressed) private pure returns (string memory out) {
        if (!progressed) return "";
        out = _stamp(
            "a", "795", "245", "-14", "105", "61", "714", "81", "162", "#FF7A45",
            "PATCHED &#183; PRINTED &#183; PATCHED &#183; ", "PRINTED", "24", _day(c.printedAt)
        );
        if ((c.stage == SEEN || c.stage == DELIVERED) && c.seen > 0) {
            out = string.concat(
                out,
                _stamp(
                    "b", "820", "500", "11", "95", "51", "749", "71", "142", "#C9BCFF",
                    string.concat(_upper(c.eventStr), " &#183; SEEN &#183; "), "SEEN", "32", _day(c.seenAt)
                )
            );
        }
    }

    /// @dev A round passport stamp with text on its rim. All positions are fixed, so they arrive as ready strings.
    function _stamp(
        string memory k,
        string memory cx,
        string memory cy,
        string memory rot,
        string memory r,
        string memory rInner,
        string memory pathStart,
        string memory rr,
        string memory rrDouble,
        string memory color,
        string memory rim,
        string memory word,
        string memory wordSize,
        string memory sub
    ) private pure returns (string memory) {
        return string.concat(
            '<g transform="rotate(',
            rot,
            " ",
            cx,
            " ",
            cy,
            ')" opacity=".92"><circle cx="',
            cx,
            '" cy="',
            cy,
            '" r="',
            r,
            '" fill="#000" fill-opacity=".22" stroke="',
            color,
            '" stroke-width="7"/><circle cx="',
            cx,
            '" cy="',
            cy,
            '" r="',
            rInner,
            '" fill="none" stroke="',
            color,
            '" stroke-width="2.5"/>',
            _stampText(k, cx, cy, pathStart, rr, rrDouble, color, rim, word, wordSize, sub)
        );
    }

    function _stampText(
        string memory k,
        string memory cx,
        string memory cy,
        string memory pathStart,
        string memory rr,
        string memory rrDouble,
        string memory color,
        string memory rim,
        string memory word,
        string memory wordSize,
        string memory sub
    ) private pure returns (string memory) {
        uint256 y = _toUint(cy);
        return string.concat(
            '<path id="rim-',
            k,
            '" d="M',
            pathStart,
            " ",
            cy,
            " a",
            rr,
            " ",
            rr,
            " 0 1 1 ",
            rrDouble,
            " 0 a",
            rr,
            " ",
            rr,
            " 0 1 1 -",
            rrDouble,
            _rim(k, color, rim),
            _stampWords(cx, y, color, word, wordSize, sub)
        );
    }

    function _rim(string memory k, string memory color, string memory rim) private pure returns (string memory) {
        return string.concat(
            ' 0" fill="none"/><text font-family="',
            MONO,
            '" font-weight="600" font-size="15" letter-spacing="2" fill="',
            color,
            '"><textPath href="#rim-',
            k,
            '" startOffset="2%">',
            rim,
            "</textPath></text>"
        );
    }

    function _stampWords(
        string memory cx,
        uint256 y,
        string memory color,
        string memory word,
        string memory wordSize,
        string memory sub
    ) private pure returns (string memory) {
        return string.concat(
            '<text x="',
            cx,
            '" y="',
            (y + 6).toString(),
            '" text-anchor="middle" font-family="',
            DISPLAY,
            '" font-weight="800" font-size="',
            wordSize,
            '" fill="',
            color,
            '">',
            word,
            '</text><text x="',
            cx,
            '" y="',
            (y + 30).toString(),
            '" text-anchor="middle" font-family="',
            MONO,
            '" font-weight="600" font-size="16" fill="',
            color,
            '">',
            sub,
            "</text></g>"
        );
    }

    /// @dev The big stamp or tape over the whole card: DELIVERED, REFUNDED $x or PROOF DISPUTED.
    function _banner(PatchCard memory c) private pure returns (string memory) {
        if (c.stage == DELIVERED) {
            return string.concat(
                '<g transform="rotate(-10 640 680)"><rect x="470" y="618" width="380" height="118" rx="14" fill="none" stroke="#FF5A1F" stroke-width="9"/><rect x="484" y="632" width="352" height="90" rx="8" fill="none" stroke="#FF5A1F" stroke-width="3"/><text x="660" y="696" text-anchor="middle" font-family="',
                DISPLAY,
                '" font-weight="800" font-size="56" letter-spacing="0.05em" fill="#FF5A1F">DELIVERED</text></g>'
            );
        }
        if (c.stage == REFUNDED) {
            return string.concat(
                '<g transform="rotate(-9 500 430)"><rect x="235" y="372" width="530" height="118" rx="14" fill="none" stroke="#F4EFE3" stroke-width="8"/><text x="500" y="452" text-anchor="middle" font-family="',
                DISPLAY,
                '" font-weight="800" font-size="54" fill="#F4EFE3">REFUNDED $',
                _usd(c.amount),
                "</text></g>"
            );
        }
        if (c.stage == DISPUTED) {
            bytes memory stripes;
            for (uint256 k; k < 28; ++k) {
                stripes = abi.encodePacked(
                    stripes, '<path d="M', Strings.toStringSigned(int256(k) * 44 - 60), ' 380 l24 0 -30 74 -24 0z"/>'
                );
            }
            return string.concat(
                '<g transform="rotate(-8 500 420)"><rect x="-60" y="380" width="1120" height="74" fill="#FFD400"/><g fill="#0B0B0C">',
                string(stripes),
                '</g><rect x="250" y="388" width="500" height="58" fill="#FFD400"/><text x="500" y="428" text-anchor="middle" font-family="',
                BODY,
                '" font-weight="600" font-size="30" letter-spacing="0.14em" fill="#0B0B0C">PROOF DISPUTED</text></g>'
            );
        }
        return "";
    }

    function _header(PatchCard memory c) private pure returns (string memory) {
        bool first = c.sponsorNo == 1;
        return string.concat(
            '<text x="64" y="118" font-family="',
            DISPLAY,
            '" font-weight="800" font-size="76" letter-spacing="-0.04em" fill="#F4EFE3">No.',
            _pad3(c.sponsorNo),
            '</text><text x="68" y="158" font-family="',
            MONO,
            '" font-weight="600" font-size="22" letter-spacing="2" fill="',
            first ? "#FFB08F" : "#F4EFE3",
            '" opacity="',
            first ? "1" : "0.8",
            '">',
            first ? "FIRST SPONSOR OF" : "SPONSOR OF",
            " @",
            _upper(c.creator),
            '</text><g transform="translate(872 64) rotate(-8 25 25) scale(1.5)"><rect x="6" y="6" width="31" height="31" rx="9" fill="#0B0B0C"/><rect x="3.5" y="3.5" width="31" height="31" rx="9" fill="#FF5A1F" stroke="#0B0B0C" stroke-width="2.4"/><rect x="7.8" y="7.8" width="22.4" height="22.4" rx="5.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 2.4"/><path d="M15.5 28V12.5h5.2a4.4 4.4 0 0 1 0 8.8h-5.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></g>'
        );
    }

    /// @dev The woven label: the facts on the left, the stage and four progress pills on the right.
    function _label(PatchCard memory c, uint256 tier) private pure returns (string memory) {
        string memory tierName = tier == 2 ? "GOLD" : tier == 1 ? "SILK" : "COTTON";
        return string.concat(
            '<rect x="52" y="800" width="896" height="150" rx="8" fill="#000" opacity=".3" transform="translate(0 8)"/><rect x="52" y="800" width="896" height="150" rx="8" fill="#F4EFE3"/><rect x="52" y="800" width="896" height="150" rx="8" fill="url(#satin)" opacity=".35"/><line x1="76" y1="812" x2="76" y2="938" stroke="#0B0B0C" stroke-opacity=".35" stroke-width="3" stroke-dasharray="7 6"/><line x1="924" y1="812" x2="924" y2="938" stroke="#0B0B0C" stroke-opacity=".35" stroke-width="3" stroke-dasharray="7 6"/><text x="100" y="862" font-family="',
            DISPLAY,
            '" font-weight="800" font-size="42" letter-spacing="-0.03em" fill="#0B0B0C">',
            c.label,
            '</text><text x="100" y="903" font-family="',
            MONO,
            '" font-weight="500" font-size="23" fill="#5F5B53">',
            c.eventStr,
            " &#183; $",
            _usd(c.amount),
            " USDC &#183; ",
            tierName,
            _labelRight(c)
        );
    }

    function _labelRight(PatchCard memory c) private pure returns (string memory) {
        (string memory word, string memory color, uint256 done) = _stageWord(c);
        bytes memory pills;
        for (uint256 k; k < 4; ++k) {
            pills = abi.encodePacked(
                pills,
                '<rect x="',
                (740 + k * 42).toString(),
                '" y="890" width="32" height="14" rx="7" fill="',
                k < done ? "#FF5A1F" : "#0B0B0C",
                '" fill-opacity="',
                k < done ? "1" : "0.15",
                '"/>'
            );
        }
        return string.concat(
            '</text><text x="100" y="932" font-family="',
            MONO,
            '" font-weight="500" font-size="19" fill="#5F5B53" opacity=".85">PATCHED ON MONAD &#183; #',
            c.listingId.toString(),
            "-",
            uint256(c.patchId).toString(),
            '</text><text x="900" y="862" text-anchor="end" font-family="',
            DISPLAY,
            '" font-weight="800" font-size="34" fill="',
            color,
            '">',
            word,
            "</text>",
            string(pills),
            "</svg>"
        );
    }

    function _stageWord(PatchCard memory c)
        internal
        pure
        returns (string memory word, string memory color, uint256 done)
    {
        color = "#E0430B";
        if (c.stage == WON) return ("WON", color, 1);
        if (c.stage == PRINTED) return ("PRINTED", color, 2);
        if (c.stage == SEEN) {
            return (
                string.concat("SEEN ", uint256(c.seen).toString(), "/", uint256(c.seenOf).toString()), color, 3
            );
        }
        if (c.stage == DELIVERED) return ("DELIVERED", color, 4);
        if (c.stage == REFUNDED) return ("REFUNDED", "#5F5B53", 0);
        return ("IN REVIEW", "#B42318", 2);
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

    function _upper(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i; i < b.length; ++i) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
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
        string memory who = string.concat(c.brand, " backed ", c.creator, " (sponsor No.", uint256(c.sponsorNo).toString(), "). ");
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
                string memory fabric = v.surface == PatchedMarket.Surface.Outfit
            ? "Denim"
            : v.surface == PatchedMarket.Surface.Car ? "Racing paint" : "Fleece";
        string memory thread = v.amount >= 1_000e6 ? "Gold" : v.amount >= 100e6 ? "Silk" : "Cotton";
        string[5] memory shapes = ["Rounded", "Round", "Shield", "Hexagon", "Scalloped"];
        return string.concat(
            _trait("Stage", _stageName(v.stage)),
            ",",
            _num("Sponsor #", c.sponsorNo),
            ",",
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
            _trait("Fabric", fabric),
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
