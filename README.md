# Patched

**Get patched. Get paid.**

Creators sell ad space on things people look at: their outfit at an event, their car for a few weeks, or their team's hoodie at a hackathon. They upload a photo, AI turns it into a clean canvas, and they mark **patches** (logo spots) on it. Brands **bid in USDC** for each patch in its own live auction. The money waits in an on-chain escrow on Monad and is paid to the creator step by step, only after they post proof that they showed up.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Contracts: [docs/contracts.md](docs/contracts.md)
- Design system: [docs/design-system.md](docs/design-system.md)
- Data model: [docs/data-model.md](docs/data-model.md)
- Agent guide: [AGENTS.md](AGENTS.md)

## Surfaces

| Surface | How it pays | Proof |
|---|---|---|
| Outfit | Per event (for example Token2049) | Print photo and ticket, then venue photos |
| Car | Per week, 1 to 8 weeks | A dated photo every week |
| Team hoodie | Per hackathon, split across the team | Team check-in, then stage or demo photos |

## Features

### For creators

- **AI canvas.** Upload a photo and AI turns the outfit, car or hoodie into a clean white canvas, with the background removed.
- **AI outfit looks.** AI suggests outfit styles from your photo and generates front and back model shots in the style you pick.
- **AI car views.** Upload one photo of your car and AI generates the other sides (front, left, right, back, roof), so brands can bid on every panel.
- **AI spot suggestions.** AI proposes where the patches should go. You can drag, resize and rename every spot yourself.
- **Your terms.** For each spot, set a starting price, a buy-now price and a tier (mini, prime or mega). Pick the event and the proof deadlines.
- **Stake.** You lock a small bond when you publish. It comes back when you deliver.
- **Editable sponsor page.** Edit your listing page in place: headline, intro, perks per spot, section titles, accent colour, and which sections are shown. The FAQ is editable too.
- **Share kit.** A poster maker with templates, a QR code and downloadable images. Every listing also gets its own link preview image for X and chats.
- **Creator studio.** Close bidding, see the winners, upload proof for each milestone and release your payments.
- **Dashboard.** Your listings, what needs your attention, your payouts, your delivery record and your balance.
- **Profile page.** Your public page at `/<handle>` shows your listings and your track record.

### For brands

- **One-tap bidding.** Tap a spot on the photo and a bubble shows the price, who leads and the last few bids. One button bids the minimum to take the lead. Quick chips add +$5, +$10 or buy it now.
- **Full bid sheet.** Enter a custom amount or buy the spot outright.
- **Auto-bid.** "Keep me on top up to $X." When you're outbid, Patched bids the next step for you within seconds, and never above your maximum. It shows "Paused" and tells you what to fix if your wallet runs out of USDC or of spending permission.
- **Sweep.** Pick several spots and bid on all of them with one signature. Either every bid lands or none do.
- **Instant refunds.** When you're outbid, your USDC comes straight back in the same transaction.
- **One-tap rebid.** The outbid toast has a "Bid $X" button that bids the new minimum in one tap.
- **Verified brand badge.** Link your work email. If its domain matches your website, your bids and patches show "Verified brand".
- **Brand profile.** Your brand name and logo appear on the patches you lead.
- **My bids.** Spots you lead, spots where you were outbid, your receipts, and resale.

### Live auctions

- Every spot is its own auction, with a starting price, a buy-now price and a minimum step of +5% (at least +$5).
- **Anti-snipe:** a bid in the last 5 minutes adds 5 minutes to the whole listing, and everyone on the page is told.
- Live updates within about 2 seconds: prices, leaders and patches move on screen as bids land.
- "N watching now" through Supabase Realtime presence.
- **Bidding war** labels when brands trade the lead, plus recent activity on each spot.
- A live activity feed on every listing, and a live ticker on the landing page.

### Escrow and trust

