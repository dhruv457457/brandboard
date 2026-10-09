# 01 · The product, end to end

## The problem, and where it came from

People look at what you wear, drive and ship at an event. That attention is worth money, and there was no easy way to sell it.

Before Token2049, the creator [vanshu.eth](https://token2049.vanshu.fun/) offered brands the logo spots on her event outfit. The pitch deck says she sold 13 spots, raising $9,200 in under 48 hours, and her post got 1.5M views. It nearly broke her:

1. **Payments were rejected.** Brands paying from abroad hit international transaction rejections on Razorpay.
2. **She had to build and run a website** just to show the spots and take orders.
3. **Prices were fixed.** First come, first served. A brand ready to pay more could not outbid anyone.

Both sides are stuck in general. Brands pay up front and hope the creator shows up, with no proof the logo was seen. Creators make deals one at a time in DMs, and have no record of having delivered before.

Patched fixes all of it: USDC straight to a wallet, a page made for you, a live auction on every spot, and escrow that pays only on proof. Patched takes **1%**.

## The surfaces

| Surface | What | Paid | Proof |
|---|---|---|---|
| **Outfit** | A person at an event (Token2049, a hackathon) | Per event, in steps the creator picks | Print photo, venue photos, an X post tagging the brand |
| **Vehicle** | A car, van or bus for 1 to 3 event days, parked at the venue or looping it | Per event day | Dated, located photos each day, an X post |
| **Team hoodie** | A hackathon team; payout split across the team on-chain (up to 8 payees) | Per hackathon | Team check-in, stage or demo photos, an X post |
| **Your own idea** | Anything people will see: a laptop lid on stage, a booth wall, a board (on-chain it uses the outfit surface) | As above | Photos with the logo in view, an X post |

Code: `apps/web/src/lib/market/dealPlan.ts` (kinds, payout presets, deliverables menus), `packages/shared` (`Surface` enum).

## The loop

```
Creator lists ─► listing goes live in seconds ─► brands bid per spot (live auctions)
      ▲                                                     │
      │                                         bidding ends (keeper closes it)
      │                                                     ▼
 stake back ◄── last payout ◄── proof + review ◄── patch NFTs minted to winners
                    ▲                  │
                    └── 72 h to dispute┘   no proof by the deadline ─► brands refunded + creator's stake
```

### 1. Create a listing (Studio, `/studio`)

Four steps (`apps/web/src/app/studio/StudioEditor.tsx`, `STEPS`): **What → Spots → Deal → Page**.

- **What:** pick the surface and the event, upload a photo. AI (OpenRouter, server side) turns it into a clean white canvas with the background removed (`/api/ai/canvas`).
  - Outfits: AI suggests styles from the photo and makes front and back model shots in the chosen style (`/api/ai/styles`, `/api/ai/model-shot`).
  - Cars: from one photo AI generates the other sides (front, left, right, back, roof) so every panel can be sold (`/api/ai/car-view`).
- **Spots:** AI proposes where the patches go (`/api/ai/layout`); the creator drags, resizes and renames them. Each spot gets a floor price, a buy-now price and a tier: **Mega** (the largest), **Prime**, **Mini** (`lib/market/tiers.ts`). Up to 16 spots.
- **Deal:** how the creator is paid: part before the event for printing (10% to 50%), all after, per event day, or a custom split of up to 4 steps. A live payout bar shows the split and each proof deadline. The creator also picks what every brand gets (photos, parked hours, route check-ins, an X post), which brands see before they bid.
- **Page:** headline, intro, accent colour, background (a colour or a picture), which sections show.
- **Publish:** the app saves the listing JSON, approves the **stake** (a small bond: $5 on mainnet, $1 on testnet) and calls `createListing` on-chain (`lib/market/useCreateListing.ts`). The metadata's keccak hash is stored on-chain; the editable page layer (`listing_pages`) is off-chain and can change later.
- **Goes live by itself:** a Privy server wallet whose policy allows only `approveListing` moves each new listing from Pending to Active within seconds (`lib/server/autoApprove.ts`). Nobody reviews listings by hand; reported ones are hidden afterwards (see Moderation).
- **New-creator cap:** until a creator completes one listing, the sum of their buy-now prices is capped ($200 on mainnet).

### 2. Bid (the listing page, `/<handle>/<id>`)

- **Every spot is its own auction:** floor, buy-now, minimum step +5% (at least $1 on mainnet), and **anti-snipe**: a bid in the last 5 minutes adds 5 minutes to the whole listing (capped by a hard end).
- **Outbid = refunded in the same transaction.** No claiming.
- **One-tap bid:** tap a spot; a bubble shows the price, the leader and recent bids. One button bids the minimum to lead; chips add +$5, +$10 or buy it now. Each spot row in the list also has an orange **Bid** pill.
- **Brand check before the first bid on each listing:** a modal asks "go with this branding?" (or "create your brand" if the account has none). Name and logo go on the patch. Remembered per listing (`components/market/BrandSetup.tsx`).
- **Auto-bid:** "keep me on top up to $X" (see Automate below).
- **Sweep:** bid on several spots in one transaction, all or nothing (`PatchSweeper`).
- **Live:** prices and leaders update within about 2 seconds; "N watching now" through Supabase Realtime presence; "bidding war" labels; a live activity wall.
- **Car listings** are a road scene: the car sits large on a moving road, with the spots for the side you're viewing beside it, so you can bid without scrolling.
- **Printed look:** once bidding ends, each winning logo is cut out of its box (`lib/useKnockout.ts`) and blended into the fabric (`mix-blend-mode: multiply` plus an SVG print filter).
- **Comments** under every listing (one line each, max 280 characters, optionally about one spot) and **reactions** (fire, cheer, love).

### 3. Escrow, proof, payout

- At close (`closeBidding`, run by the keeper), winning bids become the escrow and **patch NFTs are minted** to the winners. Unsold listings return the stake.
- The creator posts proof per milestone in Studio: photos and the X post. Photos and a proof record are pinned to IPFS; `keccak256` of the record goes on-chain (`submitProof`).
- **72-hour review.** Each NFT holder can **approve** the proof (if every holder answers, payment doesn't wait) or **dispute** it. An admin settles a dispute, and can split the money. A dispute nobody settles in 30 days splits 50/50 (`settleStale`).
- **Release:** after the review window, the keeper calls `release`: the creator (or the team's payees) gets the milestone's share minus the 1% fee. The last milestone completes the listing and returns the stake.
- **No-show:** if a proof deadline passes, the keeper calls `markFailed`: unpaid escrow and the creator's stake go back to the holders.
- **Creator record:** delivered and missed counts plus total earned, on-chain, shown on every listing.

### 4. The patch NFT (Living Patch)

- A trading card drawn **by the contract** (`PatchRenderer`) and redrawn as the creator proves each step: **Won → Printed → Seen n/m → Delivered**, or grey and unpicked if **Refunded**, or hazard tape if **Disputed**.
- **Sponsor numbers:** "No.001, first sponsor of @creator".
- **Frames by price:** cotton under $100, silk to $999, gold foil from $1,000. Five patch shapes; outfits, cars and hoodies each have their own drawing.
- **It is the spot:** the holder gets refunds and dispute rights. It can be resold on Patched while the creator delivers, with 5% to the creator. It can't move any other way.
- **Every NFT has a page** at `/patch/<tokenId>`: the card (glowing, tilts in 3D toward the cursor), a timeline with explorer links, a "check the proof" button that fetches the proof from IPFS, hashes it in the browser and compares it with the chain, resale, and back links to the listing and the creator.
- On the website the card also shows the brand logo and the creator's face, and takes names from Patched profiles (the creator's handle, the brand's name), since the chain keeps one name per wallet. The on-chain image has neither the photos nor those profile names.
- Code: `contracts/src/PatchRenderer.sol`, `apps/web/src/lib/patchCard.ts` (same card on the web), `lib/nft/token.ts`, `components/nft/TokenCard.tsx`, `components/nft/Tilt.tsx`, `app/patch/[tokenId]/`.

## The pages

### Signed out: landing and sign-in

- `/` signed out is the landing page (`app/LandingView.tsx`), kept calm: the story, live listings and a sign-in button.
- `/welcome` is sign-in in our own design (Privy headless hooks; details in [02-privy.md](02-privy.md)), with "Recommended" on Sign in with X. It plays the whole story (sign in, draw spots, brands bid, show up, get paid), then asks for a name, a handle (checked live) and a role: sell spots, sponsor, or both.
- "Use the demo account" signs a judge in as a brand in one tap, on play money only.

### The app shell

- **Desktop:** a sidebar like X (`components/navigation/Sidebar.tsx`): Home, Events, Explore, Activity, Profile, then (signed in) **Automate, Campaigns, Earnings, Patch NFTs**, a Create button, a theme button (light/dark), the **network toggle** (testnet/mainnet), and your name and dollar balance. Tapping it opens the wallet panel: Add money, My bids, Settings, theme, network, sign out.
- **Phone:** bottom tabs (Home, Events, Create, Activity, Profile) and your avatar at the top for the wallet.

### Home (`/`, signed in)

- **Feed | Patchwork** switch. Feed (`app/HomeFeed.tsx`): new listings (with likes, comments inline and a road for cars), bid moments ("Nike unseated Kite and took Chest on Dhruv · $120", with an **Outbid** button), proofs, spotted photos. It refreshes every 20 seconds and shows "new posts". A Following filter. The side column has upcoming events, what's ending soon and search.
- **Patchwork:** the live on-chain graph of one event. See [05-patchwork-graph.md](05-patchwork-graph.md).

### The creator's own page (the personal page)

- **`<handle>.monad.patched.world`** is the creator's site: their colours, headline, story, every view of the outfit or car, the spots and live bids, and only a small "Made with Patched" mark. Sharing it on X should feel like sharing a site they built. Listing 16 of `dhruv` is `dhruv.monad.patched.world/16`. "Copy link" copies that short address.
- The creator edits it in place: headline, intro, perks per spot, section titles, accent colour, background, FAQ (`listing_pages`, `lib/market/page.ts`).
- **Share kit** (`/share/<listingId>`): poster templates, a QR code, downloadable images, a ready X post, and the link preview image every listing gets.

### Profile (`/<handle>`)

Tabs (`app/[handle]/ProfileView.tsx`; `?tab=` opens one directly):

| Tab | Who sees it | What |
|---|---|---|
| Listings | everyone | the creator's listings |
| Collection (`sponsoring`) | everyone | patch NFTs this wallet holds and spots it sponsors |
| Sponsors | everyone, when there are any | NFTs of brands that sponsored this creator |
| Campaigns | owner | their campaigns |
| Earnings | owner | what needs doing (proofs due), payouts, totals (the old dashboard) |
| Bids | owner | spots they lead, spots where they were outbid, receipts, resale |

The header shows X reach (followers, refreshed daily from the X account Privy links), followers/following, a Follow button, "Sponsors as <brand>" for brands, and a verified badge.

### Automate (`/automate`)

One page for the three ways to let Patched bid for you, opened with a "Which one do I need?" guide and an example for each (`app/automate/AutomateView.tsx`):

| Tool | Say it like | How it works |
|---|---|---|
| **Auto-bid** (`#auto-bid`) | "Keep me on top of this spot up to $40" | Patched becomes a signer on your own Privy wallet, limited by a policy to bids on that spot up to your maximum. When you're outbid, the keeper bids the next step within seconds. Revoke in one tap in Settings → Security. Outside wallets (MetaMask) use the `PatchAutoBidder` contract instead. |
| **Campaign** (`#campaign`) | "Spend up to $300 at Token2049, never more than $40 a spot, until the event ends" | A Privy server wallet with its own policy bids across the event for you: the most spots, cheapest first, or prime spots only. Privy itself keeps the running total under the budget. What's left goes back at the end. |
| **Patch anyone on X** (`#x-offer`) | "Offer @someone $50 to wear our logo at Token2049" | Privy pregenerates an account and wallet for that X handle. The offer waits in its own policy-limited wallet, can pay their stake, and buys their spot when they list. Share it on X in one tap. |

Details: [02-privy.md](02-privy.md).

### Events (`/events`, `/e/<slug>`)

Each event has a cover, venue, city, about text and links; who's going; leaderboards (most sponsored creator, brand on the most spots, biggest bidding war); every spot; a live wall of bids; a Spotted wall; and a Patchwork button (`/e/<slug>/patchwork`, public). Admins edit the cover and details.

Events today (testnet): Token2049 Demo (#1), Metropolis Buenos Aires (#2), Monad Open Singapore (#3), Token2049 Singapore (#4), Get Patched Week Mumbai (#5). Cars use event 0 ("On the road").

### Explore (`/explore`)

Live listings with search, surface filters, bid counts and a live activity feed.

### Activity (`/notifications`)

A live bell and a full page. Notifications come from two places:

- **The indexer** (on-chain events, `packages/indexer/src/index.ts`, `notify`): `outbid`, `new_bid`, `auto_bid`, `listing_live`, `listing_rejected`, `bidding_closed`, `won`, `proof_submitted`, `bid_forwarded`, `disputed`, `proof_approved`, `paid`, `listing_failed`, `resale_sold`. One per (event, wallet, kind), so replaying blocks never duplicates them.
- **The app** (off-chain): auto-bid paused (no USDC or allowance; at most once an hour per spot), comments on your listing, spotted photos of you, offers to your X handle.

The page updates live through Supabase Realtime (`lib/notifications.ts`). Privy transaction webhooks need the Enterprise plan, so we use our own indexer instead.

### Settings (`/settings`)

Profile; brand (name, logo, website, **verified brand** by work email); security (passkey, wallet export, auto-bid permissions with Revoke); network.

### Contest (`/contest`)

Get Patched Week. See [06-community-and-traction.md](06-community-and-traction.md).

### Admin (`/admin`)

Reported listings and spotted photos (hide, restore); proofs (fast-track, settle disputes); events (create, cover, venue, links). On play money anyone signed in can use it, on purpose (see [02-privy.md](02-privy.md#open-admin-on-purpose)).

## Social features

| Feature | Detail | Code |
|---|---|---|
| Follow | creators, brands and events; Following feed on Home | `api/follows`, migration 0020 |
| Reactions | fire, cheer, love (lucide icons, never emojis) on spotted photos and listings; a spring pop and a small burst; counts roll | `components/social/Reactions.tsx`, `api/reactions`, migrations 0022, 0028 |
| Comments | one line, 280 characters max, about the listing or one spot; author or creator can remove; creator notified; inline on the feed (last 3) | `components/social/Comments.tsx`, `api/comments`, migration 0027 |
| Spotted | anyone at an event posts a photo of a patched creator. **On-chain**: `PatchSpotter.spot()` with the photo on IPFS (one per wallet per listing, gas-sponsored for Patched wallets). Shows on the event, the listing and the profile; the creator is notified | `components/social/SpottedWall.tsx`, `api/spotted`, `api/spotted/pin`, `contracts/src/PatchSpotter.sol` |
| Reports | spam, scam, inappropriate, copyright, other. When 3 different people report the same thing (`AUTO_HIDE_AT`), it is hidden at once; admins hide or restore. Hiding only takes it out of the app: bids and escrow follow the contract as before | `api/reports`, `lib/server/moderation.ts`, migration 0025 |

## Network switch

The sidebar toggle (and the wallet panel and Settings) moves between testnet and mainnet. Going to mainnet opens a modal: "Mainnet uses real USDC". The address doesn't change; only the chain does. How: [04-infrastructure.md](04-infrastructure.md#one-domain-two-chains).

## Design

Paper background, ink outlines, hard shadows, pastel patches, Bricolage headlines, the orange accent `#FF5A1F`, light and dark themes, motion everywhere with `prefers-reduced-motion` respected, no emojis. Full system: [../design-system.md](../design-system.md).
