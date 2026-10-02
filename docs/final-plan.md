# Final plan: Oct 2 to Oct 14 (Monad, Social track)

Deadline: **Oct 14 2026, 09:29 IST**. Submit on Oct 12. Code freeze on Oct 11.

This file lists every piece of dev work left, as modules with a definition of done, then one test plan that proves the
money flows on-chain with the accounts we already have. Product and team work (outreach, videos, interviews) is at the
end only where code depends on it.

## Where it stands (Oct 2)

Built: bid, escrow and payout loop, resale receipts, AI canvas and car views, Studio, creator subdomains, events with
leaderboards, campaigns with a Privy budget aggregation, "Patch anyone on X", auto-bid through signers, sweep, passkey
step-up, demo account, open admin on play money, the Activity page, one-step events, the Oct 2 audit fixes.

Not proven: signer auto-bid, campaigns, offers, proof, review and payout have never run on a live listing
(TESTING.md §4–7). Traction on testnet: 14 profiles, 3 creators, 4 listings, 27 bids from 7 wallets (mostly seeded
bots), 0 campaigns, nothing on mainnet.

## Status (2026-10-02)

| Module | State |
|---|---|
| M1 On-chain test run | Done: 25 transactions in [evidence.md](evidence.md); found and fixed the Privy-wallet bid bug |
| M2 Explorer links | Done: bids, Activity rows, campaign actions |
| M3 1% fee | Not a contract upgrade: `setParams` already sets it. One admin call left to run (see evidence.md) |
| M4 Aggregations | The shared aggregation does not work (one total per aggregation, not per wallet). Built: one per live campaign, freed at the end, none past 8 live |
| M5 Add money | Done: sheet with QR, address, steps, faucet, live balance |
| M6 Token2049 pilot | Events created (Buenos Aires, Monad Open, Token2049 Singapore) and three real-photo listings; the real USDC vs TestUSD decision is open |
| M7 Follows | Done: follow creators, brands and events; Following feed on Home |
| M8 Reactions | Done on spotted photos (fire, cheer, love) |
| M9 Spotted | Done: wall on event, listing and profile; creator notified |
| M10 UX fixes | Partly: admin status labels, spot placement on the person. Still open: profile reach, listing goal line, event page cards, Automate entry |
| M11 Metrics | Done: `scripts/metrics.mts` |
| M12 Verify it yourself | Done: README table |

## Order of work

| # | Module | Score it moves | Size | Days |
|---|---|---|---|---|
| M1 | On-chain test run and evidence | Technical, everything else depends on it | 1 day | Oct 2–3 |
| M2 | Explorer links on every money row | Technical | 0.5 day | Oct 3 |
| M3 | Contract upgrade: 1% fee (+ referral split if we keep it) | Truth of our copy | 0.5 day | Oct 3–4 |
| M4 | Shared Privy aggregation (10-per-app limit) | Technical, prevents a live failure | 0.5 day | Oct 4 |
| M5 | Add money screen (zero balance) | Design, traction | 0.5 day | Oct 4 |
| M6 | Token2049 event and pilot readiness | Traction, market readiness | 0.5 day | Oct 5 |
| M7 | Follows and a follows feed | Social track, originality | 1 day | Oct 5–6 |
| M8 | Reactions on the live wall | Social track | 0.5 day | Oct 6 |
| M9 | Spotted @creator | Social track, originality | 1–1.5 days | Oct 6–7 |
| M10 | UX fixes from the audit | Design | 1 day | Oct 8 |
| M11 | Metrics script and page | Traction (the slide) | 0.25 day | Oct 9 |
| M12 | README "Verify it yourself" | Technical | 0.25 day | Oct 9 |
| — | Bug fixes only, then freeze | | | Oct 10–11 |

Cut: PatchBonus / X reach bonus (needs a paid X API tier and a new contract), bundles, the PatchSocial contract
(only if M7–M9 land early; see M9 note), hard-coded colours and nav-vs-spec (audit M6, M7) unless there is time.

---

## M1. On-chain test run and evidence

**Goal:** every money flow runs once on testnet against a live listing, and every transaction hash is saved.

