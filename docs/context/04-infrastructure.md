# 04 · How it runs

## Architecture

```
 Browser (Next.js app, React 19)                      Monad (testnet 10143 / mainnet 143)
 ├─ Privy: sign-in, embedded wallet, signing ───────► PatchedMarket, Receipt, Renderer,
 ├─ reads Supabase (indexed data, Realtime)           AutoBidder, Sweeper, Spotter
 └─ calls /api routes                                         │ events
                                                              ▼
 Next.js server routes (Vercel) ◄──── /api/keeper/run ◄─ Supabase pg_cron (every minute)
 ├─ verify the Privy token on every call                      │
 ├─ indexer: chain events ─► Supabase tables ◄────────────────┘
 ├─ keeper: Privy server wallets with policies ─► Monad
 ├─ AI: OpenRouter (packages/ai)
 ├─ IPFS: QuickNode (proof photos, proof records, spotted photos)
 └─ X lookups: X API or FxTwitter
```

| Layer | What | Where |
|---|---|---|
| Web | Next.js App Router, React 19, Tailwind v4, motion, NumberFlow, lucide, viem, Privy, TanStack Query | `apps/web` |
| Shared | ABIs, types, chain config, addresses: the only bridge between contracts and the app | `packages/shared` |
| Indexer | Reads market, auto-bidder and spotter logs into Supabase; writes notifications | `packages/indexer` |
| AI | OpenRouter client and prompts (canvas, layout, styles, model shots, car views, event covers) | `packages/ai` |
| Database | Supabase: Postgres, Storage (`canvases` bucket), Realtime (notifications, presence, live listing) | `supabase/migrations` |
| Contracts | Foundry | `contracts/` |

## The indexer

- `syncChain()` in `packages/indexer/src/index.ts`:
  - reads logs from the last saved block, up to 20,000 blocks at a time;
  - writes `chain_events`, `listings`, `patches`, `bids`, `receipts`, `milestones`, `payouts`, `spots`, `listing_payees`, `notifications`;
  - refreshes a listing from the contract when it changes.
- Notifications are unique per (event, wallet, kind), so replaying a block range is safe.
- **It runs:**
  - from the app, after a transaction (`/api/indexer/sync`, rate-limited);
  - inside every keeper tick;
  - by hand: `pnpm indexer -- --chain 143`.
- **Mainnet:** the cursor for chain 143 was reset to block 111660652, so it starts at the new market. Make sure the mainnet site's keeper tick is running so it stays in sync.

## The keeper

- `/api/keeper/run` (secret `KEEPER_SECRET`) calls `runKeeper()` (`apps/web/src/lib/server/keeper.ts`):
  1. catches up the indexer;
  2. approves pending listings;
  3. closes ended auctions;
  4. releases payouts whose review is over;
  5. marks no-shows;
  6. answers auto-bids (signer and contract);
  7. runs campaigns and X offers.
