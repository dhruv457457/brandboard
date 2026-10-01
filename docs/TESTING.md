# Testing Patched by hand

A checklist to try every feature on Monad testnet, and what is already proven by scripts. Work top to bottom: each
section assumes the ones before it. Status as of 2026-10-01.

## 0. Before you start (once)

1. **Privy allowed domains.** Privy dashboard → Configuration → App settings → Domains. Every site you test on must be
   listed (`https://patched.world`, `https://monad.patched.world`, `http://localhost:3000`, your `*.vercel.app` URL).
   If sign-in shows "That didn't go through" and the console shows a 403 from `auth.privy.io/api/v1/oauth/init`, the
   domain is missing. `pnpm web:dev` and the UI tests use port 3000; a dev server on any other port (3100, say) needs
   that port added too, or every page logs a Privy frame error and the page tests fail.
2. **Database.** `pnpm db:migrate` (applies everything up to `0018`).
3. **Env** (local `.env.local` and Vercel): everything in `.env.example`, including `PRIVY_SIGNER_QUORUM_ID` and
   `NEXT_PUBLIC_PRIVY_SIGNER_ID`. Redeploy after changing any `NEXT_PUBLIC_` value.
4. **Two accounts.** You need a creator and a brand, ideally two X accounts or one X plus one email. A private window
   keeps them apart. Privy test accounts (dashboard → Authentication → Test accounts) also work.
5. **Test USDC.** Patched wallets don't need MON (gas is sponsored on testnet). Send testnet USDC
   (`0x534b2f3A21130d7a60830c2Df862319e593943A3`) to each wallet from Circle's testnet faucet.
6. **Admin.** One account must be admin on the market (to approve listings). Use the deployer wallet or grant the role.

## 1. Sign in and profile

| Try | Expect |
|---|---|
| Try the demo account (top of the sign-in card) | One tap signs in to the shared Privy test account. Only shown on play money (testnet, or mainnet on TestUSD) and when `DEMO_LOGIN_EMAIL`/`DEMO_LOGIN_CODE` (or the `E2E_TEST_*` pair) are set. |
| Continue with X | You land back signed in; a Patched wallet exists (Settings → Security shows it). |
| Open your profile `/<handle>` | Your X name and profile picture, `x.com/<you>`, and your follower count (filled within a minute of first sign-in, refreshed daily). |
| Sign in with email in another window | A second wallet, made without any popup. |
| "I have a wallet" → MetaMask | Choose "keep mine" or "fresh Patched wallet". |
| Your subdomain `https://<handle>.monad.patched.world` | Your page, without the app sidebar. |

## 2. Creator: list a spot

| Try | Expect |
|---|---|
| Create → 4 steps (what, spots, deal, page) | Live preview on the right; publish asks for one stake signature. |
| Admin console → approve the listing | The listing goes live; bidding countdown starts. |
| Listing → Share | Poster templates, QR, link preview. |

## 3. Brand: bid

| Try | Expect |
|---|---|
| Tap a spot → bid the minimum | One signature, no gas prompt, toast "You lead …". |
| Outbid yourself from the other account | The first bid is refunded at once; "Bid $X" rebid button in the toast. |
| Bid over `NEXT_PUBLIC_STEP_UP_USD` (25 in `pnpm web:dev`) | Passkey prompt first. |
| Sweep several spots | One signature, all or nothing. |
| Buy now | The spot is bought outright. |
| Settings → Brand: link a work email on your website's domain | "Verified brand" badge. |

## 4. Auto-bid (new: Privy signers)

| Try | Expect |
|---|---|
| With a **Patched wallet**: spot → Auto-bid → set a max → Turn on | Privy asks you to allow Patched as a signer (first time only). The footer says bids come from your own wallet. |
| Outbid that brand from the other account | Within seconds the brand is back on top, bid from its own wallet. |
| Settings → Security | "Auto-bid permission" card listing your spots and maximums, with Revoke. |
| Revoke | Card disappears; outbidding no longer triggers auto-bids. |
| With **MetaMask**: Auto-bid | Uses the PatchAutoBidder contract instead (permit + one transaction). |

