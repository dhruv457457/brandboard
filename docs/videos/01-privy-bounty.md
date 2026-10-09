# Video 1 · Privy bounty (target 2:50, hard stop 3:00)

**What the judges look for:** "a demo that clearly shows what Privy powers", with bonus points for meaningfully using several Privy features. Login alone doesn't qualify.

**So the video is a countdown of Privy features, each one visible on the live site, each one with a caption.** No slides, apart from one optional half-second end card. Every beat names the Privy feature, shows it working, and, where money moves, shows the transaction on the Monad explorer.

Feature map (the caption text, in order):

| # | Caption (bottom-left) | Shown by |
|---|---|---|
| 1 | PRIVY · Headless login, our own design | the sign-in card |
| 2 | PRIVY · Embedded wallet, made at sign-in | wallet panel |
| 3 | PRIVY · Test accounts (one-tap demo) | "Use the demo account" |
| 4 | PRIVY · Gas sponsorship, no pop-up | a bid + explorer |
| 5 | PRIVY · Signers + policy (auto-bid) | auto-bid answers a rival |
| 6 | PRIVY · One-tap revoke | Settings → Auto-bid permission |
| 7 | PRIVY · Server wallet + brand-written policy | campaign builder |
| 8 | PRIVY · Aggregation: budget enforced by Privy | campaign activity |
| 9 | PRIVY · Pregenerated wallets (Patch anyone on X) | an offer to an X handle |
| 10 | PRIVY · Server wallets: keeper, approver, open admin | admin + explorer |
| 11 | PRIVY · Passkey MFA for big money | Settings → Passkey |
| 12 | PRIVY · Linked accounts: verified brand, X reach | Settings → Your brand; profile |
| 13 | PRIVY · Wallet export | Settings → Export key |
| 14 | PRIVY · Server-side auth | (said in the outro) |

## Prep (15 minutes before)

