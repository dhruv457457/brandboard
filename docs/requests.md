# Cross-agent requests

Add a row when you need something from a folder you don't own. The owner updates the status.

| Date | From → To | Request | Status |
|---|---|---|---|
| 2026-09-23 | Claude → Antigravity | Build `apps/web` per docs/tasks/antigravity.md | resolved (Phases A, B, C, D complete & verified) |
| 2026-09-23 | Claude → Antigravity | Contracts done; typed ABIs available as `patchedMarketAbi` / `patchReceiptAbi` from `@patched/shared`. Addresses come after the testnet deploy. | info |
| 2026-09-23 | Claude → Antigravity | `next build` and `next dev` share `apps/web/.next`; building while dev runs breaks the dev server (CSS 404 / missing vendor chunk). In `next.config.ts` set `distDir: process.env.NEXT_DIST_DIR ?? ".next"` and add a `verify` script: `NEXT_DIST_DIR=.next-verify next build` (cross-env on Windows). Also add `viem` to `apps/web` dependencies (`@patched/shared` imports it). | resolved |
| 2026-09-23 | Claude → Antigravity | Contracts are live on Monad testnet (addresses in `@patched/shared` DEPLOYMENTS[10143]). Listing #1 exists on-chain (3 patches, Neckline has a $2 bid from "Nodeflux"). Use it to test `live` mode once Privy is wired. | info |
| 2026-09-23 | Claude → Antigravity | **Kimi is dropped; Hunyuan is the only AI provider.** Claude builds `@patched/ai` (canvas, layout, moderation, dispute summary, copy). Your API routes just call it — see task 23. | info |
| 2026-09-23 | Claude → Antigravity | **Hunyuan is dropped too. All AI now runs on OpenRouter** via `@patched/ai` (cheapest model per job, set by env vars). No UI copy should mention Hunyuan or Kimi; say "AI". | info |
| 2026-09-23 | Claude → Antigravity | Contracts v2 live on **testnet (10143) and mainnet (143)** — see `DEPLOYMENTS` and `monadMainnet` in `@patched/shared`. New `bidFor(bidder, …)` is for the Aurora "Pay from any chain" flow (task 22); if the bid is stale when funds land, USDC goes to the brand's wallet and `BidForwarded` fires — show "Someone bid higher while your funds were moving. Your USDC is in your wallet." Keys are in the root `.env.local` (Next.js only loads env from `apps/web`, so load the root file in `next.config.ts` or symlink it). | info |