**Build:**
- `apps/web/scripts/onchain-cycle.mts`: drives the parts that don't need a browser (listing, approval, rival bids,
  proofs, keeper ticks) with the deployer key and the bot wallets. Each step prints the action, the tx hash and an
  explorer link, and appends a row to `docs/evidence.md`.
- `apps/web/e2e/money.spec.ts` (Playwright, tagged so the normal UI suite skips it): drives the parts that need a
  Privy wallet in a browser (bid, sweep, auto-bid with a signer, campaign, offer) as the Privy test account.
- `docs/evidence.md`: a table of step, actor, tx hash, explorer link, date. The README links it.

**Done when:** every step in the test plan below has a hash in `docs/evidence.md`, or a written reason why not.

## M2. Explorer links on every money row

**Goal:** a judge can click from any bid, refund, sale or payout to the Monad explorer.

**Build:**
- `lib/explorer.ts`: `txUrl(hash)` and `addressUrl(addr)` from the chain config (testnet and mainnet).
- A small `ExplorerLink` component ("View on Monad", lucide `ExternalLink`).
- Use it on: the listing's live wall and bid history (`bids.tx_hash`), SOLD and buy-now rows, payouts, refunds,
  Activity rows (notifications already select `tx_hash`), the campaign "What happened" list, and the offer page.

**Done when:** each of those surfaces has a working link for a row from the M1 run.

## M3. Contract upgrade: 1% fee

**Goal:** the fee is 1% on-chain, matching the story video and the mentor messages.

**Build:**
- `PatchedMarket`: admin-only `setFees(uint16 feeBps, uint16 royaltyBps)` with an upper bound (e.g. 10%) and an
  event. The contract is UUPS, so this is an upgrade, not a redeploy; keep the storage layout.
- Optional, decide before starting: a referral split on the fee (`?ref=` address stored with the first bid). Only if
  we are sure we want referrals, so the contract changes once.
- Tests: setter access, bounds, payout maths at 1%, upgrade test still passes, invariant still holds.
- Run the upgrade on testnet, call `setFees(100, 500)`, regenerate ABIs into `packages/shared`, update
  `docs/contracts.md`.

**Done when:** `feeBps()` reads 100 on testnet and `forge test` passes.

## M4. Shared Privy aggregation

**Goal:** campaigns and X offers keep working past 10 (Privy allows 10 aggregations per app).

**Build:** one aggregation per chain and market (sum of `bidFor.amount`, 72 h window), id in
`PRIVY_CAMPAIGN_AGGREGATION_ID`; every campaign policy keeps its own `aggregation.<id> lte budget` rule. Privy keeps a
separate total per wallet, so campaigns don't share budgets. A script creates it once. Existing campaigns keep theirs.

**Result (2026-10-02): this does not work.** `scripts/privy-campaign-budget-check.mts` put two wallets on one aggregation and the
second was refused after the first used the budget: an aggregation keeps one total for every wallet that uses it. Built instead:
one aggregation per live campaign, deleted when the campaign ends (frees a slot), and past 8 live ones a campaign goes without
(per-bid cap plus a wallet that only holds its budget).

**Done when:** `scripts/privy-campaign-budget-check.mts` passes with two campaign wallets on the shared aggregation,
each with its own total.

## M5. Add money screen

**Goal:** a brand with $0 knows exactly how to get USDC in.

**Build:** a sheet from the wallet panel and from any "not enough USDC" error: the address with copy and QR, "send
USDC on Monad" steps, the live balance that updates when money lands, and the Circle faucet link on testnet. Shown
automatically after a first bid attempt with a $0 balance.

**Done when:** the Privy test account with a $0 balance sees it, copies the address, and the balance updates after a
transfer.

## M6. Token2049 event and pilot readiness

**Decision first (Dhruv):** TestUSD on testnet, or real USDC on mainnet. Real USDC is far more convincing, but on
mainnet open admin and the demo account switch off, and the keeper, campaign and offer wallets need MON for gas.

**Build / do:**
- Create "Token2049 Singapore" (Oct 7–8, Marina Bay Sands) with a cover through the admin event flow.
- If mainnet: check the deployment (`DEPLOYMENTS[143]`), fund the keeper and open-admin server wallets with MON, run
  the indexer for chain 143, and point the keeper cron at the mainnet site.