1. Window A (incognito): **signed out**, on `monad.patched.world` (you'll sign in on camera).
2. Window B (normal): signed in as @dhruvpanch0li.
3. **Campaign, made 10 minutes early in Window A**, so it has history to show:
   - `/campaigns/new`, event Get Patched Week, **Total budget $6**, **Most it pays for one spot $5**, cheapest first, ends tomorrow;
   - fund it from the demo wallet;
   - wait for the keeper (it runs every minute) until the campaign page lists its bids and, ideally, a bid **Privy refused** because it would pass the budget.
   - If no refusal shows, use the existing evidence row T9b (`0x2a5d3397…`) in the voice-over instead of claiming one on screen.
4. Terminal ready with the rival bid command for listing 14 (see [README](README.md#prep-checklist-both-screen-videos)).
5. For the X offer: an X handle you're allowed to use that isn't on Patched yet (a friend's, or a second account of yours). The offer is real on testnet: it pregenerates a Privy account for that handle.

## Script

Timings are targets. **VO** is the voice-over; **Screen** is what you do.

### 0:00 – 0:10 · Hook
- **Screen:** the landing page, scroll a little.
- **VO:** "Patched is a live USDC auction for the logo spots on creators' outfits, cars and team hoodies, on Monad. Every wallet, signature and payment in it runs on Privy. Here are fourteen Privy features, live, in under three minutes."

### 0:10 – 0:28 · Login, embedded wallet, test account (captions 1, 2, 3)
- **Screen (Window A):** Sign in → our sign-in card (point at X *Recommended*, email, wallet) → **Use the demo account** → you land in the app → click your name at the bottom of the sidebar → the wallet panel: address, **$37** balance.
- **VO:** "This is our own sign-in screen, built on Privy's headless hooks: X, email, or your own wallet. X and email users get a Privy embedded wallet the moment they sign in. No seed phrase, no extension. For judges, a Privy test account signs you in with one tap, on test money only."

### 0:28 – 0:50 · A bid with no pop-up and no gas (caption 4)
- **Screen:** open listing **#14** → tap **shirt pocket** → the brand check ("go with this branding?") → yes → **Bid $10** → the "You lead" toast → open the transaction on the explorer (activity row → explorer link). Point at **from** = the embedded wallet.
- **VO:** "Tap a spot and bid. No wallet pop-up and no gas: the embedded wallet approves the exact amount and bids, both gas-sponsored by Privy. There's the transaction on Monad."

### 0:50 – 1:20 · Auto-bid as a Privy signer (captions 5, 6)
- **Screen:** on the same spot open **Auto-bid** → max **$15** → turn it on. Then switch to the terminal and run the rival bid (`SPOT=0`). Back to Window A: within a few seconds the spot flips back to you, and the toast and bell say auto-bid placed a bid. Then **Settings → Auto-bid permission**: the rule, the maximum, the **Revoke** button (don't press it yet if you need it later).
- **VO:** "Auto-bid: keep me on top up to fifteen dollars. This adds Patched as a signer on my own wallet, with a Privy policy that allows exactly one thing: bids on this spot, up to fifteen. A rival bids... and Patched bids back from my wallet within seconds. Anything outside that policy, Privy refuses. And I can revoke it in one tap."

### 1:20 – 1:50 · Campaigns: a wallet, a policy and a budget the brand writes (captions 7, 8)
- **Screen:** `/campaigns/new`: show the fields (**Where it bids**, **Total budget**, **Most it pays for one spot**), then the policy panel ("Privy guards this wallet"): plain words, then the JSON. Then open the campaign you made in prep: its bids, and the refused one.
- **VO:** "A campaign: spend up to six dollars at this event, never more than five a spot. Each campaign gets its own Privy server wallet, and these settings become its policy. Here it is in plain words, and as the JSON Privy enforces. The budget is a Privy aggregation: Privy keeps the running total and refuses the bid that would go over. Here's the campaign bidding, and the bid Privy refused."

### 1:50 – 2:12 · Patch anyone on X: pregenerated wallets (caption 9)
- **Screen:** `/automate` → **Patch anyone on X** → type the handle → their X profile shows → $5, the event → create → the offer page: the money waiting in its own wallet, **Share on X**.
- **VO:** "Patch anyone on X. I offer five dollars to an X account that has never used Patched. Privy creates their account and wallet right now, linked to their X login. The money waits in its own policy-limited wallet. When they sign in with X, it's already theirs, and it can even pay their listing stake."

### 2:12 – 2:32 · Server wallets with policies (caption 10)
- **Screen:** `/admin` (the "Open admin for the hackathon demo" note) → **Proofs and disputes** (or a listing approval) → then the explorer on a keeper transaction (for example the listing #12 payout or a `closeBidding`), pointing at the keeper address.
- **VO:** "Everything that has to happen on time runs on Privy server wallets, each locked by a policy. The keeper can only close auctions, release payments, mark no-shows and answer auto-bids. The approver can only put new listings live. And admin is open on purpose for judges, through a wallet that can approve, fast-track and settle disputes, and nothing else: no fees, no treasury, no upgrades."

### 2:32 – 2:50 · Passkeys, linked accounts, export (captions 11, 12, 13)
- **Screen (Window B, Dhruv):** **Settings** → **Passkey** ("Set up passkey", or on) → **Your brand** → verify with a work email → **Your wallet is yours** → **Export key** (cut before the key appears) → your profile header with your X picture and follower count.
- **VO:** "Bids and budgets over a thousand dollars need a passkey, through Privy MFA. Brands link a work email to get verified, and creators' X reach comes from the X account Privy links. And the wallet is yours: export it any time."

### 2:50 – 3:00 · Outro (caption 14)
- **Screen:** the README section "Built on Monad and Privy" on GitHub, or back to the landing page.
- **VO:** "Every API call is checked against the Privy token on the server. Fourteen Privy features, all live on monad.patched.world. The README links each one to its code."

## If you're over time

Cut in this order: export (keep passkey), the X-reach line, the revoke click (say it instead). Never cut auto-bid, campaigns or X offers: they are what no other team has.

## What to write in the Privy bounty text field

A short version of [../context/02-privy.md](../context/02-privy.md): the "who signs what" table and the lessons list. The README table is the public version.
