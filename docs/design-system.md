# Design system

The approved clickable prototype is the visual source of truth:
https://claude.ai/artifact/PwWdS8brgGnyUne3Xiww95 (private link, owned by the project lead; ask them for access or a screenshot export). A copy of its HTML lives at `docs/prototype/patched-prototype.html` — open it in a browser and copy structure, SVGs and CSS values from it.

## Feel

A clean white "patch studio": bold black outlines, hard offset shadows, stitched (dashed) borders on anything that is a patch, pastel patch colors, one hot accent. Fun and social, not a DeFi dashboard. Light by default, dark mode via a toggle in the nav.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `--paper` (page) | `#FAFAF7` | `#121211` |
| `--card` | `#FFFFFF` | `#1B1B19` |
| `--soft` (subtle fills, dividers) | `#F0EEE7` | `#272620` |
| `--ink` (text, borders) | `#0B0B0C` | `#F2F0E9` |
| `--muted` | `#5F5B53` | `#A9A498` |
| `--accent` (Patch Orange) | `#FF5A1F` | `#FF6B35` |
| `--accent-text` (accent used as text) | `#E0430B` | `#FF7A45` |
| `--accent-soft` | `#FFE3D6` | `#3A2016` |
| `--on-accent` | `#FFFFFF` | `#140800` |
| `--green` / `--green-soft` | `#15803D` / `#DCF5E4` | `#4ADE80` / `#15291C` |
| `--monad` (chain chip only) | `#836EF9` | `#836EF9` |
| `--shadow` (hard shadow color) | `#0B0B0C` | `#000000` |
| `--stage` (behind drawings) | `#F1EFE8` | `#211F1B` |
| Patch pastels `--p1..--p5` | mint `#BDEBD3`, lilac `#D9CCFF`, butter `#FFE58F`, sky `#BFE3FF`, pink `#FFC9DA` | same |

Patch text is always `#0B0B0C` on pastel, in both themes. Surfaces (dress, car, hoodie) stay white in dark mode.

## Type

| Role | Font (Google Fonts) |
|---|---|
| Display / headings / logo wordmark / brand names on patches | Bricolage Grotesque 800, letter-spacing -0.02em to -0.05em |
| Body / UI | Geist 400–700 |
| Prices, timers, addresses, counts | Geist Mono 500–600, `tabular-nums` |
| Rare handwritten notes | Caveat 700 (one or two per page at most) |

Use `next/font/google`.

## Shape and elevation

- Cards: `2px solid var(--ink)`, radius 18px, `box-shadow: 4px 4px 0 var(--shadow)`.
- Buttons: 2px border, radius 14px, `3px 3px 0` shadow; hover moves -1px/-1px and grows the shadow to 4px; active moves +2px and shrinks it to 1px. Primary = orange fill.
- Chips/pills: 1.5px border, fully rounded, 12px text.
- Filled patch: pastel background + soft top-left highlight, 1.5px ink border, inner dashed stitch ring 3px inside, subtle drop shadow, slight rotation (−3° to 3°).
- Open patch: dashed 2px `--accent-text` border, 10% accent tint, "OPEN" + "$60+".

## Logo

Orange rounded square (the patch) rotated −8°, 2.4px ink border, hard ink shadow offset, white dashed stitch ring inside, and a white "p" drawn as a single thread stroke. Wordmark "patched" in Bricolage Grotesque 800, lowercase, tight tracking. SVG is in the prototype (`LOGO` constant) — make it `components/brand/Logo.tsx`.

## Icons

lucide-react only, 2px stroke. **No emojis anywhere.**

## Motion (use `motion` + CSS; all disabled under `prefers-reduced-motion`)

| Moment | Spec |
|---|---|
| Patch appears | drop from −60px, rotate −16° → its own rotation, scale 1.4 → 1; spring (stiffness ~260, damping ~18); stagger 80–160ms |
| Stitch sewing | the dashed ring is revealed by a conic mask sweeping 0→360° over 0.9s after the drop (`@property --sw`) |
| Someone bids | expanding ring from the patch (scale 1→1.5, fade, 1.1s), patch bump (scale 1.14 at 40%), brand name slides up, price rolls with NumberFlow |
| You got outbid | shake (±5px, ±4°, 0.5s) + toast with "Bid again" action |
| Buy-now | "SOLD" stamp: scale 2.4→1, rotate −30°→−12° |
| Anti-snipe | countdown turns orange and shows "+5:00" |
| Bid placed | confetti made of small pastel patches from the patch center |
| Page change | View Transitions: old fades up 6px, new rises 10px |
| Theme toggle | circular reveal from the toggle button (View Transitions + clip-path) |
| Hover patch | straighten to 0°, scale 1.07, soft shadow |
| Hero headline | orange dashed "thread" underline draws in |

## Surface drawings

Realistic SVG illustrations (gradients, soft fold shadows, floor shadow) for the three surfaces. Take them from the prototype (`SURF.outfit/car/hoodie`, plus the shared `<defs>` gradients). Patch positions are percentages of the drawing's box (x, y, w, h), so the patch layer is an absolutely positioned div over the SVG with the same aspect ratio:

| Surface | viewBox |
|---|---|
| Outfit | 300 × 520 |
| Car | 520 × 260 |
| Team hoodie | 420 × 460 |
