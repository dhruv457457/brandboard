# Research handoff — 2026-09-24

This came out of a research and planning session with no code changes. Read it together with AGENTS.md and docs/SPEC.md. Where it conflicts with SPEC.md, the **Decided** section wins. Everything under **Proposed** still needs the user's yes before it gets built.

## Decided

- **Primary track: Social, Attention & Culture.** The judges will look for social graphs, community ownership and cultural participation, so the social layer matters for the score.
- **Only one sponsor bounty: Privy** ($5k, all tracks). Its rule: *"Integrate Privy beyond authentication — login-only integrations will not qualify."* Every other bounty is dropped: Nansen, Chainlink CRE, Aurora Intents, Alchemy, Mera, Dynamic, Envio, Hunyuan, Kimi and Qwen.
- **No real-world event run** (TOKEN2049 Singapore etc.). The demo runs on our own deployments.
- **Three focus areas**, in the user's words:
  1. A creator page and share page that can be customized like Canva: templates, fonts, and editing your own page.
  2. Using Privy much more deeply.
  3. A more competitive bidding system.

## What the codebase does today (checked on 2026-09-24)

**Pages**
- Share kit, [apps/web/src/app/share/[listingId]/ShareKit.tsx](../apps/web/src/app/share/[listingId]/ShareKit.tsx): 3 fixed X-post text templates, one link-preview image and a QR download. Nothing can be customized.
- Creator page, [apps/web/src/app/[handle]/ProfileView.tsx](../apps/web/src/app/[handle]/ProfileView.tsx): banner color and bio only, plus listings and on-chain reputation.

**Unused tables**
- The `posts` and `notifications` tables are in docs/data-model.md, but no code uses them. There's no social layer yet: no feed, follows, comments or notifications.
- The `auto_bid_rules` table has no code behind it.

**Privy**
- Already used: X login with an embedded wallet, and native gas sponsorship (`sponsor: true`) on Monad in `lib/market/useBid.ts` and `lib/server/keeper.ts`.
- The keeper sends through a Privy server wallet with `@privy-io/node` 0.35 (`privy.wallets().ethereum().sendTransaction(walletId, { caip2, sponsor: true, authorization_context })`). Its Privy policy only allows `closeBidding`, `release` and `markFailed`.
- Bidding uses a **USDC permit plus `bidWithPermit`**, which is one signature and one gasless tx. It does not batch approve+bid, though SPEC.md says it does.
- Not built yet: card onramp, session signers (auto-bid), webhooks, passkey step-up.

**Contracts**
- `Surface` is only a label in the contracts: it's used in the receipt NFT's name and traits and has no money logic (`contracts/src/PatchReceipt.sol:167`).
- On mainnet, new creators are capped at $200 total buy-now (`newCreatorCap`).

**Other**
- The admin page checks the admin role in the browser (`hasRole(ADMIN_ROLE)` via `readContract`). Admin actions are on-chain, so the contract enforces them anyway.
- `next/font/google` is already used in `app/layout.tsx` (Bricolage Grotesque, Geist, Geist Mono, Caveat).
- `@patched/ai` has `suggestStyles`, exposed at `/api/ai/styles`.

## Known problems

1. **Brands can impersonate others.** Anyone can bid as "Coinbase" with Coinbase's logo, and creators can't refuse a brand.
2. **Waiting to bid wins.** There's no reason to bid before the last 5 minutes, and losing a bid gets you nothing.
3. **Nothing after "proof submitted."** There's no print-ready file of the winning logos for creators and no report for brands.
4. **The share page is thin**, which the user flagged.

## Proposed: focus 1, the customizable creator page and share studio

**What the page is.** One link per creator (`/[handle]`), a live auction and a media kit on one page:
- **Top of the page:** cover photo, name in the chosen display font, verified X handle, and three stats (earned, completed, spots).
- **Live listing block, always first:** the existing `SurfaceFigure` with live patch bids and a Bid button.
- **A grid of blocks** in three sizes: S = 1×1, M = 2×1, L = 2×2. Desktop has 4 columns and phones have 2.
- **Block types:** "Worn by" logo wall (from receipts), past listings, proof photos, links, upcoming events, text, "Pitch me".