- **Paid only on proof.** Money is released in milestones (for example 40% after the print proof and 60% after the show-up proof), each only after proof is posted.
- **72-hour disputes.** Each patch holder can dispute a proof for their own patch within 72 hours. An admin settles it, and can split the payment between creator and brand.
- **No-shows are refunded.** If a creator misses a proof deadline, the unpaid escrow and the creator's stake go to the patch holders.
- **Creator record.** On-chain delivered and missed counts plus total earned, shown on every listing next to the stake and the payout plan.
- **Safe onboarding.** New creators have a spending cap until their first delivery, and listings are approved by an admin before bidding opens.
- **Receipt NFTs.** Winning a spot mints a receipt NFT whose image is drawn on-chain as SVG. The receipt *is* the spot: its holder gets refunds and dispute rights.
- **Resale.** A receipt can be listed, bought or delisted on Patched, with a 5% royalty to the creator. Receipts can't move outside the market, so the royalty always applies.
- **Fallback payouts.** If a payment to a wallet ever fails, the money waits in the contract and the owner withdraws it. The market can be paused in an emergency.

### Discovery and social

- **Explore board.** Live listings with search, surface filters, bid counts and a live activity feed.
- **Events.** `/events` lists every event, and `/e/<slug>` shows every listing for one event. Each listing links to its event.
- **Notifications.** A live bell and a full `/notifications` page for outbid, new bid, auto-bid placed or paused, won, listing live or rejected, bidding closed, proof posted, dispute opened, payment made, no-show refund and resale sold.

### Getting around

- **One "You" menu for everything that's yours:** balances, your latest listings with their tools, My bids, your page, notifications, settings, security, the network and (for admins) the admin console. On desktop it opens from the account chip; on phones it's the "You" tab.
- **Phone navigation:** a bottom bar (Explore, My bids, Create, Dashboard, You). Listing pages swap it for a sticky bid bar and quick-jump tabs.
- **Settings** (`/settings`): profile, brand (name, logo, website, verified badge), security (passkey, wallet export) and network, in one place.
- **Listing tools:** a creator's listing page, Manage screen and Share kit are tabs of one bar.
- **Testnet and mainnet:** each runs as its own site from the same code. A switch in the navbar and the "You" menu moves between them and keeps you on the same page where it exists; testnet shows a "test money only" banner.

### Admin

- Approve or reject listings. A rejected listing returns the creator's stake.
- Review proofs, fast-track milestones and settle disputes.
- Create events.

### Behind the scenes

- **Keeper.** A policy-limited Privy server wallet closes auctions when they end, releases payments after the review window, marks no-shows and runs auto-bids.
- **Indexer.** Syncs every contract event into Supabase: bids, patches, receipts, payouts and notifications. It's rate-limited when called from the app.
- **Server-side AI.** All AI runs on the server through OpenRouter, with the cheapest model that does each job.
- **Themes and motion.** Light and dark themes. Every animation respects reduced-motion settings.
- **USDC only.** No banks or fiat anywhere: wallets hold USDC, and a test run on mainnet uses a TestUSD token with a daily faucet.

## How Patched uses Privy

Privy does much more than sign-in here. Every row is live in the app and links to the code.