- A short printable "List your fit" QR for the event that opens Studio with the event preselected.

**Done when:** a creator can list for Token2049 in under 3 minutes and an admin can approve it.

## M7. Follows and a follows feed

**Build:**
- Migration `0019_follows.sql`: `follows (follower uuid → profiles, target_kind 'creator'|'brand'|'event', target_id
  text, created_at)`, primary key on all three, RLS: anyone reads, you write your own rows.
- `POST/DELETE /api/follows`, rate-limited.
- `FollowButton` on creator profiles, brand profiles and event pages, with a follower count.
- Home feed: a "Following" filter showing new listings, wins and spotted posts from what you follow.
- Notification when someone you follow lists or gets patched.

**Done when:** following a creator makes their next listing show in your Following feed and notifications.

## M8. Reactions on the live wall

**Build:**
- Migration `0020_reactions.sql`: `reactions (profile, target_kind 'bid'|'post', target_id, kind, created_at)`, one per
  person per target per kind. Kinds are lucide icons, never emojis (e.g. `flame`, `zap`, `hand`).
- Reaction buttons on live-wall bids and spotted posts, counts via Supabase Realtime.

**Done when:** a reaction from one window shows up in another within a second.

## M9. Spotted @creator

**Goal:** anyone at an event posts a photo of a patched creator. This is the most original social piece.

**Build:**
- Use the existing `posts` table: `media` holds the photo, `listing_id` links the creator's listing; add `event_id`
  and `spotted` (profile) columns in a migration.
- "Spotted someone?" on the event page and listing page: photo upload (existing uploads route and limits), pick the
  creator, short caption.
- Shows on the event page wall, the creator's profile and the listing. The creator gets a notification. A spotted
  post can be attached to the creator's proof with one tap.
- Moderation: uploads go through the existing limits; admin can hide a post.

Note: the PatchSocial contract (on-chain follow, check-in, spot, cheer) would turn these into countable on-chain
actions. Only if M7–M9 are done by Oct 7.

**Done when:** a post from one account appears on the event wall and on the creator's page, and the creator is
notified.

## M10. UX fixes from the audit

- Creator profile: show X reach instead of "0 deliveries · $0 earned" for new creators; a "Sponsor a spot" button.
- Listing page: a real title ("Dhruv at Metropolis"); a goal line ("$62 of $370 · 2 of 6 spots open"); a larger crop
  of the outfit image.