**How editing works.** The creator edits on the page itself, like Partiful, not in a separate builder:
- "Edit page" switches the same URL into edit mode.
- Click the title to get a font picker. Drag to reorder blocks (`dnd-kit`), switch a block between S/M/L, and add blocks from a "+" menu.
- A theme panel (a bottom sheet on phones) has tabs for Templates, Colors, Fonts, Background and Effects.
- Drafts autosave, with Publish to go live and a phone/desktop preview.
- We looked at **Puck**, an MIT-licensed drag-and-drop page builder for React (12k+ stars). Recommendation: **don't use it.** Its sidebar-builder style fights the edit-on-the-page feel, and we only have about 8 block types.

**Templates.** Each one sets the display and body fonts, the palette (background, surface, ink, accent), corner radius, border width, shadow (hard, soft or none), background (solid, grain, grid, dots, gradient or photo), patch style (stitched, sticker or embroidered) and one effect. Suggested set: Paper (current design), Terminal, Stadium, Riso, Streetwear, Zine, Y2K Chrome, Pastel Patch.

**Fonts.**
- A curated set of about 14 Google Fonts, each with a matching body font.
- Declare them with `next/font/google` and `preload: false`, so a font is only downloaded when a page uses it, and it's served from our own domain.
- Pick a title size (S, M or L) and case (as typed or UPPERCASE).
- Letting people choose any Google Font is a later idea.

**Colors.**
- The creator picks one accent and the rest of the palette is derived from it in OKLCH.
- A WCAG contrast check keeps text readable.
- "Match my photo" pulls a palette from the uploaded photo in the browser. `suggestStyles` can optionally suggest a template.

**Where the data lives.**
- Add a `page` jsonb column to `profiles`: `{ version, template, theme: {...}, blocks: [{ id, type, size, props }] }`, validated with zod on the server.
- The theme is applied as CSS variables scoped to the page wrapper. Inside the page, the creator's theme wins over the site's light/dark toggle; the site nav keeps the site theme.

**Share studio (the Canva-like part).**
- Built on `react-konva`, which the patch editor already uses.
- Sizes: X card 1200×630, story 1080×1920, square 1080×1080, and a printable QR sticker sheet.
- Users can move and resize text, swap fonts and backgrounds and add stickers (lucide icons, patch shapes), then export a PNG, copy it or post it.
- Templates follow the auction's state: Launch, Bidding war, Last hour, Sold out, Got patched (thanks the brand), Delivered (proof photo).
- The link preview (`opengraph-image`, rendered with `next/og`) uses the same theme tokens. `next/og` needs TTF/OTF/WOFF, not WOFF2, so fetch the chosen font inside the handler; Google Fonts can return a subset with `text=`. On the Edge runtime the bundle must stay under 500KB.
- **Remix:** a "Use this style" button on any page copies that theme onto yours with credit ("Style by @mira"). This is part of the social layer.

## Proposed: focus 2, deeper Privy use (the bounty)

In priority order:

1. **Auto-bid through session signers.**
   - The brand sets a maximum.
   - One gasless tx approves that much USDC for the market contract.
   - `useSigners().addSigners({ address, signers: [{ signerId: <key quorum id>, policyIds: [<autobid policy>] }] })` gives our server permission to bid.
   - When the indexer sees a `BidPlaced` that outbids a brand with an active rule, the keeper calls `bid()` using the same `sendTransaction` + `authorization_context` pattern it already has.
   - The Privy policy allows `eth_sendTransaction` only when `to == MARKET` and the call is `bid`.
   - The USDC allowance enforces the maximum on-chain, so the limit is enforced twice.
   - The signer is removed when the rule ends. This finally uses the `auto_bid_rules` table.
2. **Sweep with batched calls.**
   - Several patches, one confirmation, gasless, and all-or-nothing.
   - Privy documents `wallet_sendCalls` with `sponsor: true`: the wallet is upgraded through EIP-7702 to a Kernel smart account.
   - The docs show this on the server (`privy.wallets().ethereum().sendCalls`). **The browser-side API is not verified yet.** If it's missing, run the sweep on the server with the auto-bid signer.
