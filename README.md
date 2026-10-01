# Patched

**Get patched. Get paid.**

Creators sell ad space on things people look at: their outfit at an event, their car for a few weeks, or their team's hoodie at a hackathon. They upload a photo, AI turns it into a clean canvas, and they mark **patches** (logo spots) on it. Brands **bid in USDC** for each patch in its own live auction. The money waits in an on-chain escrow on Monad and is paid to the creator step by step, only after they post proof that they showed up.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Contracts: [docs/contracts.md](docs/contracts.md)
- Design system: [docs/design-system.md](docs/design-system.md)
- Data model: [docs/data-model.md](docs/data-model.md)
- Agent guide: [AGENTS.md](AGENTS.md)

## Try it

1. Open the site and press **Sign in**.
2. Press **Try the demo account** at the top of the sign-in card. One tap signs you in to a shared Privy test account
   with its own embedded wallet: no email, no seed phrase, no extension. (It only appears on test money: testnet, or
   mainnet on TestUSD.)
3. Open an event, tap a spot and bid. There is no wallet pop-up and no gas prompt: Privy signs the permit and
   sponsors the gas. Big bids (over `NEXT_PUBLIC_STEP_UP_USD`, $1,000 by default) ask for a passkey first.
4. On a spot, turn on **Auto-bid**: Privy adds Patched as a signer limited by a policy, and Settings → Security has a
   one-tap Revoke.
5. **Admin** (wallet menu → Admin) lets anyone approve listings and create events during judging, through a
   policy-limited Privy server wallet. Nobody can review their own listing or settle their own dispute.

Test USDC on testnet: Circle's faucet, token `0x534b2f3A21130d7a60830c2Df862319e593943A3`.

## Surfaces

| Surface | What | Proof |
|---|---|---|
| Outfit | A person at an event (for example Token2049) | Print photo, venue photos, an X post |
| Vehicle | A car, van or bus for 1 to 3 event days, parked at the venue or looping it | Dated, located photos each day, an X post |
| Team hoodie | A team at a hackathon, paid out across the team | Team check-in, stage or demo photos, an X post |
| Your own idea | Anything people will see at the event: a laptop lid on stage, a booth wall, a board | Photos with the logo in view, an X post |

## Features

### For creators

- **AI canvas.** Upload a photo and AI turns the outfit, car or hoodie into a clean white canvas, with the background removed.
- **AI outfit looks.** AI suggests outfit styles from your photo and generates front and back model shots in the style you pick.
- **AI car views.** Upload one photo of your car and AI generates the other sides (front, left, right, back, roof), so brands can bid on every panel.
- **AI spot suggestions.** AI proposes where the patches should go. You can drag, resize and rename every spot yourself.
- **Your terms.** For each spot, set a starting price, a buy-now price and a tier (mini, prime or mega). Pick the event.
- **Your deal.** Choose how you get paid: part before the event for printing (10% to 50%), all after, per event day, or a custom split of up to 4 steps. A live payout bar shows the split and the proof date of each step. Pick what every brand gets (photos, parked hours, route check-ins, an X post); brands see it before they bid.
- **Stake.** You lock a small bond when you publish. It comes back when you deliver.
- **Editable sponsor page.** Edit your listing page in place: headline, intro, perks per spot, section titles, accent colour, and which sections are shown. The FAQ is editable too.
- **Share kit.** A poster maker with templates, a QR code and downloadable images. Every listing also gets its own link preview image for X and chats.
- **Creator studio.** Close bidding, see the winners, upload proof for each milestone and release your payments.
- **One profile.** `/<handle>` shows your listings, the spots you sponsor and your record. As the owner you also get your Earnings (what needs doing, payouts) and Bids tabs there, so there's no separate dashboard to find.

### For brands

- **One-tap bidding.** Tap a spot on the photo and a bubble shows the price, who leads and the last few bids. One button bids the minimum to take the lead. Quick chips add +$5, +$10 or buy it now.
- **Full bid sheet.** Enter a custom amount or buy the spot outright.
- **Auto-bid.** "Keep me on top up to $X." When you're outbid, Patched bids the next step for you within seconds, and never above your maximum. It shows "Paused" and tells you what to fix if your wallet runs out of USDC or of spending permission.
- **Sweep.** Pick several spots and bid on all of them with one signature. Either every bid lands or none do.
- **Instant refunds.** When you're outbid, your USDC comes straight back in the same transaction.
- **One-tap rebid.** The outbid toast has a "Bid $X" button that bids the new minimum in one tap.
- **Verified brand badge.** Link your work email. If its domain matches your website, your bids and patches show "Verified brand".
- **Brand profile.** Your brand name and logo appear on the patches you lead.
- **Campaigns.** "Spend up to $300 at Token2049, never more than $40 a spot, until the event ends." A campaign wallet bids across the event for you, cheapest spots first (or prime spots only), and returns what's left at the end. Its rules are a Privy policy you can read in plain words or as JSON, and Privy itself keeps the running total within the budget.
- **Patch anyone on X.** Offer money to any X account for a spot at an event, even if they've never used Patched. Privy creates their account and wallet on the spot; the offer waits in its own policy-limited wallet, can pay their listing stake if their wallet is empty, and buys their spot when they list. Share the offer on X in one tap.
- **Bids tab.** Spots you lead, spots where you were outbid, your receipts, and resale, on your profile.

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

