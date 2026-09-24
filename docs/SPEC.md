# Patched — product spec

## Roles

| Role | Who | Home screen |
|---|---|---|
| Visitor | anyone, not signed in | Landing |
| Creator | person or team selling patches | Studio |
| Brand | company or protocol bidding on patches | My bids |
| Admin | Patched team | Console |

A signed-in user can be both creator and brand; the nav shows what applies. Sign-in is Privy (X login + embedded wallet).

## Navigation (by role)

- Visitor: Explore · How it works · [Sign in] [Get patched]
- Creator: Explore · Studio · My page · Share · escrow chip · avatar
- Brand: Explore · My bids · USDC balance chip · avatar
- Admin: Console · Explore · avatar
- Everyone: light/dark toggle (light is the default).

## Pages

| Route | Page | Notes |
|---|---|---|
| `/` | Landing | hero with animated model, live ticker, 3 surfaces, how it works, escrow explainer, DIY comparison, CTA |
| `/explore` | Explore | grid of live listings, filter All / Outfits / Cars / Team hoodies |
| `/e/[slug]` | Event | event banner, countdown, listings at this event |
| `/[handle]` | Creator page | public profile; creator can change banner color and layout |
| `/[handle]/[listingId]` | Listing | the live auction page (see below) |
| `/studio` | Studio | create a listing: event → surface → photo → AI canvas → patch editor → prices → publish |
| `/studio/[listingId]` | Creator listing dashboard | milestones, proof upload, payouts, team split |
| `/bids` | Brand dashboard | bids, receipts (NFTs), resale, proofs to review, auto-bid rules |
| `/admin` | Admin console | events, moderation queue, proof review, disputes, stats |
| `/share/[listingId]` | Share kit | link-preview card, story card, QR, bio badge, X post templates |

## The listing page (most important screen)

- Left: the surface drawing (outfit / car / hoodie) with patches on top. Filled patch = has a leading bid (brand name or logo, pastel color, stitched border). Dashed orange patch = open. "Bought" patches are locked.
- Right, top to bottom: creator card; KPIs (countdown, USDC in escrow, patches with bids); **selected patch panel** (name, live price, leader, last bids, min next bid, Bid / Buy-now buttons, anti-snipe note); live activity feed.
- Click a patch → selects it. "Bid" opens the **bid sheet**: brand name, logo upload (previewed live on the patch), amount with +10/+50/+100 and Buy now, perks (gasless, one signature, auto-refund), Place bid, "Pay with card".
- Live updates: when anyone bids, that patch pings (expanding ring) and bounces, the new brand name slides in, the price rolls, the feed gets a row, the escrow total rolls up. If you were outbid: shake + toast "You got outbid on X · your USDC was refunded" with "Bid $Y".
- Buy-now: a SOLD stamp lands on the patch.

## Core flows

1. **Create listing** (creator): pick event (or "no event" for cars) → surface → upload photo → AI makes the white canvas → AI suggests patch spots → creator edits names, sizes, floor and buy-now prices → sets milestone plan (default by surface) → deposits bond ($25 min) → listing is *Pending*.
2. **Moderation** (admin): AI pre-screens the listing text and images (scam/NSFW/mismatch) → admin approves on-chain → *Active*.
3. **Bidding** (brand): gasless, approve+bid in one click via Privy batching (or USDC permit). Add funds by card or crypto through Privy.
4. **Close**: after the deadline a Privy server wallet calls `closeBidding` → winners get receipt NFTs → *Delivering*.
5. **Delivery**: creator submits proof per milestone → 72h dispute window → `release` pays creator (minus 5% fee), split across team payees if set.
6. **Dispute**: the holder of a patch's receipt can dispute that patch only; AI summarizes both sides and checks the proof photos; admin resolves (pay / refund / split).
7. **No-show**: missed proof deadline → `markFailed` → unreleased money back to receipt holders + creator bond split among them.
8. **Resale**: receipt holder lists the patch for resale while the listing is *Delivering*; buyer pays, creator gets 5% royalty.

## Milestone plans (defaults)

| Surface | Plan |
|---|---|
| Outfit | 40% after print proof (due before the event), 60% after venue proof (due event end + 3 days) |
| Car | equal weekly parts (4 weeks → 25% each), due at the end of each week + 2 days |
| Team hoodie | 40% print proof, 60% event proof (same as outfit) |

## Privy features we must show (bounty needs more than login)

Built; the README's "How Patched uses Privy" table links each one to its code.

1. X or email login + embedded wallet created automatically.
2. Gas sponsorship on Monad (per network: on for testnet, off for the mainnet TestUSD run).
3. One-signature bids: USDC permit signed silently + `bidWithPermit`.
4. Server wallet with a policy that may only call `closeBidding` / `release` / `markFailed` on the market and `execute` on the auto-bidder (the keeper).
5. Auto-bid ("keep me on top up to $X") through `PatchAutoBidder` + the policy-limited server wallet (session signers aren't enabled on our Privy app).
6. Sweep: several patches in one signature and one transaction (`PatchSweeper`).
7. Passkey MFA step-up for big bids, sweeps and auto-bid maximums.
8. Verified brands through a Privy-linked work email.
9. Wallet export.
10. Notifications from our indexer + Supabase Realtime (Privy transaction webhooks need the Enterprise plan).
11. Add funds (card or crypto) where Privy supports the network.

## Non-goals for the hackathon

KYC vendors, upgradeable contracts, mobile apps, surfaces other than the three above, streaming payouts (maybe later), Dutch auctions (maybe later).