3. **Add funds.**
   - Use `useFiatOnramp` (card, Apple Pay, Google Pay through Stripe, Coinbase, MoonPay or Meld) or `useDepositFunds` (card or crypto from other chains).
   - **Catch:** Monad isn't a listed onramp destination, and testnets fail even in sandbox mode.
   - Options: buy USDC on Base by card, then move it with Circle CCTP V2 (which supports Monad); or show the sandbox flow (`environment: 'sandbox'`, card 4242…) for the demo.
4. **Passkey step-up** for large bids (for example over $1k) through Privy MFA with passkeys.
5. **Verified brands:** the brand links a work email through Privy. If the email domain matches the brand's website, it gets a Verified badge. This fixes impersonation.
6. **Our own wallet screens:** turn off Privy's confirmation pop-ups and use our bid sheet instead.
7. **Webhooks:** use Privy user webhooks to create profiles. Transaction webhooks only cover server wallets and need Privy's Enterprise plan in production, so outbid and closing alerts come from our indexer plus Supabase Realtime.

**Suggested 60-second Privy demo:** X login → add funds → sweep 3 patches in one gasless click → set auto-bid → another brand bids and the auto-bid answers within a second → passkey check on a large buy-now → the server wallet closes bidding.

### Privy bounty: official criteria (from the Metropolis dashboard)

- **Prize:** $5,000, one winner, open to all tracks.
- **Rule:** "Using Privy only for login/authentication will not qualify."
- **What the judges want:** (1) a demo that clearly shows what Privy powers; (2) bonus points for meaningfully using several Privy features.
- **Deliverable:** a project with a demo that clearly shows Privy-powered features beyond login.
- **What this means for us:** every Privy feature needs its own visible moment in the demo video, and the README needs a "How Patched uses Privy" table linking each feature to the file it lives in.

## Proposed: focus 3, a more competitive bidding system

The DeFi question: each track is judged on its own and there's no bonus for touching DeFi. A good mechanism still raises the technical-execution and originality scores, and the Social track's own brief talks about "programmable incentives." Present it as incentives for attention, not as a DeFi project.

In priority order:

- **A. Outbid rewards (GBM auction style). This needs a contract change.**
  - Used on-chain before by Aavegotchi, The Sandbox, Decentraland and Unstoppable Domains.
  - When you're outbid, you get your bid back plus a reward: a share of how much the new bid went up (suggested 50%).
  - At close, the creator receives the final bid minus all rewards paid.
  - Because a reward is always smaller than the step, the creator's take only goes up with each bid.
  - Outbidding yourself with a second wallet just raises your own price, so there's nothing to farm.
  - Bidding early now pays and bidding wars get fiercer. Tagline: "Get outbid. Get paid."
  - Needs contract v3: `bid()` pays `prevAmount + reward` and tracks rewards per patch, and payout = `topBid − rewards`. Then redeploy on testnet and mainnet, run `forge test`, regenerate the ABIs and update docs/contracts.md.
- **B. Auto-bid** (the Privy signer above). Works like eBay's maximum bid.
- **C. Sweep and Takeover** (Privy batching). Bid on several patches at once, or buy every patch on a listing at one price.
- **D. Crowd patch.** A community pools USDC and bids together, like PartyBid. A small pool contract is the bidder: refunds come back to the pool and members claim their share. This is the strongest "community ownership" story for the Social track.
- **E. "Call it."** Viewers predict each patch's final price for free and earn points and a leaderboard spot. It matches the track's "prediction markets on cultural events" line without gambling.
- **F. Make the auction feel alive:** a bidding-war state, a heat meter, a price chart per patch, a "watching" count, and a one-tap rebid when you're outbid.

**Skip for now:**
- **Interest on escrowed USDC:** about $1 on $500 over two weeks, not worth the vault risk.
- **Always-for-sale ownership (Harberger):** good for digital patches later, bad for printed ones, because every forced sale means reprinting.
- **Random auction endings:** the anti-snipe rule already stops last-second bids, and a random end confuses brands.
- **Dutch auctions:** maybe later for unsold patches.

## Other ideas from the session (ideas only, not approved)