- **Home feed.** Signed in, `/` is a feed of new listings, bids ("Kite took Chest on Dhruv · $120", with Outbid) and proofs, with upcoming events, what's ending soon and search alongside.
- **Explore board.** Live listings with search, surface filters, bid counts and a live activity feed.
- **Events.** `/events` lists every event with its cover. `/e/<slug>` has the cover, venue and links, who's going, leaderboards (most sponsored, brand on the most spots, biggest bidding war), every spot and a live wall of bids. Admins edit the cover and details.
- **Notifications.** A live bell and a full `/notifications` page for outbid, new bid, auto-bid placed or paused, won, listing live or rejected, bidding closed, proof posted, dispute opened, payment made, no-show refund and resale sold.

### Getting around

- **An app shell like X.** A slim sidebar (Home, Events, Explore, Activity, Profile and Create) that never reloads. Your name and dollar balance sit at the bottom; tapping it opens the wallet: Add money, My bids, Campaigns, Earnings, Settings, theme, network and sign out.
- **Phone navigation:** bottom tabs (Home, Events, Create, Activity, Profile) and your avatar at the top for the wallet.
- **A creator's page stands alone.** A listing page is the creator's own site with only a small "Made with Patched" mark, so sharing it on X feels like sharing a site they built.
- **Welcome.** New visitors sign in on a page that plays the whole story (sign in, draw spots, brands bid, show up, get paid) across outfits, vehicles and team hoodies, then pick a name, a handle (checked live) and whether they sell spots, sponsor or both.
- **Settings** (`/settings`): profile, brand (name, logo, website, verified badge), security (passkey, wallet export) and network, in one place.
- **Listing tools:** a creator's listing page, Manage screen and Share kit are tabs of one bar.
- **Testnet and mainnet:** each runs as its own site from the same code. A switch in the wallet panel and Settings moves between them and keeps you on the same page where it exists.

### Admin

- Approve or reject listings. A rejected listing returns the creator's stake.
- Review proofs, fast-track milestones and settle disputes.
- Create events, and give each one a cover, venue, city, description and links.

### Behind the scenes

- **Keeper.** A policy-limited Privy server wallet closes auctions when they end, releases payments after the review window, marks no-shows and runs auto-bids. It also runs campaigns. Every send carries an idempotency key, so a retry never acts twice.
- **Indexer.** Syncs every contract event into Supabase: bids, patches, receipts, payouts and notifications. It's rate-limited when called from the app.
- **Server-side AI.** All AI runs on the server through OpenRouter, with the cheapest model that does each job.
- **Themes and motion.** Light and dark themes. Every animation respects reduced-motion settings.
- **USDC only.** No banks or fiat anywhere: wallets hold USDC, and a test run on mainnet uses a TestUSD token with a daily faucet.

## How Patched uses Privy

Privy does much more than sign-in here. Every row is live in the app and links to the code.