- Event page: no empty gap with one creator; stats as cards.
- Brand side: the Privy policy panel as one shared component (it's the Privy showpiece, used in campaigns and offers);
  one "Automate" entry point that leads to auto-bid, campaigns and offers.

**Done when:** each item is checked on desktop and phone width, light and dark.

## M11. Metrics script and page

`apps/web/scripts/metrics.mts`: wallets, profiles (with X), creators, listings, bids, unique bidders, volume, campaigns,
offers, proofs, payouts, follows, spotted posts, on-chain transactions, per chain, excluding known bot and deployer
wallets (listed in the script). Prints a table for the metrics slide; optionally an `/admin` panel with the same numbers.

## M12. README "Verify it yourself"

The M1 hashes in order (list → bid → outbid refund → auto-bid → sweep → campaign bid → close → proof → payout → offer),
each with one line on what it proves and which Privy feature it uses.

---

## Test plan

### Accounts we already have (values stay in `.env.local` and `contracts/.env`, never in the repo)

| Actor | Credential | Used for |
|---|---|---|
| Admin and creator | `DEPLOYER_PRIVATE_KEY` (has ADMIN_ROLE on the testnet market) | Create listings by script, approve, submit proofs, admin checks |
| Brand (Privy) | Privy test account `E2E_TEST_EMAIL` / `E2E_TEST_CODE` | Everything that needs a Privy embedded wallet in a browser: bid, sweep, auto-bid with signer, campaign, offer, Add money |
| Rival brands | 5 bot wallets (Alice, Rahul, Priya, Kenji, Sofia; local `BIDDERS_FILE`, not committed) and `TEST_BRAND_PRIVATE_KEY` | Outbid to trigger refunds and auto-bids |
| Keeper | Privy server wallet (`PRIVY_SERVER_WALLET_ID`, policy `PRIVY_KEEPER_POLICY_ID`) | Close auctions, run auto-bids and campaigns, release payouts |
| Open admin | `PRIVY_OPEN_ADMIN_WALLET_ID` | Approve as a non-admin through the policy-limited wallet |
| X offer target | Dhruv's own X account (manual) | Claiming an offer needs a real X sign-in |

Funding: test USDC from Circle's faucet to the Privy test account and the bots; the deployer covers listing stakes.
The testnet demo market has short timers (2-minute review), so a full cycle fits in about 30 minutes.

Where: `localhost:3000` (Privy allows 3000 and 3200, not 3100), then once on `monad.patched.world`.

### The cycle (M1 records a hash for each step)

| # | Step | Actor and how | Expect |
|---|---|---|---|
| T1 | Create a listing with 3 spots on the Token2049 Demo event, short bidding window | Deployer, script | `ListingCreated`, stake pulled |
| T2 | Approve the listing | Open admin wallet through `/admin` as the Privy test account | Listing goes live (proves open admin's policy) |
| T3 | Bid on spot 1 | Privy test account, Playwright | One signature, no gas prompt, "You lead" |
| T4 | Outbid on spot 1 | Bot, script | Privy account refunded in the same tx |
| T5 | Turn on auto-bid (max $X) on spot 1 | Privy test account, Playwright | Signer added with a policy id; Settings shows the permission |
| T6 | Outbid again | Bot, script | Keeper bids from the Privy account's own wallet within seconds |
| T7 | Bid above the auto-bid max | Bot, script | Auto-bid stops, brand notified |
| T8 | Sweep spots 2 and 3 | Privy test account, Playwright | One signature, both bids |
| T9 | Campaign: budget $5, $3 per spot, on the event | Privy test account, Playwright | Campaign wallet bids; a bid past $5 is refused by Privy and logged |
| T10 | Revoke auto-bid | Privy test account | Outbidding no longer triggers it |
| T11 | Bidding ends | Keeper (cron or `/api/keeper/run`) | `closeBidding`, receipts minted |
| T12 | Submit proof for milestone 1 | Deployer, script (upload through `/api/proofs` first) | Proof stored and hashed on-chain |
| T13 | Approve the proof | Privy test account (holder) | Review closes; keeper releases payment, fee at 1% after M3 |
| T14 | Dispute milestone 2's proof instead | Privy test account | Admin settles it with a split |
| T15 | "Patch anyone on X": offer to Dhruv's X handle | Privy test account, Playwright | Pregenerated wallet; offer funded |
| T16 | Claim the offer | Dhruv, manual X sign-in | Offer pays the stake; listing with the offer banner |
| T17 | Passkey step-up on a bid over the threshold | Dhruv, manual (passkeys can't be automated) | Passkey prompt before signing |
| T18 | Zero balance → Add money (after M5) | A fresh Privy account, manual | Sheet shows address and QR; balance updates |

Before T1: check the Privy dashboard has the signer key quorum (`PRIVY_SIGNER_QUORUM_ID`) and test accounts enabled.

### Regression on every change

- `pnpm contracts:test` (after M3)
- `npx tsc --noEmit -p apps/web` and `next lint`
- `pnpm --filter web test:ui` against `localhost:3000`
- The four Privy scripts in TESTING.md ("Proven by scripts")

### Mainnet (only if M6 decides real USDC)

Repeat T1, T3, T4, T11–T13 with small real amounts after the server wallets hold MON. Save those hashes in the same
evidence file under a mainnet heading.

---

## Team work that code depends on

- **Oct 2–4:** tester group (Telegram), brand outreach, the decision in M6.
- **Oct 7–8:** Token2049 pilot: 5–10 creators listing, a few brands bidding, spotted posts and proofs during the event.
- **Oct 9–11:** tech demo video (≤3 min, from the M1 flow with the explorer shown) and pitch video (≤2 min); the
  metrics slide from M11.
- **Oct 12:** submit: logo, description, team invites, repo shared with metropolis@hackathon.monad.xyz, a dashboard
  progress update. Arc mainnet deploy for the grant the same day.
