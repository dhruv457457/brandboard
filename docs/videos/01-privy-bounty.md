# Video 1 · Privy bounty: how we built Patched on Privy (2:00 max)

**What the judges want:** "a demo that clearly shows what Privy powers", with bonus points for using several Privy features well. Past Privy winners named every Privy piece they used, and the judges checked the code. So this video is about **how we built it**, not a product tour (that's the demo video). Code and the Privy dashboard are allowed here; the "no code walkthrough" rule is only for the technical demo.

Dhruv speaks; no AI voice. About 285 words, 1:55 at a relaxed pace. The teleprompter has the same lines: https://claude.ai/artifact/Hrf5HuaymQ4PKnR4nhemVG

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
3. **Edit:** lay your voice down, then cut the clips under it. Speed the live clips up (1.2–1.4×); hold the code and dashboard shots still for 3–4 seconds each so judges can read them.
4. **Before recording the dashboard:** make sure no app secret, authorization key or private key is ever on screen. Policies, wallets, aggregations and users are fine.

## The script

### 01 · Intro · 0:00–0:08
**Screen:** title card: "Patched × Privy · How we built it", and a small line: "Product demo and pitch: our other two videos".
**Say:** "Hi, I'm Dhruv. Our demo and pitch are in the other two videos. This one shows how we built Patched on Privy, feature by feature."

### 02 · Sign-in, wallets, gas · 0:08–0:28
**Caption:** PRIVY · Headless login · Embedded wallets · Gas sponsorship · `PrivyRuntime.tsx`, `useBid.ts`
**Screen:**
1. Live: sign in with X, then a bid.
2. Code: `initOAuth({ provider: "twitter" })` and `createOnLogin: "users-without-wallets"` in `PrivyRuntime.tsx`; `sendTransaction(..., { sponsor: true })` in `useTx.ts` / `useBid.ts`.
3. The bid on the explorer.

**Say:** "Sign-in uses Privy's headless hooks, so it feels like our app. X and email users get an embedded wallet right away, and every bid goes out with gas sponsorship. One lesson: sponsorship gives the wallet a 7702 delegation, so USDC permits failed. Now we approve, then bid."

### 03 · Auto-bid: signers with a policy · 0:28–0:52
**Caption:** PRIVY · Signers + policies · `useAutoBid.ts`, `autoBidPolicy.ts`, `autoBidSigner.ts`
**Screen:**
1. Live: auto-bid on; the rival outbids; it answers.
2. Code: `addSigners({ address, signers: [{ signerId, policyIds }] })`, then the rules in `autoBidPolicy.ts` (`bid.patchId`, `bid.amount` up to the max).
3. Dashboard: that policy.
4. Live: Settings → Auto-bid permission → Revoke (`removeSigners`).

**Say:** "Auto-bid runs from the brand's own wallet. We add our key as a signer with a policy, and we write that policy for each brand: only this spot, only up to their max. Raising the max needs a new policy the brand approves, so a stolen session can't raise it. Revoke is one tap."

### 04 · Campaigns: server wallets, policies, aggregations · 0:52–1:16
**Caption:** PRIVY · Server wallets · Policy engine · Aggregations · `campaignPolicy.ts`, `campaigns.ts`, `privy.ts`
**Screen:**
1. Live: the campaign builder's policy panel (plain words, then the JSON).
2. Code: `wallets().create` and `policies().create` in `campaigns.ts`; the rules in `campaignPolicy.ts` (`bidFor.bidder`, `bidFor.amount`, `current_unix_timestamp`); `createAggregation` (`POST /v1/aggregations`) in `privy.ts`.
3. Dashboard: the campaign wallet, its policy, the aggregation.
4. Live: the campaign page's **Privy blocked** row.

**Say:** "Campaigns get their own server wallet. The brand's settings become the wallet's policy: bid only for this brand, at most forty a spot, until the event ends. The total budget is a Privy aggregation. Privy signs each bid or refuses it, then we send it gas-free. Here's the one Privy blocked."

### 05 · Patch anyone on X: pregenerated wallets · 1:16–1:32
**Caption:** PRIVY · Pregenerated wallets · `xOffers.ts`, `xLookup.ts`
**Screen:**
1. Live: type an X handle, create the offer.
2. Code: `users().create({ linked_accounts: [{ type: "twitter_oauth", subject, username }], wallets: [{ chain_type: "ethereum" }] })` in `xOffers.ts`.
3. Dashboard: the new user with the X account linked and a wallet, before they ever signed in.

**Say:** "Patch anyone on X. We look up the X account, and create a Privy user with that X account linked and a wallet ready. The offer waits in its own policy wallet. When they sign in with X, it's already theirs."

### 06 · Server wallets that run the market · 1:32–1:44
**Caption:** PRIVY · Server wallets · Idempotency keys · `keeper.ts`, `autoApprove.ts`, `api/admin/act`
**Screen:**
1. Code: `wallets().ethereum().sendTransaction(...)` in `keeper.ts`, with `authorization_context` and `idempotency_key` highlighted.
2. Terminal: `node scripts/privy-policy-check.mjs` showing the policy's allowed calls, and a forbidden send refused with `policy_violation`.
3. Dashboard: the list of server wallets.

**Say:** "The keeper, the approver and open admin are server wallets too. Each policy allows a few contract calls, every send has an idempotency key, and anything else gets a policy violation."

### 07 · The rest · 1:44–1:50
**Caption:** PRIVY · MFA · Linked accounts · Export · Test accounts · README → How Patched uses Privy
**Screen:** scroll the README's Privy table on GitHub.
**Say:** "Plus passkeys for big bids, verified brands, wallet export, and test accounts for judges."

### 08 · Feedback and close · 1:50–2:00
**Screen:**
1. The Medium post.
2. Henri's thread: his question and his reply, highlighted.
3. End card: `monad.patched.world` · Sign in → Use the demo account · links to the demo and pitch videos.

**Say:** "We wrote it all up, and Henri asked what to improve. Our list is in the thread. Patched: get patched, get paid."

## If you're over 2:00

Cut in this order:
1. The "07 · The rest" line (keep the README shot, no voice).
2. The 7702 lesson in 02 ("One lesson ... then bid.").
3. "Revoke is one tap." in 03.

Keep 03, 04 and 05 whole: they are what no other team has.

## Prep

- The setup in the [README](README.md#prep-checklist-both-screen-videos).
- **Campaign "brave at Get Patched Week Mumbai":** for a **Privy blocked** row, let the rival bot outbid it until its $100 is used, then top up $10. Its next bid would pass $100, and Privy refuses it.
- **X offer:** a handle you're allowed to use that isn't on Patched yet.
- **Policy check output:** run `node scripts/privy-policy-check.mjs` from `apps/web` once before recording and screen-record the terminal.
- **Henri's thread:** a clean, cropped screenshot with his question and reply highlighted.
