# Video 1 · Privy bounty: how we built Patched on Privy (2:00 max)

**What the judges want:** "a demo that clearly shows what Privy powers", with bonus points for using several Privy features well. Past Privy winners named every Privy piece they used, and the judges checked the code. So this video is about **how we built it**, not a product tour (that's the demo video). Code and the Privy dashboard are allowed here; the "no code walkthrough" rule is only for the technical demo.

Dhruv speaks; no AI voice. Each feature is explained step by step: what Privy does, in what order, and why. About 395 words: 2:35 at a natural pace, **1:59 once the voice is played at 1.3×** in the edit (2:04 at 1.25×). Times below are at natural pace. The teleprompter has the same lines: https://claude.ai/artifact/Hrf5HuaymQ4PKnR4nhemVG

## Every feature in three layers

For each feature, the screen shows the same three things in order:

1. **What:** 3–4 seconds of the live site doing it.
2. **How:** our code, zoomed in, with the Privy call highlighted.
3. **Proof:** the same thing in the **Privy dashboard** (the wallet, its policy, the aggregation, the signer) or on the Monad explorer.

A caption names the Privy feature (top line) and the file (second line).

**If Henri says "deck-style":** put the same lines over one slide per feature, showing the code snippet and a dashboard screenshot. Keep a 2-second live clip on each slide if you can.

## How to make it

1. **Record your voice first** with the teleprompter, one section at a time.
2. **Record three kinds of clips** per section:
   - the live site;
   - the code in VS Code (font size 20+, one function on screen, the line highlighted);
   - the Privy dashboard.
3. **Edit:** lay your voice down and play it at 1.3× (1.25× if that sounds rushed, then cut "Plus"). Cut the clips under it. Speed the live clips up as needed; hold the code and dashboard shots still for 3–4 seconds each so judges can read them.
4. **Before recording the dashboard:** make sure no app secret, authorization key or private key is ever on screen. Policies, wallets, aggregations and users are fine.

## The script

### 01 · Intro · 0:00–0:10
**Screen:** title card: "Patched × Privy · How we built it", and a small line: "Product demo and pitch: our other two videos".
**Say:** "Hi, I'm Dhruv. Our demo and pitch are in the other videos. This one explains how we built Patched on Privy, step by step."

### 02 · First: wallets and gas · 0:10–0:35
**Caption:** PRIVY · Headless login · Embedded wallets · Gas sponsorship · `PrivyRuntime.tsx`, `useBid.ts`
**Screen:**
1. Live: sign in with X, then a bid.
2. Code: `initOAuth({ provider: "twitter" })` and `createOnLogin: "users-without-wallets"` in `PrivyRuntime.tsx`; `sendTransaction(..., { sponsor: true })` in `useTx.ts` / `useBid.ts`.
3. The bid on the explorer.

**Say:** "First, wallets. Sign-in uses Privy's headless hooks, so the screen is our own. When someone signs in with X or email, Privy creates an embedded wallet for them right away. Bids are sent with Privy gas sponsorship, so nobody needs MON. One lesson: sponsorship adds a 7702 delegation to the wallet, and USDC rejects permits from it. So we approve, then bid."

### 03 · Second: auto-bid with signers · 0:35–1:07
**Caption:** PRIVY · Signers + policies · `useAutoBid.ts`, `autoBidPolicy.ts`, `autoBidSigner.ts`
**Screen:**
1. Live: auto-bid on; the rival outbids; it answers.
2. Code: `addSigners({ address, signers: [{ signerId, policyIds }] })`, then the rules in `autoBidPolicy.ts` (`bid.patchId`, `bid.amount` up to the max).
3. Dashboard: that policy.
4. Live: Settings → Auto-bid permission → Revoke (`removeSigners`).

**Say:** "Second, auto-bid. A brand says: keep me on top, up to fifteen dollars. One: we generate a Privy policy for that brand. It allows a bid on that one spot, up to fifteen, and nothing else. Two: their wallet adds our key as a signer, tied to that policy. Three: when they're outbid, our server bids from their own wallet, and Privy checks the policy before it signs. Raising the max needs a new policy the brand approves, and revoke removes our signer."

### 04 · Third: campaigns · 1:07–1:40
**Caption:** PRIVY · Server wallets · Policy engine · Aggregations · `campaignPolicy.ts`, `campaigns.ts`, `privy.ts`
**Screen:**
1. Live: the campaign builder's policy panel (plain words, then the JSON).
2. Code: `wallets().create` and `policies().create` in `campaigns.ts`; the rules in `campaignPolicy.ts` (`bidFor.bidder`, `bidFor.amount`, `current_unix_timestamp`); `createAggregation` (`POST /v1/aggregations`) in `privy.ts`.
3. Dashboard: the campaign wallet, its policy, the aggregation.
4. Live: the campaign page's **Privy blocked** row.

**Say:** "Third, campaigns. A brand sets a hundred dollars for an event, at most forty a spot. One: we create a Privy server wallet just for that campaign. Two: the brand's settings become its policy: bids only for this brand, a cap on each bid, and an end time. Three: the total budget is a Privy aggregation, a running sum of every bid the wallet signs. Privy signs each bid or refuses it, then we send it gas-free. This is the bid Privy refused."

### 05 · Fourth: patch anyone on X · 1:40–2:02
**Caption:** PRIVY · Pregenerated wallets · `xOffers.ts`, `xLookup.ts`
**Screen:**
1. Live: type an X handle, create the offer.
2. Code: `users().create({ linked_accounts: [{ type: "twitter_oauth", subject, username }], wallets: [{ chain_type: "ethereum" }] })` in `xOffers.ts`.
3. Dashboard: the new user with the X account linked and a wallet, before they ever signed in.

**Say:** "Fourth, patch anyone on X. One: we look up the handle's X user ID. Two: we create a Privy user with that X account linked and a wallet ready. Three: the offer waits in its own policy wallet. When they first sign in with X, Privy logs them into that same user, so the money is already theirs."

### 06 · Fifth: server wallets · 2:02–2:17
**Caption:** PRIVY · Server wallets · Idempotency keys · `keeper.ts`, `autoApprove.ts`, `api/admin/act`
**Screen:**
1. Code: `wallets().ethereum().sendTransaction(...)` in `keeper.ts`, with `authorization_context` and `idempotency_key` highlighted.
2. Terminal: `node scripts/privy-policy-check.mjs` showing the policy's allowed calls, and a forbidden send refused with `policy_violation`.
3. Dashboard: the list of server wallets.

**Say:** "Fifth, the keeper, the approver and open admin are Privy server wallets. Each policy allows only the contract calls it needs, every send has an idempotency key so a retry can't pay twice, and anything else is refused."

### 07 · Plus · 2:17–2:26
**Caption:** PRIVY · MFA · Linked accounts · Export · Test accounts · README → How Patched uses Privy
**Screen:** scroll the README's Privy table on GitHub.
**Say:** "Plus passkeys for big bids, verified brands by work email, wallet export, Privy token checks on our server, and test accounts for judges."

### 08 · Close · 2:26–2:35
**Screen:**
1. The Medium post.
2. Henri's thread: his question and his reply, highlighted.
3. End card: `monad.patched.world` · Sign in → Use the demo account · links to the demo and pitch videos.

**Say:** "Each feature links to its code in our README, and we sent Henri our list of improvements. Patched: get patched, get paid."

## If the final cut is over 2:00

Cut in this order:
1. The "07 · Plus" line (keep the README shot, no voice).
2. The 7702 lesson in 02 ("One lesson ... then bid.").
3. "Raising the max needs a new policy the brand approves, and revoke removes our signer." in 03.

Keep 03, 04 and 05 whole: they are what no other team has.

## Prep

- The setup in the [README](README.md#prep-checklist-both-screen-videos).
- **Campaign "brave at Get Patched Week Mumbai":** for a **Privy blocked** row, let the rival bot outbid it until its $100 is used, then top up $10. Its next bid would pass $100, and Privy refuses it.
- **X offer:** a handle you're allowed to use that isn't on Patched yet.
- **Policy check output:** run `node scripts/privy-policy-check.mjs` from `apps/web` once before recording and screen-record the terminal.
- **Henri's thread:** a clean, cropped screenshot with his question and reply highlighted.