| Privy feature | What it does in Patched | Code |
|---|---|---|
| Sign-in in our own design | The welcome page signs people in with Privy's headless hooks (`useLoginWithOAuth` for X, `useLoginWithEmail` for a code), and Privy's own window is branded with our logo, colour and copy. | [WelcomeView.tsx](apps/web/src/app/welcome/WelcomeView.tsx), [PrivyRuntime.tsx](apps/web/src/components/providers/PrivyRuntime.tsx) |
| Login with X, email or a wallet + embedded wallets | A brand or creator gets a self-custodial wallet in seconds, with no seed phrase and no extension. People who sign in with MetaMask keep using it; the account's wallet is always the one linked first, in the browser and on the server. The X handle becomes the creator's page. | [PrivyRuntime.tsx](apps/web/src/components/providers/PrivyRuntime.tsx), [api/profile](apps/web/src/app/api/profile/route.ts) |
| Gas sponsorship | Bids, listings, proofs and disputes cost users no MON on testnet (`sponsor: true`); it's a setting per network. | [useTx.ts](apps/web/src/lib/market/useTx.ts), [useBid.ts](apps/web/src/lib/market/useBid.ts) |
| Silent typed-data signing | A bid is one USDC permit signature plus one transaction, with no separate approve step. | [useBid.ts](apps/web/src/lib/market/useBid.ts), [permit.ts](apps/web/src/lib/market/permit.ts) |
| Server wallet + policy (keeper) | A Privy server wallet closes auctions, releases milestone payouts and marks no-shows. Its policy allows only `closeBidding`, `release` and `markFailed` on our market, plus `execute` on the auto-bidder. Anything else is rejected with `policy_violation` (checked by a script). Every send carries an `idempotency_key` keyed to the specific due action (and, for auto-bid, the top bid it's responding to), so a retried keeper tick can't pay or bid twice. | [keeper.ts](apps/web/src/lib/server/keeper.ts), [privy-keeper-add-chain.mjs](apps/web/scripts/privy-keeper-add-chain.mjs), [privy-policy-check.mjs](apps/web/scripts/privy-policy-check.mjs) |
| Open admin for judges on a policy-limited server wallet | For the hackathon, anyone signed in can approve listings, fast-track milestones, settle disputes and manage events. Those actions are sent by a separate Privy server wallet whose policy allows only those market calls: no pause, fees, treasury, roles or upgrades. Turned off after judging. | [api/admin/act](apps/web/src/app/api/admin/act/route.ts), [privy-open-admin-setup.mjs](apps/web/scripts/privy-open-admin-setup.mjs), [AdminConsole.tsx](apps/web/src/app/admin/AdminConsole.tsx) |
| Campaign wallets with policies the brand configures | Each campaign gets its own Privy server wallet and its own policy, written from the brand's settings: `bidFor` on our market only for the brand (`bidFor.bidder`), at most the per-spot maximum (`bidFor.amount`), until the end time (`current_unix_timestamp`); `approve` only for the market; `transfer` only back to the brand. The brand sees the same rules in plain words and as JSON. | [campaignPolicy.ts](apps/web/src/lib/market/campaignPolicy.ts), [campaigns.ts](apps/web/src/lib/server/campaigns.ts), [CampaignBuilder.tsx](apps/web/src/app/campaigns/new/CampaignBuilder.tsx) |
| Stateful policy: the campaign budget as a Privy aggregation | Each campaign also gets a Privy aggregation that adds up the `bidFor.amount` its wallet signs, and a budget-check rule that only signs a bid while `aggregation ≤ budget` (Privy counts the bid being checked, so the last one can't overshoot). Each bid is simulated, then checked (Privy signs it or refuses; the signature is discarded, since aggregations are only evaluated on `eth_signTransaction`), then sent through Privy's sponsored `sendTransaction`, so bids stay gasless. The send rule itself caps each bid; the wallet only ever holds the budget. `scripts/privy-campaign-budget-check.mts` proves the check with the app's own policy code ($3 + $2 of a $5 budget approved; the bid that would pass $5, a bid over the per-bid cap and a bid for another brand refused). Limits: Privy's window is at most 72 hours, and its running total lags a few seconds, so a campaign's checks are spaced 5 s apart. Privy also allows at most 10 aggregations per app and each campaign makes its own today, so past 10 campaigns they'll share one (Privy keeps a separate total per wallet). | [campaignPolicy.ts](apps/web/src/lib/market/campaignPolicy.ts), [privy.ts](apps/web/src/lib/server/privy.ts), [campaigns.ts](apps/web/src/lib/server/campaigns.ts) |
| Wallets made ahead of time: Patch anyone on X | A brand offers money to any X handle. The server looks up the numeric X id and calls `privy.users().create({ linked_accounts: [{ type: "twitter_oauth", subject, username }], wallets: [{ chain_type: "ethereum" }] })`, or finds the existing user with `getByTwitterSubject`. When that person first signs in with X, Privy logs them into this user, so the wallet and the offer are already theirs. The offer is a campaign wallet whose policy also allows exactly one kind of transfer to them: their listing stake, to their wallet only. `scripts/privy-x-offer-check.mts` proves it with the app's own code. | [xOffers.ts](apps/web/src/lib/server/xOffers.ts), [xLookup.ts](apps/web/src/lib/server/xLookup.ts), [api/offers](apps/web/src/app/api/offers/route.ts), [OfferView.tsx](apps/web/src/app/offers/[id]/OfferView.tsx) |
| Signers: auto-bid from the brand's own wallet | "Keep me on top up to $X" on a Patched wallet adds our key quorum as a signer (`useSigners().addSigners` with a policy id). The wallet's Privy policy is rebuilt from the brand's auto-bids: `bid` on those spots only (`bid.id`, `bid.patchId`, `bid.amount` ≤ max) and `approve` of the market up to the largest max. When the brand is outbid, the keeper bids from their wallet within seconds. One-tap revoke in Settings (`removeSigners`). `scripts/privy-signer-check.mts` proves Privy refuses everything else. | [useAutoBid.ts](apps/web/src/lib/market/useAutoBid.ts), [autoBidPolicy.ts](apps/web/src/lib/market/autoBidPolicy.ts), [autoBidSigner.ts](apps/web/src/lib/server/autoBidSigner.ts), [api/autobid](apps/web/src/app/api/autobid/route.ts), [keeper.ts](apps/web/src/lib/server/keeper.ts) |
| Auto-bid for outside wallets on the policy-limited server wallet | MetaMask and other outside wallets can't take a Privy signer, so they use `PatchAutoBidder`: the keeper calls `execute()` and the contract caps every bid at the brand's max. | [useAutoBid.ts](apps/web/src/lib/market/useAutoBid.ts), [PatchAutoBidder.sol](contracts/src/PatchAutoBidder.sol) |
| One signature, sponsored gas: sweep | Our `PatchSweeper` contract places several bids at once; Privy signs the single permit and sponsors the gas, so bidding on many patches is one click. | [SweepPanel.tsx](apps/web/src/components/market/SweepPanel.tsx), [PatchSweeper.sol](contracts/src/PatchSweeper.sol) |
| Passkey MFA step-up | Bids, sweeps and auto-bid maximums over a threshold ask for a passkey (Face ID, Touch ID, Windows Hello) first. | [stepUp.ts](apps/web/src/lib/market/stepUp.ts), [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Linked accounts: verified brands | A brand links a work email (Privy one-time code). If the domain matches its website, its patches show "Verified brand". This stops impersonation. | [BrandVerify.tsx](apps/web/src/components/market/BrandVerify.tsx), [verify-brand route](apps/web/src/app/api/profile/verify-brand/route.ts) |
| Linked accounts: X profile data | Signing in with X fills the creator's page from the account Privy links: their X name and full-size picture, plus their follower count (refreshed at most once a day), so brands see real reach. | [auth.ts](apps/web/src/lib/server/auth.ts), [api/profile](apps/web/src/app/api/profile/route.ts) |
| Wallet export | "Your wallet is yours": export the embedded wallet's key to any wallet. | [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Server-side auth | Every API route verifies the Privy access token (JWKS) and reads the user's wallet and verified emails from Privy's API, never from the browser. | [auth.ts](apps/web/src/lib/server/auth.ts) |
| Test accounts | A Privy test account (fixed email and code) signs in the end-to-end UI tests, so every signed-in screen is checked on each run. | [signed-in.spec.ts](apps/web/e2e/signed-in.spec.ts) |

Not used, and why:
- **Funding (card or bank on-ramps)** is left out on purpose: Patched has no banks or fiat, and wallets hold USDC only.
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

## Testing the UI

`pnpm --filter web test:ui` runs Playwright against the dev server (start it first with `pnpm web:dev`), in the
Chrome installed on the machine, on a laptop size and a phone size:

- **Every page** ([pages.spec.ts](apps/web/e2e/pages.spec.ts)): it loads, nothing scrolls sideways, no broken
  images, every button and link has a name, and nothing crashes or logs an error. Every internal link on the main
  pages opens. Each page is also saved as a screenshot in `apps/web/e2e/screens/` for a visual review.
- **What people click** ([flows.spec.ts](apps/web/e2e/flows.spec.ts)): sign-in, the app's navigation, the Studio
  deal, the campaign builder and its Privy policy, a listing, an event, Explore search and profile tabs.
- **Signed in** ([signed-in.spec.ts](apps/web/e2e/signed-in.spec.ts)): runs when `E2E_TEST_EMAIL` and
  `E2E_TEST_CODE` hold a Privy test account.

The report is in `apps/web/e2e/report/` (`npx playwright show-report e2e/report` from `apps/web`).

## Setup

```bash
pnpm install
pnpm contracts:setup
pnpm contracts:test
cp .env.example .env.local   # then fill in the values
pnpm web:dev                 # the app on Monad testnet
pnpm web:dev:mainnet         # the app on Monad mainnet, http://localhost:3200
```
