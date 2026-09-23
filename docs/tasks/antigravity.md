# Antigravity — frontend work plan

You own **`apps/web`**. Read `AGENTS.md`, `docs/SPEC.md`, `docs/design-system.md`, `docs/data-model.md` and `docs/contracts.md` before starting. The prototype HTML in `docs/prototype/patched-prototype.html` is the visual reference — match it, then make it production quality.

Claude is building the contracts and `packages/shared` in parallel. Until they land, work in **mock mode** (`NEXT_PUBLIC_DATA_MODE=mock`). Do not edit `contracts/`, `packages/shared/` or `services/`. Put anything you need from Claude in `docs/requests.md`.

Work top to bottom. Each task ends with the app building (`pnpm --filter web build`) and no TypeScript errors.

## A. Foundation

1. **Scaffold** `apps/web`: Next.js (App Router, TypeScript strict, `src/` dir), Tailwind v4, ESLint. Package name `web`. Add root scripts `web:dev` / `web:build` if missing (root `package.json` is shared — only add scripts).
2. **Theme**: CSS variables from design-system.md on `:root` and `[data-theme="dark"]`; light by default; theme toggle stored in `localStorage`, circular reveal with View Transitions. Fonts via `next/font/google` (Bricolage Grotesque, Geist, Geist Mono, Caveat).
3. **UI kit** in `src/components/ui`: Button (primary / default / ghost / small), Card, Chip, Pill (top / outbid / won / waiting), Seg (segmented control), Input, AmountInput (USDC), Toast (sonner, styled like the prototype), Sheet (right drawer on desktop, bottom sheet on mobile), Tooltip, Skeleton. No emojis; lucide icons.
4. **Brand**: `Logo` (mark + wordmark) from the prototype SVG; favicon + OG default image.
5. **Surfaces**: `components/surface/SurfaceFigure.tsx` renders the outfit / car / hoodie SVG (from the prototype, with the shared gradients as a single `<SurfaceDefs/>` in the root layout) plus an absolutely positioned patch layer. Props: `surface`, `patches`, `mode: 'static' | 'interactive' | 'editable'`, `selectedId`, `onSelect`.
6. **Patch** component: filled / open / bought / preview / focus states; stitch-sewing and drop animations; ping ring, bump, shake, SOLD stamp as imperative handles (`ref.ping()`, `ref.bump()`...). Font sizes use container query units so text fits any patch size.

## B. Data and chain layer (mock first)

7. `src/lib/data/` — typed functions per data-model.md: `getListings(filter)`, `getListing(id)`, `getPatches(id)`, `getBids(id)`, `getProfile(handle)`, `getEvents()`, `getBrandDashboard(wallet)`, `getAdminQueue()`. Fixtures in `fixtures.ts` (Mira outfit, Samir car, Team Rektangle hoodie + 3 extra cards — copy values from the prototype).
8. `src/lib/live/` — a small event bus + `useListingLive(listingId)` hook that yields `BidPlaced`-shaped events. Mock implementation: random brands bid every 4.5–8.5s. Live implementation later: Supabase Realtime on `bids`.
9. `src/lib/chain/` — hooks with the final signatures but mock bodies: `useBid()`, `useBuyNow()`, `useCreateListing()`, `useSubmitProof()`, `useDispute()`, `useResale()`, `useApproveListing()`... Each exposes `status: 'idle' | 'signing' | 'confirming' | 'done' | 'error'` and maps contract custom errors (contracts.md) to friendly messages.
10. `src/lib/format.ts` — `formatUsdc(bigint)`, `parseUsdc(string)`, countdown formatting, short address.

## C. Pages (see SPEC.md for routes and content)

11. **Nav by role** (visitor / creator / brand / admin) + a dev-only "Preview as" switch (hidden in production) — matches the prototype.
12. **Landing** `/`.
13. **Explore** `/explore` with the surface filter.
14. **Listing** `/[handle]/[listingId]` — the most important screen: figure, selected-patch panel, KPIs with countdown (orange + "+5:00" on anti-snipe), live feed, bid sheet with live logo preview, buy-now, outbid toast. All live animations wired to `useListingLive`.
15. **Creator page** `/[handle]` with banner color customization (owner only).
16. **Studio** `/studio`: event → surface → photo upload → AI canvas (call `POST /api/ai/canvas`, mock returns the white drawing after ~2s) → patch editor (drag, resize, rename, prices; "AI suggest layout" calls `POST /api/ai/layout`) → milestone plan (defaults per surface) → bond → publish.
17. **Creator listing dashboard** `/studio/[listingId]`: milestone bars, proof upload, payouts, team split editor.
18. **Brand dashboard** `/bids`: tiles, bids table, receipts (NFT cards) with Resell, proof review with dispute button, auto-bid card.
19. **Admin** `/admin`: events form + table, moderation queue (shows the AI verdict), proof review, disputes (shows the AI summary), stats.
20. **Share kit** `/share/[listingId]` + dynamic OG image route `app/[handle]/[listingId]/opengraph-image.tsx` (next/og) that draws the listing card.

## D. Integrations (after A–C; coordinate through docs/requests.md)

21. **Privy**: `PrivyProvider` with X login, embedded wallets on login, Monad testnet as default chain, gas sponsorship on; batched approve+bid; "Pay with card" onramp; auto-bid UI that creates a session signer.
22. **Aurora Intents**: "Pay from another chain" option in the bid sheet.
23. **API routes** in `apps/web/src/app/api/`: `ai/canvas`, `ai/layout`, `ai/moderate`, `ai/dispute-summary`, `ai/copy`, `metadata`. Each route only validates input and calls the matching function from `@patched/ai` (Claude builds that package on OpenRouter). Keys only from server env vars.
24. Switch `NEXT_PUBLIC_DATA_MODE=live` once Claude publishes addresses in `@patched/shared`.

## Definition of done for every page

- Matches the prototype's look in light and dark mode.
- Works at 375px wide with no horizontal scroll.
- Keyboard focus visible; interactive things are buttons/links.
- Loading skeletons and empty states exist.
- No emojis, no lorem ipsum.