- **Pitches:** anyone proposes a sponsorship idea, people upvote it, brands press "I'd back this", and one click turns it into a listing.
- **Briefs:** a brand asks first ("10 hoodies at event X, $100 each") and creators apply. It can run on the current contract through a buy-now at the brief price.
- **Spotted:** the QR on a patch lets people at the event scan it and post a photo. Photos become proof, give brands real impression counts and earn the spotter a place on a leaderboard.
- **Orbit:** the car loops the venue with live check-ins on the event page's map.
- **More formats** (laptop lid, cap, auto-rickshaw, X banner): add a format field to the listing metadata, plus an `Other` value in the contract.
- **Social basics:** follows, "watch this listing", notifications, brand pages ("We're on 12 people"), event hubs, creator media-kit download.
- **Trust:** creators set rules per listing ("no memecoins, no gambling"), AI screens logos, and the creator approves the logo before printing.
- **After the auction:** a print pack of the winning logos at print size, and a report for brands.

## Market facts for the pitch

- People already pay for moving ads. Wrapify pays drivers about $181–462 a month; Carvertise pays $100–300 a month for 30+ miles a day. Vehicle-wrap advertising brought in about $3.8B in 2023.
- **What sets Patched apart:**
  - Those companies set fixed prices; we use an open auction for each spot.
  - They sell months-long contracts; brands here can buy a single event.
  - Money sits in escrow and is only released on proof.
  - Any brand size can take part, from a $20 patch.
  - Creators anywhere get paid in USDC.
  - It covers people and teams, not just cars.

## Hackathon facts

- The deadline is Oct 13 2026, 11:59 PM ET (Oct 14 09:29 IST). The submission can be edited until then. Judging runs Oct 14–27 and winners are announced Nov 3.
- Judges must be able to verify what was built during the six weeks.
- Scoring weights (from AGENTS.md): technical execution 20%, design 20%, originality 15%, founder/market readiness 25%, traction 20%.
- Each bounty's submission fields only appear after you create the project. The user will paste the Privy fields when they have them.

## Open decisions for the user

1. Outbid rewards: yes or no? It means contract v3 and a redeploy on both networks. Is 50% of the step the right rate?
2. Page editor: our own edit-on-the-page editor (recommended) or Puck?
3. Add funds on testnet: demo the sandbox flow, or do a small real purchase on mainnet?
4. Which of A–F in focus 3, and which of the other ideas, make it into the remaining ~19 days?

## Sources

- **Privy:** [signers](https://docs.privy.io/wallets/using-wallets/signers/quickstart.md) · [policies](https://docs.privy.io/controls/policies/overview.md) · [batch transactions](https://docs.privy.io/recipes/batch-transactions.md) · [EIP-7702](https://docs.privy.io/recipes/react/eip-7702) · [card onramps](https://docs.privy.io/wallets/funding/fiat-onramp) · [useDepositFunds](https://docs.privy.io/wallets/funding/use-deposit-funds.md) · [transaction webhooks](https://docs.privy.io/wallets/gas-and-asset-management/assets/transaction-event-webhooks.md) · [docs index](https://docs.privy.io/llms.txt)
- **Hackathon and USDC:** [Metropolis](https://monad.xyz/developers/hackathons/metropolis) · [Circle CCTP V2 on Monad](https://www.circle.com/blog/usdc-cctp-v2-circle-wallets-and-circle-contracts-are-coming-soon-to-monad-what-you-need-to-know)
- **Auctions:** [GBM auction](https://gbm.auction/) · [GBM explained](https://medium.com/cryptograph/incentivised-bidding-the-gbm-auction-c6dae5a756e5) · [Harberger taxes on Ethereum](https://yos.io/2018/11/18/harberger-taxes/) · [candle auctions](https://medium.com/moonbeam-network/how-polkadot-parachain-auctions-work-59745e934ae5)
- **Page editor and fonts:** [Puck](https://puckeditor.com/docs) · [Partiful title fonts](https://help.partiful.com/hc/en-us/articles/29525951144219-How-can-I-customize-the-title-font-on-my-event-page) · [Bento.me](https://linkinbiotools.com/bento-me/) · [custom fonts in OG images](https://vercel.com/kb/guide/using-custom-font)
- **Market:** [Wrapify](https://wrapify.com/drive/) · [Carvertise](https://carvertise.com/drivers/) · [vehicle wrap advertising stats](https://gitnux.org/vehicle-wrap-advertising-statistics/)