- Every send is from a Privy server wallet with a policy and an idempotency key (see [02-privy.md](02-privy.md#5-the-keeper-a-server-wallet-with-a-policy)).
- **Timer:** Vercel can't keep a timer running, so Supabase `pg_cron` posts to `/api/keeper/run` every minute (migration `0013_keeper_cron.sql`). The site URL and the secret are in Supabase Vault, set by `node scripts/keeper-cron.mjs <site url>`.
- Locally, `KEEPER_AUTORUN` runs it in the dev server.

## Storage and IPFS

- **Photos and canvases:** Supabase Storage, bucket `canvases` (`lib/server/storeImage.ts`, `/api/uploads`).
- **Proofs and spotted photos:** pinned to IPFS through **QuickNode IPFS** (`QUICKNODE_IPFS_API_KEY`, `lib/server/ipfs.ts`). Served from a dedicated gateway (`NEXT_PUBLIC_IPFS_GATEWAY`). On-chain: `ipfs://` links plus `keccak256` of the record.
- **Listing metadata:** JSON saved off-chain and served at `/api/listings/metadata/<hash>`. Its keccak hash is on-chain.
- **The editable page layer** (`listing_pages`, migration 0009) holds what a creator can change after publishing: headline, intro, perks, colours, background (`stage` = {color, image}).

## AI (OpenRouter only, server side)

| Job | Route | Model (env, default) | Daily limit per user |
|---|---|---|---|
| White canvas from a photo | `/api/ai/canvas` | `AI_IMAGE_MODEL` `google/gemini-3.1-flash-lite-image`, fallback `AI_IMAGE_FALLBACK_MODEL` `google/gemini-2.5-flash-image` | 6 |
| Spot layout | `/api/ai/layout` | `AI_VISION_MODEL` `google/gemini-2.5-flash-lite` | 40 |
| Outfit styles | `/api/ai/styles` | vision model | 10 |
| Model shots (front, back) | `/api/ai/model-shot` | image model | 3 front, 6 back |
| Car views | `/api/ai/car-view` | vision to describe, image model to draw | 16 |
| Event covers | scripts | image model | n/a |

The cheapest model that does each job wins. AI is never called from the browser (`packages/ai/src/index.ts`).

## X: lookups, share posts and proof posts

- **Lookups** (`lib/server/xLookup.ts`): handle → numeric id, name, avatar, followers.
  - Uses the **official X API** (`api.x.com/2/users/by/username`) when `X_BEARER_TOKEN` is set; otherwise the free **FxTwitter** API.
  - Used by "Patch anyone on X" (`/api/offers/lookup`) and profile reach.
- **Sign-in data:** X name, picture and follower count come from the account Privy links (refreshed at most daily).
- **Sharing:** every share button opens an X intent with the text and link pre-filled. We never post on someone's behalf, so no paid X write access is needed. The buttons:
  - listing share kit (`app/share/[listingId]/ShareKit.tsx`);
  - patch NFT (`components/nft/ShareRow.tsx`);
  - offers (`app/offers/[id]/OfferView.tsx`);
  - Patchwork "Post my spot" (`components/graph/Patchwork.tsx`);
  - contest entry (`components/contest/EntryForm.tsx`).
- **Link previews (images made on the server):**
  - listing (`app/[handle]/[listingId]/opengraph-image.tsx`, `lib/server/poster.tsx`);
  - poster (`/share/<listingId>/poster`);
  - patch NFT (`/patch/<id>/card.png`, 1000×1000);
  - Patchwork "where I am" card (`/share/patchwork/<event>/<wallet>/card.png`, 1200×630).
- **Proof posts:** the creator's X post tagging the brand is part of each proof (`proof_files.x_url`, migration 0012).
- **Not built:** automatic X posting and a reach bonus paid from post metrics. Both need a paid X API tier and a new contract (see [07-gtm-and-future.md](07-gtm-and-future.md)).

## Creator subdomains and share links

- `HANDLE_DOMAIN=monad.patched.world`. Then `<handle>.monad.patched.world` serves `/<handle>`, and `<handle>.monad.patched.world/16` serves `/<handle>/16`. The address in the bar stays short (`apps/web/src/middleware.ts`, `resolve()`).
- **Rules:**
  - On a creator's subdomain, links to their own listings go to the short form (`/16`).
  - Another creator's page goes to their own subdomain.
  - Everything else (sign-in, Studio, Explore) lives on the main domain. `useAppHref` makes "Open the app", the logo and sign-in point there.
  - Handles with dots or underscores can't be subdomains and stay on the main site.
  - Reserved words can't be handles (`lib/handles.ts`, `RESERVED_HANDLES`, includes `contest`).
- Sign-in on a subdomain goes to `monad.patched.world/welcome?next=<subdomain url>` and comes back.
- **Copy link** on a listing copies the creator's own address (`handle.monad.patched.world/16`).
- **Needs:** a wildcard DNS record and a wildcard domain on Vercel for `*.monad.patched.world`. For one sign-in across subdomains, Privy cookies must be set on the parent domain.

## One domain, two chains

**Goal (the user's call):** the same site, `monad.patched.world`, for testnet and mainnet; only the chain changes.

**How:**
1. Two Vercel projects build the same code from `main`:
   - `brandboard-web`: testnet, the public domain.
   - `brandboard-mainnet`: `NEXT_PUBLIC_CHAIN_ID=143`, a hidden URL `https://brandboard-mainnet.vercel.app`, gas sponsorship off, its own approver wallet.
2. The network switch sets a cookie `patched-chain=143` on `monad.patched.world` and reloads (`components/navigation/NetworkSwitch.tsx`, `switchChain()`, enabled by `NEXT_PUBLIC_CHAIN_COOKIE=true`).
3. In the testnet project, `middleware.ts` sees the cookie and **rewrites every request** (pages, `/_next`, `/api`) to `MAINNET_ORIGIN`. The visitor stays on `monad.patched.world`.
4. Proxied pages get `cache-control: private, no-cache`, so shared caches don't mix the two sites. Content-hashed build files stay cacheable.
5. Going to mainnet first shows a modal: "Mainnet uses real USDC".

Cost: every push to `main` makes two deployments.

## Vercel

| Project | Chain | Domain | Notes |
|---|---|---|---|
| `brandboard-web` | testnet | `monad.patched.world` and `*.monad.patched.world` | `MAINNET_ORIGIN`, `NEXT_PUBLIC_CHAIN_COOKIE=true`, `HANDLE_DOMAIN` |
| `brandboard-mainnet` | mainnet | `brandboard-mainnet.vercel.app` (reached through the proxy) | env copied from `.env.local` plus overrides |

- **Vercel Analytics** is on (`@vercel/analytics/next` in `app/layout.tsx`).
- **Storage:** Vercel's storage graph is cumulative usage, not current size. Old deployments were deleted (two kept) and retention set, which lowers new usage.
- The Vercel CLI is installed (`vercel`). In Git Bash, use `MSYS_NO_PATHCONV=1` for `vercel api` paths. Sensitive env vars can't be read back.

## Environment variables

All live in `.env.local` (never committed); `.env.example` lists each with a comment.

| Group | Variables |
|---|---|
| Chain | `NEXT_PUBLIC_CHAIN_ID`, `MONAD_TESTNET_RPC_URL`, `MONAD_MAINNET_RPC_URL` (QuickNode), `DEPLOYER_PRIVATE_KEY` |
| Sites | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TESTNET_URL`, `NEXT_PUBLIC_MAINNET_URL`, `MAINNET_ORIGIN`, `NEXT_PUBLIC_CHAIN_COOKIE`, `HANDLE_DOMAIN`, `NEXT_PUBLIC_HANDLE_DOMAIN`, `SITE_PATCH_URL` |
| Privy | `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_JWKS_URL`, `PRIVY_AUTHORIZATION_KEY_ID`, `PRIVY_AUTHORIZATION_PRIVATE_KEY`, `NEXT_PUBLIC_GAS_SPONSORED`, `NEXT_PUBLIC_STEP_UP_USD` |
| Keeper | `PRIVY_SERVER_WALLET_ID`, `PRIVY_KEEPER_POLICY_ID`, `KEEPER_ADDRESS`, `KEEPER_USES_AUTH_KEY`, `KEEPER_GAS_SPONSORED`, `KEEPER_SECRET`, `KEEPER_AUTORUN` |
| Auto-bid signer | `PRIVY_SIGNER_QUORUM_ID`, `NEXT_PUBLIC_PRIVY_SIGNER_ID` |
| Admin wallets | `OPEN_ADMIN`, `NEXT_PUBLIC_OPEN_ADMIN`, `PRIVY_OPEN_ADMIN_WALLET_ID`, `OPEN_ADMIN_ADDRESS`, `PRIVY_APPROVER_WALLET_ID`, `APPROVER_ADDRESS` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL` |
| AI | `OPENROUTER_API_KEY`, `AI_IMAGE_MODEL`, `AI_IMAGE_FALLBACK_MODEL`, `AI_VISION_MODEL` |
| IPFS | `QUICKNODE_IPFS_API_KEY`, `NEXT_PUBLIC_IPFS_GATEWAY` |
| X | `X_BEARER_TOKEN` (optional) |
| Demo and tests | `DEMO_LOGIN`, `DEMO_LOGIN_EMAIL`, `DEMO_LOGIN_CODE`, `E2E_TEST_EMAIL`, `E2E_TEST_CODE`, `E2E_BASE_URL` |
| Contest | `CONTEST_ADMINS`, `CONTEST_ADMIN_WALLETS` |

## Protection

- **Auth:** every acting route verifies the Privy token (`lib/server/auth.ts`).
- **Rate limits** (`lib/server/rateLimit.ts`, per user per day, in memory):

  | Action | Limit |
  |---|---|
  | comments | 60 |
  | reactions | 500 |
  | follows | 300 |
  | spotted posts | 20 |
  | reports | 30 |
  | campaigns | 5 |
  | offers | 10 |
  | X lookups | 200 |
  | auto-bid changes | 200 |
  | client error reports | 30 per IP |

  AI limits are in the AI table above.
- **Moderation:** reports, 3 distinct reporters hide a post at once, an admin moderation queue (`lib/server/moderation.ts`, migration 0025). Hiding a listing only takes it out of the app; the contract is untouched.
- **Client errors:** browsers report crashes to `/api/client-error` (table from migration 0023) so we see production errors.
- **RLS:** private tables (`reports`, `contest_entries`, `contest_signups`, `contest_funnel`) have RLS on and no public policies; only the server key reads them.

## Database migrations (`supabase/migrations`, apply with `pnpm db:migrate`)

| # | What |
|---|---|
| 0001 | init: profiles, listings, patches, bids, receipts, milestones, payouts, chain events, indexer state |
| 0002, 0004–0006 | brand profiles, patch brands, verified brands |
| 0003 | auto-bid read |
| 0007 | notifications |
| 0008–0010 | listing cards, editable listing pages, event details |
| 0011, 0016, 0019 | brand campaigns, campaign budget aggregation, one action at a time |
| 0012 | proof X post |
| 0013 | keeper cron |
| 0014 | proof approvals |
| 0015, 0024 | signer auto-bids, pending raises |
| 0017, 0018 | X offers, profile X details |
| 0020–0022 | follows, spotted, reactions |
| 0023 | client errors |
| 0025 | moderation |
| 0026 | Patchwork (on-chain spots, listing payees) |
| 0027 | comments |
| 0028 | contest entries; listing reactions |
| 0029 | contest sign-ups and funnel |

Data model notes: [../data-model.md](../data-model.md).

## Testing

- `pnpm contracts:test`: 134 contract tests.
- `npx tsc --noEmit -p apps/web`: types.
- `pnpm --filter web test:ui`: Playwright on the dev server, laptop and phone sizes:
  - every page loads with no sideways scroll, broken images or unnamed buttons;
  - flows (sign-in, Studio, campaign builder, listing, event, Explore, profile tabs);
  - signed-in tests with the Privy test account.
- **Privy proofs:** `apps/web/scripts/privy-policy-check.mjs`, `privy-signer-check.mts`, `privy-campaign-budget-check.mts`, `privy-x-offer-check.mts`.
- **Local servers:** `pnpm web:dev` (testnet, port 3000), `pnpm web:dev:mainnet` (port 3200). Privy only signs in on these two ports.