| Privy feature | What it does in Patched | Code |
|---|---|---|
| Login with X or email + embedded wallets | A brand or creator gets a self-custodial wallet in seconds, with no seed phrase and no extension. The X handle becomes the creator's page. | [PrivyAuthProvider.tsx](apps/web/src/components/providers/PrivyAuthProvider.tsx), [api/profile](apps/web/src/app/api/profile/route.ts) |
| Gas sponsorship | Bids, listings, proofs and disputes cost users no MON on testnet (`sponsor: true`); it's a setting per network. | [useTx.ts](apps/web/src/lib/market/useTx.ts), [useBid.ts](apps/web/src/lib/market/useBid.ts) |
| Silent typed-data signing | A bid is one USDC permit signature plus one transaction, with no separate approve step. | [useBid.ts](apps/web/src/lib/market/useBid.ts), [permit.ts](apps/web/src/lib/market/permit.ts) |
| Server wallet + policy (keeper) | A Privy server wallet closes auctions, releases milestone payouts and marks no-shows. Its policy allows only `closeBidding`, `release` and `markFailed` on our market, plus `execute` on the auto-bidder. Anything else is rejected with `policy_violation` (checked by a script). | [keeper.ts](apps/web/src/lib/server/keeper.ts), [privy-keeper-add-chain.mjs](apps/web/scripts/privy-keeper-add-chain.mjs), [privy-policy-check.mjs](apps/web/scripts/privy-policy-check.mjs) |
| Auto-bid on the policy-limited server wallet | "Keep me on top up to $X": when a brand is outbid, the keeper bids the next step for them within seconds. The contract caps every bid at the brand's max. | [useAutoBid.ts](apps/web/src/lib/market/useAutoBid.ts), [PatchAutoBidder.sol](contracts/src/PatchAutoBidder.sol) |
| One signature, sponsored gas: sweep | Our `PatchSweeper` contract places several bids at once; Privy signs the single permit and sponsors the gas, so bidding on many patches is one click. | [SweepPanel.tsx](apps/web/src/components/market/SweepPanel.tsx), [PatchSweeper.sol](contracts/src/PatchSweeper.sol) |
| Passkey MFA step-up | Bids, sweeps and auto-bid maximums over a threshold ask for a passkey (Face ID, Touch ID, Windows Hello) first. | [stepUp.ts](apps/web/src/lib/market/stepUp.ts), [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Linked accounts: verified brands | A brand links a work email (Privy one-time code). If the domain matches its website, its patches show "Verified brand". This stops impersonation. | [BrandVerify.tsx](apps/web/src/components/market/BrandVerify.tsx), [verify-brand route](apps/web/src/app/api/profile/verify-brand/route.ts) |
| Wallet export | "Your wallet is yours": export the embedded wallet's key to any wallet. | [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Server-side auth | Every API route verifies the Privy access token (JWKS) and reads the user's wallet and verified emails from Privy's API, never from the browser. | [auth.ts](apps/web/src/lib/server/auth.ts) |

Not used, and why:
- **Funding (card or bank on-ramps)** is left out on purpose: Patched has no banks or fiat, and wallets hold USDC only.
- **Session signers** aren't enabled on our Privy app, so auto-bid runs on the policy-limited server wallet instead.
- **Transaction webhooks** need Privy's Enterprise plan, so notifications come from our own indexer and Supabase Realtime.

## Contracts

| Contract | What it does |
|---|---|
| `PatchedMarket` | Listings, per-patch auctions with anti-snipe, permit bids, escrow, milestones, proofs, disputes, no-show refunds, creator stakes and records, events, resale with royalties |
| `PatchReceipt` | The receipt NFT for each won patch, with its image drawn on-chain and ERC-2981 royalties. It only moves through the market. |
| `PatchAutoBidder` | Holds each brand's auto-bid maximum and bids for them. It never goes above the maximum. |
| `PatchSweeper` | Bids on several patches in one transaction, all or nothing |
| `TestUSD` | A USDC-style test token with permit and a daily faucet, for the mainnet test run |

| Contract | Monad testnet | Monad mainnet (TestUSD run) |
|---|---|---|
| PatchedMarket | `0xd3808dE425493934f036f8E77ef5a4de332e9552` | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` |
| PatchReceipt (NFT) | `0x598Ea7C3Cf739Dbea1B809d5Cd0174818b680a8f` | `0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97` |
| PatchAutoBidder | `0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA` | `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` |
| PatchSweeper | `0x65f0e25e5D503FCc5549624D6f9B138b17A3054f` | `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba` |
| TestUSD (faucet token) | – | `0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f` |

All verified on Sourcify. Testnet uses Monad's native USDC. Details: [docs/contracts.md](docs/contracts.md).

## Tech stack

- **Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin v5.4, with unit, fuzz and invariant tests.
- **Web:** Next.js (App Router), React 19, Tailwind CSS v4, Motion, NumberFlow, viem, Privy.
- **Data:** Supabase (Postgres, Storage, Realtime), with our own indexer in `packages/indexer`.
- **AI:** OpenRouter, through `packages/ai`.
- **Chain:** Monad testnet (10143) and Monad mainnet (143). Chain values live in config.

```
brandboard/
├─ contracts/         Foundry contracts and tests
├─ packages/shared/   ABIs, types, chain config and addresses
├─ packages/ai/       OpenRouter client and prompts
├─ packages/indexer/  Chain events → Supabase
├─ apps/web/          Next.js app
└─ supabase/          Database migrations
```

## Setup

```bash
pnpm install
pnpm contracts:setup
pnpm contracts:test
cp .env.example .env.local   # then fill in the values
pnpm web:dev                 # the app on Monad testnet
pnpm web:dev:mainnet         # the app on Monad mainnet, http://localhost:3200
```
