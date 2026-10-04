<p align="center">
  <img src="docs/images/banner.png" alt="Patched: Get patched. Get paid." width="100%">
</p>

<p align="center">
  <a href="https://monad.patched.world"><b>Try it live</b></a> ·
  <a href="https://x.com/Patched_world">@Patched_world</a> ·
  <a href="docs/contracts.md">Contracts</a> ·
  <a href="docs/privy.md">Privy in detail</a> ·
  <a href="docs/evidence.md">On-chain evidence</a>
</p>

<p align="center">
  <img alt="Monad" src="https://img.shields.io/badge/Monad-testnet%20%2B%20mainnet-836EF9?style=flat-square">
  <img alt="Privy" src="https://img.shields.io/badge/Privy-wallets%2C%20signers%2C%20policies-FF5A1F?style=flat-square">
  <img alt="Solidity" src="https://img.shields.io/badge/Solidity-0.8.28-363636?style=flat-square">
  <img alt="Tests" src="https://img.shields.io/badge/contract%20tests-120%20passing-1F8A4C?style=flat-square">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-App%20Router-0B0B0C?style=flat-square">
</p>

## It started with one outfit

Before Token2049, a popular creator, [vanshu.eth](https://token2049.vanshu.fun/), posted her event outfit and offered brands the logo spots on it. People loved the idea. Then the hard part began:

- **Her payments got rejected.** Brands paying from abroad hit international transaction rejections at Razorpay.
- **She had to run a whole website** just to show the spots and take orders.
- **Every price was fixed.** A brand ready to pay more had no way to outbid anyone. The spot went to whoever came first, not to whoever wanted it most.

She isn't the only one. Anyone people look at has ad space, and the same three problems. So we built **Patched**.

You upload a photo of your outfit, your car or your team's hoodie, and mark the spots where a logo can go. **Brands bid on each spot in a live auction, in USDC.** The money waits in escrow on Monad and comes to you once you post proof that you showed up. You also get your own site at `yourname.monad.patched.world`, so there is nothing to build. We take 1%.

| Her problem | What Patched does |
|---|---|
| Payments rejected | USDC, straight to a wallet. No bank, no card, no international transaction. |
| A whole website to run | Your own page at `yourname.monad.patched.world`, made for you. |
| Fixed prices, first come first served | Every spot is its own live auction, with a floor, a buy-now price and anti-snipe. |
| Brands paying before you deliver | Escrow. You are paid in steps, only after you post proof. If you don't show up, the brand is refunded. |

### Try it in a minute

1. Open [monad.patched.world](https://monad.patched.world), press **Sign in**, then **Use the demo account**. One tap signs you in as a brand with its own wallet, on test money only: no email, no seed phrase, no extension.
2. Open an event, tap a spot and bid. There is no wallet pop-up and no gas prompt. If someone outbids you, your USDC comes back in the same transaction.
3. On a spot, turn on **Auto-bid**. Settings → Security shows exactly what Patched may do, with a one-tap Revoke.
4. **Admin** (wallet menu) lets you approve listings during judging. Nobody can review their own listing or settle their own dispute.

The demo account can't add a passkey (it would lock out the next person); sign in with your own email or X to try that. Test USDC on testnet comes from Circle's faucet, token `0x534b2f3A21130d7a60830c2Df862319e593943A3`.

## Why Privy

A brand's marketing lead and a creator with an X following have one thing in common: neither wants a seed phrase. They want to sign in with X or email and tap **Bid**.

Privy let us keep everything crypto does well (instant payouts, escrow anyone can check, no bank in the middle) and hide the rest. **Every wallet, signature and payment on Patched goes through it**, and every key we own sits behind a Privy policy.

<p align="center">
  <img src="docs/images/who-signs-what.png" alt="Who can sign what: the user's Privy wallet, and Patched's keeper, campaign, offer and admin wallets, each with its own policy" width="100%">
</p>

## The eight ways we use Privy

Each one follows the same shape: the problem, the Privy piece that solved it, what you feel, and the proof on the explorer. The full table, with every limit we hit, is in [docs/privy.md](docs/privy.md).

### 1. Sign in like you already do

**The problem:** our users live on X and email, not in browser extensions.
**The Privy piece:** embedded wallets, behind a sign-in card we designed ourselves with Privy's headless hooks.

```ts
await initOAuth({ provider: "twitter" }); // Continue with X
await sendCode({ email });                 // or a 6-digit email code
```

**What you feel:** tap "Continue with X" and you're in. You have a wallet, a profile with your X name and picture, and your own page. Already use MetaMask? Keep it, or take a fresh Patched wallet for gas-free bids.
**What we learned:** we first gave every user an embedded wallet. MetaMask users ended up with a second, empty wallet. Now your wallet is the one you chose at sign-in, else the one you linked first.
**Code:** [WelcomeView.tsx](apps/web/src/app/welcome/WelcomeView.tsx) · [PrivyRuntime.tsx](apps/web/src/components/providers/PrivyRuntime.tsx)

### 2. Bid in one tap

**The problem:** a wallet pop-up and a gas fee on every bid would kill a live auction.
**The Privy piece:** gas sponsorship. The Privy wallet signs in the background, and Privy pays the network fee.

```ts
await sendTransaction({ to: MARKET, data, chainId }, { sponsor: true });
```

**What you feel:** tap Bid. No pop-up, no gas, no waiting on a wallet.
**What we learned:** we planned a USDC permit (one signature) and it failed with "invalid signature". Gas sponsorship gives each Privy wallet an EIP-7702 delegation, so USDC checks the permit as if the wallet were a contract. Now a Privy wallet approves the exact amount, then bids: two silent transactions, still one tap.
**Proof:** [a brand bidding from a Privy wallet](https://testnet.monadexplorer.com/tx/0x77d837d64256a20cb45fe02cbc3e1305ff977e4e87907b705eb884237666e92b), with no prompt and no gas.
**Code:** [useBid.ts](apps/web/src/lib/market/useBid.ts) · [permit.ts](apps/web/src/lib/market/permit.ts) · [useTx.ts](apps/web/src/lib/market/useTx.ts)

### 3. A keeper on a short leash

**The problem:** auctions end on their own, but a contract can't call itself. Something has to close bidding, pay each milestone and refund brands when a creator doesn't show. That means a key on a server, next to escrow.
**The Privy piece:** a Privy server wallet with a policy. It may call exactly four functions: `closeBidding`, `release` and `markFailed` on our market, and `execute` on our auto-bidder. Privy refuses anything else before it is signed.
**What you feel:** nothing, and that's the point. Auctions close on time, payments arrive after the review window, and no-shows are refunded without anyone pressing a button.
**What we learned:** put the action in the idempotency key, not the attempt. A retried run sends `release:<listing>:<milestone>` again, and Privy returns the first transaction instead of paying twice.
**Proof:** [the keeper closing an auction 8 seconds after it ended](https://testnet.monadexplorer.com/tx/0x2d1eb116841d9ce242685c4d32a4da0bfca97f3bb166e0ce47a807fdd7a34b19).
**Code:** [keeper.ts](apps/web/src/lib/server/keeper.ts) · [privy-policy-check.mjs](apps/web/scripts/privy-policy-check.mjs)

<p align="center">
  <img src="docs/images/keeper-policy.png" alt="The keeper's policy: four allowed calls" width="85%">
</p>

### 4. Auto-bid while you sleep

**The problem:** brands have meetings. Nobody can watch an auction all day, and we didn't want to lock their money in a contract just to bid for them.
**The Privy piece:** signers. Turning on auto-bid adds Patched as a signer on your own wallet, with a policy that allows only bids on the spots you chose, up to your maximum.

```ts
await addSigners({ address, signers: [{ signerId, policyIds: [policyId] }] });
```

**What you feel:** "Keep me on top up to $40." When someone outbids you, Patched bids the next step from your wallet within seconds, never above $40. Settings shows exactly what Patched may do, in plain words, with one Revoke button.
**What we learned:** always attach the policy when you add a signer; without one, the signer isn't limited. A higher maximum asks your wallet to approve again, while lowering one is instant.
**Proof:** [an auto-bid answering an outbid, from the brand's own wallet](https://testnet.monadexplorer.com/tx/0x28e3a8c5a43459d4e7b4b6cea90cc91fd99aed62febdb50f5c56074c5adc58b1).
**Code:** [useAutoBid.ts](apps/web/src/lib/market/useAutoBid.ts) · [autoBidPolicy.ts](apps/web/src/lib/market/autoBidPolicy.ts) · [autoBidSigner.ts](apps/web/src/lib/server/autoBidSigner.ts)

<p align="center">
  <img src="docs/images/auto-bid.png" alt="Auto-bid: Patched as a signer with a maximum, revocable in one tap" width="70%">
</p>

### 5. Campaigns with a budget Privy checks

**The problem:** big brands don't bid spot by spot. They say: "Spend up to $300 at Token2049, never more than $40 a spot, until the event ends."
**The Privy piece:** each campaign gets its own Privy server wallet and its own policy, written from those settings: bids only for the brand, at most $40 each, only until the end time. The $300 total is a Privy aggregation, a running total Privy checks before every bid.
**What you feel:** you fund the campaign once and it bids across the whole event for you, cheapest spots first. You can read its rules in plain words or as the raw policy. What's left at the end comes back to you.
**What we learned:** aggregations only count transactions Privy signs, not sponsored sends. So each bid is signed first as a budget check, and only then sent. Each campaign needs its own aggregation, and an app can have 10.
**Proof:** [a $10 campaign bidding, then Privy refusing the bid that would pass $10](https://testnet.monadexplorer.com/tx/0x2a5d3397c267b182a3daef0dce7f854b3713e681ece27e7303b7984a4891e1a3).
**Code:** [campaignPolicy.ts](apps/web/src/lib/market/campaignPolicy.ts) · [campaigns.ts](apps/web/src/lib/server/campaigns.ts) · [privy.ts](apps/web/src/lib/server/privy.ts)

<p align="center">
  <img src="docs/images/campaign.png" alt="A campaign with a budget and its Privy policy" width="70%">
</p>

### 6. Pay anyone on X

**The problem:** the perfect creator for a brand has often never heard of Patched. You can't pay someone who has no account and no wallet.
**The Privy piece:** pregenerated wallets. We look up the X handle's numeric id and create a Privy user with that X account linked and a wallet, before they ever sign up.

```ts
await privy.users().create({
  linked_accounts: [{ type: "twitter_oauth", subject: xUserId, username: handle }],
  wallets: [{ chain_type: "ethereum" }],
});
```

**What you feel:** a brand offers "$200 for a spot on your outfit at Token2049" to any X handle and shares it in one tap. The creator taps "Continue with X" for the first time, and the wallet and the offer are already theirs. If their wallet is empty, the offer even pays their listing stake.
**What we learned:** Privy links an X account by its numeric id, not its handle. Handles change; ids don't. Resolve the id on the server first.
**Proof:** [a $5 offer to an X handle, waiting in its own wallet](https://testnet.monadexplorer.com/tx/0x6172ae361a4dcfb6237339da6148e50a94409519a731297ed7f672d1c54e203f).
**Code:** [xOffers.ts](apps/web/src/lib/server/xOffers.ts) · [xLookup.ts](apps/web/src/lib/server/xLookup.ts) · [OfferView.tsx](apps/web/src/app/offers/[id]/OfferView.tsx)

<p align="center">
  <img src="docs/images/offer-to-x.png" alt="Patch anyone on X: an offer waiting in its own wallet" width="70%">
</p>

### 7. Trust for big money

**The problem:** once real money moves, people ask two things. Can a stolen session spend it? And is the brand behind this bid real?
**The Privy piece:** passkeys through Privy MFA, linked accounts, and wallet export.
**What you feel:**
- Bids of $1,000 or more ask for your passkey (Face ID, Touch ID or Windows Hello).
- "Verified brand" means something. A brand links a work email with a Privy code. If its domain matches the brand's website, the badge appears. Gmail doesn't count.
- Your wallet is yours. One button in Settings exports the key to any wallet.

**What we learned:** once a passkey is on, Privy asks for it before the wallet signs anything, then remembers it for a while. It isn't only for big moves. Privy's policy-based MFA, where a signer handles small bids and your passkey the big ones, is how we'll make small bids passkey-free again.
**Code:** [stepUp.ts](apps/web/src/lib/market/stepUp.ts) · [BrandVerify.tsx](apps/web/src/components/market/BrandVerify.tsx) · [SettingsView.tsx](apps/web/src/app/settings/SettingsView.tsx)

### 8. Judges in one tap

**The problem:** a judge has minutes, not days. They won't make an account, fund a wallet, then wait for an admin to approve a listing.
**The Privy piece:** a Privy test account behind a "Use the demo account" button, and a second server wallet for admin actions, with its own policy.
**What you feel:** one tap and you're signed in as a brand with a wallet, on test money only. You can even approve a listing yourself. That goes through a wallet whose policy allows only review actions: no pausing, no fees, no treasury, no upgrades. Nobody can approve their own listing.
**What we learned:** a shared account needs guard rails. The demo account can't add a passkey, export its key or link an email, so one visitor can't lock out the next. The same test account also signs in to our end-to-end UI tests on every run.
**Proof:** [a listing approved through open admin](https://testnet.monadexplorer.com/tx/0x11a6f46c18c70697cd9ee23007ee68471e39eac5b80b729cbd422a7cf30340ac).
**Code:** [api/admin/act](apps/web/src/app/api/admin/act/route.ts) · [demoAccount.ts](apps/web/src/lib/server/demoAccount.ts) · [api/demo-login](apps/web/src/app/api/demo-login/route.ts)

### If you're building on Privy

1. Make a Privy feature the product, not just the login. Our auto-bid is a signer. Our campaign is a policy. Our offer to an X handle is a pregenerated wallet.
2. Write policies from the user's own settings, and show them back in plain words. If people can read the rules, they trust them.
3. Name the action in idempotency keys, never the attempt.
4. Sponsored wallets and permits don't mix. Approve first.
5. Aggregations have sharp edges: sign-only, one total each, 10 per app, a 72-hour window, a few seconds of lag.
6. Use a test account from day one. Ours runs our tests and became the judges' demo.

Left out on purpose: card and bank on-ramps (Patched has no fiat) and transaction webhooks (Enterprise only, so notifications come from our own indexer and Supabase Realtime).

## The patch NFT that grows up

Winning a spot mints a **Living Patch**: an embroidered patch sewn onto the creator's fabric, with a woven label that carries the facts. The picture is drawn by the contract itself and redraws as the creator proves each step. It *is* the spot: its holder gets the refund and the right to dispute.

<p align="center">
  <img src="docs/images/living-patch.png" alt="The six stages of a patch NFT: won, printed, seen, delivered, refunded, disputed" width="100%">
</p>

- **Sponsor numbers.** "No.001, first sponsor of @mira": a public record of which brand backed which creator first.
- **Verifiable proofs.** Proof photos and the proof record are pinned to IPFS, and the hash in the contract is the hash of that record. Every patch has a page at `/patch/<token>` with a timeline and a button that fetches the proof, hashes it in your browser and compares it with the chain.
- **Resale with a royalty.** A patch can be resold on Patched while the creator is delivering; 5% goes to the creator. Tokens cannot move any other way.
- Thread colour shows the price (cotton under $100, silk to $999, gold from $1,000) and each listing's patches come in five shapes. Design and plan: [docs/nft-plan.md](docs/nft-plan.md).

## Verify it yourself

<details>
<summary><b>One full cycle on Monad testnet, 25 transactions</b></summary>

One full cycle ran on Monad testnet on 2026-10-02, with the Privy test account as the brand. Every step is on the
explorer; [docs/evidence.md](docs/evidence.md) has all 25 transactions.

| What | Privy feature | Transaction |
|---|---|---|
| A brand bids from a Privy wallet: no prompt, no gas | Embedded wallet, gas sponsorship | [0x77d837d6…](https://testnet.monadexplorer.com/tx/0x77d837d64256a20cb45fe02cbc3e1305ff977e4e87907b705eb884237666e92b) |
| A rival outbids; the brand is refunded in the same transaction | | [0x419332c5…](https://testnet.monadexplorer.com/tx/0x419332c5a9dde1b0b33bcfe5034208f4d98e9ab46e66077f59e8fb6448268e15) |
| Auto-bid answers within seconds, from the brand's own wallet | Signer with a policy (key quorum) | [0x28e3a8c5…](https://testnet.monadexplorer.com/tx/0x28e3a8c5a43459d4e7b4b6cea90cc91fd99aed62febdb50f5c56074c5adc58b1) |
| Two spots in one sweep, all or nothing | Sponsored gas | [0x0584ad7a…](https://testnet.monadexplorer.com/tx/0x0584ad7a9b11e03fbdbd79abef2585ed0aa5260501884665ad0febeb89f8d3a4) |
| A campaign bids for the brand; Privy refuses the bid that would pass the $10 budget | Server wallet, policy, aggregation | [0x2a5d3397…](https://testnet.monadexplorer.com/tx/0x2a5d3397c267b182a3daef0dce7f854b3713e681ece27e7303b7984a4891e1a3) |
| A brand offers $5 to an X handle; the money waits in its own wallet | Pregenerated wallets, policy | [0x6172ae36…](https://testnet.monadexplorer.com/tx/0x6172ae361a4dcfb6237339da6148e50a94409519a731297ed7f672d1c54e203f) |
| A listing approved by a non-admin through open admin | Policy-limited server wallet | [0x11a6f46c…](https://testnet.monadexplorer.com/tx/0x11a6f46c18c70697cd9ee23007ee68471e39eac5b80b729cbd422a7cf30340ac) |
| The keeper closes bidding 8 seconds after it ends | Keeper server wallet, policy | [0x2d1eb116…](https://testnet.monadexplorer.com/tx/0x2d1eb116841d9ce242685c4d32a4da0bfca97f3bb166e0ce47a807fdd7a34b19) |
| The holder disputes a proof; an admin splits it | | [0x3260057d…](https://testnet.monadexplorer.com/tx/0x3260057d7cd9f4ac083daddee507d7087855b2aa2e05141c53dc9989a1a41861), [0x6df7fed0…](https://testnet.monadexplorer.com/tx/0x6df7fed00c19f7f0829492eeaa2fd3dde069c79923539222fd4383df3c0ba023) |
| The last payout: the listing completes and the creator's stake comes back | Keeper server wallet | [0x99a160d6…](https://testnet.monadexplorer.com/tx/0x99a160d6999785850adf73d43818b1323e8d73888b6e506d1e89ef453d03f602) |

Re-run it: `apps/web/scripts/onchain-cycle.mts` (creator, admin and rival steps) and `apps/web/scripts/browser-steps.mjs`
(the brand, in a browser, as the Privy test account).

</details>

## Surfaces

| Surface | What | Proof |
|---|---|---|
| Outfit | A person at an event (for example Token2049) | Print photo, venue photos, an X post |
| Vehicle | A car, van or bus for 1 to 3 event days, parked at the venue or looping it | Dated, located photos each day, an X post |
| Team hoodie | A team at a hackathon, paid out across the team | Team check-in, stage or demo photos, an X post |
| Your own idea | Anything people will see at the event: a laptop lid on stage, a booth wall, a board | Photos with the logo in view, an X post |

## Features

<details>
<summary><b>For creators</b></summary>

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

</details>

<details>
<summary><b>For brands</b></summary>

- **One-tap bidding.** Tap a spot on the photo and a bubble shows the price, who leads and the last few bids. One button bids the minimum to take the lead. Quick chips add +$5, +$10 or buy it now.
- **Full bid sheet.** Enter a custom amount or buy the spot outright.
- **Auto-bid.** "Keep me on top up to $X." When you're outbid, Patched bids the next step for you within seconds, and never above your maximum. It shows "Paused" and tells you what to fix if your wallet runs out of USDC or of spending permission.
- **Sweep.** Pick several spots and bid on all of them in one tap. Either every bid lands or none do.
- **Instant refunds.** When you're outbid, your USDC comes straight back in the same transaction.
- **One-tap rebid.** The outbid toast has a "Bid $X" button that bids the new minimum in one tap.
- **Verified brand badge.** Link your work email. If its domain matches your website, your bids and patches show "Verified brand".
- **Brand profile.** Your brand name and logo appear on the patches you lead.
- **Campaigns.** "Spend up to $300 at Token2049, never more than $40 a spot, until the event ends." A campaign wallet bids across the event for you, cheapest spots first (or prime spots only), and returns what's left at the end. Its rules are a Privy policy you can read in plain words or as JSON, and Privy itself keeps the running total within the budget.
- **Patch anyone on X.** Offer money to any X account for a spot at an event, even if they've never used Patched. Privy creates their account and wallet on the spot; the offer waits in its own policy-limited wallet, can pay their listing stake if their wallet is empty, and buys their spot when they list. Share the offer on X in one tap.
- **Bids tab.** Spots you lead, spots where you were outbid, your receipts, and resale, on your profile.

</details>

<details>
<summary><b>Live auctions</b></summary>

- Every spot is its own auction, with a starting price, a buy-now price and a minimum step of +5% (at least +$5).
- **Anti-snipe:** a bid in the last 5 minutes adds 5 minutes to the whole listing, and everyone on the page is told.
- Live updates within about 2 seconds: prices, leaders and patches move on screen as bids land.
- "N watching now" through Supabase Realtime presence.
- **Bidding war** labels when brands trade the lead, plus recent activity on each spot.
- A live activity feed on every listing, and a live ticker on the landing page.

</details>

<details>
<summary><b>Escrow and trust</b></summary>

- **Paid only on proof.** Money is released in milestones (for example 40% after the print proof and 60% after the show-up proof), each only after proof is posted.
- **72-hour disputes.** Each patch holder can dispute a proof for their own patch within 72 hours. An admin settles it, and can split the payment between creator and brand.
- **No-shows are refunded.** If a creator misses a proof deadline, the unpaid escrow and the creator's stake go to the patch holders.
- **Creator record.** On-chain delivered and missed counts plus total earned, shown on every listing next to the stake and the payout plan.
- **Safe onboarding.** New creators have a spending cap until their first delivery, and listings are approved by an admin before bidding opens.
- **Living patch NFTs.** Winning a spot mints an NFT drawn on-chain as an embroidered patch with a woven label. It updates itself as the creator proves each step (won, printed, seen, delivered), is unpicked if the creator fails, and shows hazard tape while a dispute is open. It *is* the spot: its holder gets refunds and dispute rights. Each one has a public page at `/patch/<token>` with a timeline and a check that hashes the proof from IPFS and compares it with the hash on-chain.
- **Resale.** A receipt can be listed, bought or delisted on Patched, with a 5% royalty to the creator. Receipts can't move outside the market, so the royalty always applies.
- **Fallback payouts.** If a payment to a wallet ever fails, the money waits in the contract and the owner withdraws it. The market can be paused in an emergency.

</details>

<details>
<summary><b>Discovery and social</b></summary>

- **Home feed.** Signed in, `/` is a feed of new listings, bids ("Kite took Chest on Dhruv · $120", with Outbid) and proofs, with upcoming events, what's ending soon and search alongside.
- **Explore board.** Live listings with search, surface filters, bid counts and a live activity feed.
- **Events.** `/events` lists every event with its cover. `/e/<slug>` has the cover, venue and links, who's going, leaderboards (most sponsored, brand on the most spots, biggest bidding war), every spot and a live wall of bids. Admins edit the cover and details.
- **Notifications.** A live bell and a full `/notifications` page for outbid, new bid, auto-bid placed or paused, won, listing live or rejected, bidding closed, proof posted, dispute opened, payment made, no-show refund and resale sold.

</details>

<details>
<summary><b>Getting around</b></summary>

- **An app shell like X.** A slim sidebar (Home, Events, Explore, Activity, Profile and Create) that never reloads. Your name and dollar balance sit at the bottom; tapping it opens the wallet: Add money, My bids, Campaigns, Earnings, Settings, theme, network and sign out.
- **Phone navigation:** bottom tabs (Home, Events, Create, Activity, Profile) and your avatar at the top for the wallet.
- **A creator's page stands alone.** A listing page is the creator's own site with only a small "Made with Patched" mark, so sharing it on X feels like sharing a site they built.
- **Welcome.** New visitors sign in on a page that plays the whole story (sign in, draw spots, brands bid, show up, get paid) across outfits, vehicles and team hoodies, then pick a name, a handle (checked live) and whether they sell spots, sponsor or both.
- **Settings** (`/settings`): profile, brand (name, logo, website, verified badge), security (passkey, wallet export) and network, in one place.
- **Listing tools:** a creator's listing page, Manage screen and Share kit are tabs of one bar.
- **Testnet and mainnet:** each runs as its own site from the same code. A switch in the wallet panel and Settings moves between them and keeps you on the same page where it exists.

</details>

<details>
<summary><b>Admin</b></summary>

- Approve or reject listings. A rejected listing returns the creator's stake.
- Review proofs, fast-track milestones and settle disputes.
- Create events, and give each one a cover, venue, city, description and links.

</details>

<details>
<summary><b>Behind the scenes</b></summary>

- **Keeper.** A policy-limited Privy server wallet closes auctions when they end, releases payments after the review window, marks no-shows and runs auto-bids. It also runs campaigns. Every send carries an idempotency key, so a retry never acts twice.
- **Indexer.** Syncs every contract event into Supabase: bids, patches, receipts, payouts and notifications. It's rate-limited when called from the app.
- **Server-side AI.** All AI runs on the server through OpenRouter, with the cheapest model that does each job.
- **Themes and motion.** Light and dark themes. Every animation respects reduced-motion settings.
- **USDC only.** No banks or fiat anywhere: wallets hold USDC, and a test run on mainnet uses a TestUSD token with a daily faucet.

</details>

## Contracts

| Contract | What it does |
|---|---|
| `PatchedMarket` | Listings, per-patch auctions with anti-snipe, permit bids, escrow, milestones, proofs, disputes, no-show refunds, creator stakes and records, events, resale with royalties. Upgradeable proxy. |
| `PatchReceipt` | The Living Patch NFT for each won patch, with ERC-2981 royalties and ERC-4906 refresh events. It only moves through the market. |
| `PatchRenderer` | Draws each NFT's SVG and metadata from the market's state. Swappable, so the art can be fixed without touching a token. |
| `PatchAutoBidder` | Holds each brand's auto-bid maximum and bids for them. It never goes above the maximum. |
| `PatchSweeper` | Bids on several patches in one transaction, all or nothing. |
| `TestUSD` | A USDC-style test token with permit and a daily faucet, for the mainnet test run. |

| Contract | Monad testnet (10143) | Monad mainnet (143, TestUSD run) |
|---|---|---|
| PatchedMarket | `0x2AaC6f2E5221078982736F33271CD6484d0cd005` (proxy) | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` |
| PatchReceipt, Living Patch (listings 11 and later) | `0x6c406F518E5A863C3c536aD398BA67F8c8Ae5F3A` | not upgraded yet |
| PatchRenderer | `0xe8a5Ae9A1e801d26cD3cA1F8D95C6853349bcb86` | not upgraded yet |
| PatchReceipt, first version (listings 1 to 10) | `0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e` | `0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97` |
| PatchAutoBidder | `0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c` | `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` |
| PatchSweeper | `0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B` | `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba` |
| TestUSD (faucet token) | – | `0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f` |

The mainnet contracts are verified on Monad's Sourcify; the testnet ones are not yet. Testnet uses Monad's native USDC. The earlier testnet market (v2, not upgradeable) was `0xd3808dE425493934f036f8E77ef5a4de332e9552`. Details: [docs/contracts.md](docs/contracts.md).

## Tech stack

- **Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin v5.4, with unit, fuzz and invariant tests (120 passing).
- **Web:** Next.js (App Router), React 19, Tailwind CSS v4, Motion, NumberFlow, viem, Privy.
- **Data:** Supabase (Postgres, Storage, Realtime), with our own indexer in `packages/indexer`.
- **Storage:** proofs and photos on IPFS through QuickNode.
- **AI:** OpenRouter, through `packages/ai`, server side only.
- **Chain:** Monad testnet (10143) and Monad mainnet (143). Chain values live in config.

```
brandboard/
├─ contracts/         Foundry contracts and tests
├─ packages/shared/   ABIs, types, chain config and addresses
├─ packages/ai/       OpenRouter client and prompts
├─ packages/indexer/  Chain events → Supabase
├─ apps/web/          Next.js app
├─ supabase/          Database migrations
└─ docs/              Spec, contracts, design system, plans and evidence
```

## Run it

```bash
pnpm install
pnpm contracts:setup
pnpm contracts:test
cp .env.example .env.local   # then fill in the values
pnpm web:dev                 # the app on Monad testnet
pnpm web:dev:mainnet         # the app on Monad mainnet, http://localhost:3200
```

<details>
<summary><b>Testing the UI</b></summary>

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

</details>

## More

[Product spec](docs/SPEC.md) · [Contracts](docs/contracts.md) · [Design system](docs/design-system.md) · [Data model](docs/data-model.md) · [Agent guide](AGENTS.md)