## 5. Campaigns (new: Privy budget check)

| Try | Expect |
|---|---|
| `/campaigns/new` → set budget, max per spot, event → See the policy | JSON shows the aggregation, the sponsored bid rule and the "Budget check" rule. |
| Fund and start | Campaign page shows the wallet; bids appear in "What happened" as open spots exist. |
| Set a small budget with several open spots | Bids stop at the budget; a "Privy stopped a $X bid … past its budget" line appears. |
| Pause / resume / end | Ending sends what's left back to your wallet. |

## 6. Patch anyone on X (new)

| Try | Expect |
|---|---|
| `/offers/new` → type an X handle | Their name, picture and followers appear; "On Patched" or "Not on Patched yet". |
| Offer $X at an event | One transfer; you land on `/offers/<id>` with "Post on X" and "Copy link". |
| Sign in as that X account (other window) | Home shows "A brand wants to patch you"; the offer page shows "Claim and list a spot". |
| Claim with an empty wallet | The offer pays the listing stake; Create opens on the event with an offer banner. |
| List with a spot's buy-now ≤ the offer, then approve it | The offer buys that spot; the offer page says the person is patched; the rest returns to the brand. |
| Close the offer early (brand) | Money returns to the brand. |

## 7. Delivery and payout

| Try | Expect |
|---|---|
| Creator: Studio → upload proof for a milestone | Brands see it; review timer starts (2 min on the testnet demo market). |
| Brand: approve the proof | Review closes early; the keeper releases the payment. |
| Brand: dispute instead | Admin console shows the dispute; admin splits it. |
| Miss a proof deadline | Keeper marks it failed; unpaid escrow and the stake go to the brands. |

## Proven by scripts (run any time)

From `apps/web` with `.env.local` in the repo root (add `NODE_USE_ENV_PROXY=1` in cloud sessions):

| Script | Checks | Last result |
|---|---|---|
| `node scripts/privy-policy-check.mjs 10143` | Keeper policy allows the current market and auto-bidder; refuses 3 other calls | pass (2026-09-30) |
| `npx tsx scripts/privy-signer-check.mts` | Signer policy: approve within max allowed; over-max approve, other spender, transfer, other market call refused | pass 5/5 (2026-09-30) |
| `npx tsx scripts/privy-campaign-budget-check.mts` | Budget check approves $3 + $2 of $5; refuses past budget, over per-bid cap, other brand | pass 6/6 (2026-10-01) |
| `NODE_OPTIONS=--conditions=react-server npx tsx scripts/privy-x-offer-check.mts` | Privy user + wallet made ahead of time for a new X id; reused on the second offer; stake only to that wallet | pass 5/5 (2026-10-01) |
| `pnpm --filter web test:ui` (dev server running) | Every page loads, no sideways scroll, links work, main flows | see `apps/web/e2e/report/` |

## Not verified yet, or known issues

- **Nothing new has run end to end on-chain:** auto-bid through signers, the campaign budget check, and offers were
  proven against Privy but not yet through a live listing and real USDC. Sections 4–6 are that test.
- **Signer bid rules** (right spot, amount ≤ max) can only be proven with a live listing: Privy simulates a call
  before checking the policy, so a bid that would revert never reaches the policy.
- **X lookup** (offers, followers) uses `api.fxtwitter.com`, tested with sample responses only. If it fails on Vercel,
  set `X_BEARER_TOKEN` (X API Basic).
- **Mainnet:** gas sponsorship is off in the mainnet config, so server-wallet sends (keeper, campaigns, offers) need
  MON in those wallets or sponsorship turned on for mainnet in Privy.
- **React error #418** (hydration) shows in the console sometimes; React recovers. Tracked in `docs/requests.md`.
