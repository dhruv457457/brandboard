# 07 · Business, go-to-market, and what comes next

## Business model

| Revenue | How | Where it's enforced |
|---|---|---|
| **1% of every sale** | taken from each milestone payout (`feeBps = 100`) | `PatchedMarket.release`, to the treasury |
| Resale royalty, 5% | goes to the **creator** (or the team's payees), not to Patched; a reason for creators to want their patches traded | `buyResale` |

Each listing keeps the fee it was created under, so a later fee change never hits a running deal.

Example: a creator sells 6 spots at an event for $1,200 in total. Patched earns $12. The creator gets $1,188 in steps as they post proof. If a brand later resells its patch for $300, the creator earns $15 more.

Why a low fee works: there's no payment processor, no chargebacks, no manual ops per deal. The keeper, the escrow and the AI setup are automated, and Monad gas is cents, sponsored through Privy.

**Later revenue ideas** (not built): a featured spot on an event page for brands; campaign management for agencies (a small % of campaign budgets); event-organiser plans (Patchwork on the venue screen, all creators at an event in one place).

## Who it's for

| Side | First users | What they want |
|---|---|---|
| Creators at events | crypto creators going to Token2049, ETHGlobal, Monad events; anyone with an audience who'll be seen | money for attention they already have, without building a site or chasing payments |
| Hackathon teams | teams at ETHGlobal and similar | a team hoodie sponsor, paid out across the team automatically |
| Vehicle owners | cars, vans, buses parked at or looping a venue | per-day pay for being seen |
| Brands | web3 teams that already sponsor events | many small, visible placements with proof, paid only on delivery, in USDC |

Why web3 first: brands already hold USDC, events are dense and frequent, and creators there already have wallets or are happy with X sign-in.

## Go-to-market

The plan in the pitch deck, with what each step means in practice:

### Now (October): prove it with real people
- **Get Patched Week** contest, Oct 8–11 ([06-community-and-traction.md](06-community-and-traction.md)).
- **Build in public** on X (@Patched_world, @dhruvpanch0li) and in the Telegram group: ship notes, demos, the Privy write-up.
- **Bring creators we know:** the founder's own circle, starting with the creator on the team (70M+ Instagram views).
- **Real USDC on Monad mainnet:** one real cycle with explorer links.

### Next (Nov 5–7): ETHGlobal Mumbai
- Hacker teams sell team-hoodie spots; creators list event outfits.
- On the ground: printed QR codes that open Studio with the event preselected ("List your fit in 3 minutes"). Spotted photos from attendees. Patchwork on a screen.
- Brands bid live during the event; payouts land as proofs come in, so the loop completes within the event.

### Then (2027): every big crypto event
- Brands run **campaigns** across a whole event ("$300 at Token2049, never more than $40 a spot").
- **"Patch anyone on X" pulls creators in:** a brand offers money to a handle and shares the offer on X tagging them; the creator signs in with X, and the wallet and the offer are already theirs. Each offer is acquisition paid for by the brand.

### The growth loops built into the product
1. **Every listing is an ad for Patched.** The creator shares their own page (`handle.monad.patched.world`) on X with a link preview, poster and QR from the share kit. It has a small "Made with Patched" mark.
2. **Brands recruit creators** through "Patch anyone on X".
3. **Attendees join through Spotted.** Seeing a patched creator, posting a photo, appearing on Patchwork.
4. **Patchwork share cards:** "I'm #2 most connected at Token2049".
5. **Patch NFTs with sponsor numbers** ("No.001, first sponsor of @creator") are a public record brands want to show.

### Positioning against what exists

| Alternative | What it lacks |
|---|---|
| DMs and spreadsheets (how vanshu.eth did it) | payment rejections, a website to build, fixed prices, no trust |
| Influencer marketplaces | built for posts, not physical attention; fiat, slow payouts, no escrow on proof |
| Event sponsorship packages | one big buyer, no live price, no per-spot proof |
| Track 3 rivals ([../track3-competitors.md](../track3-competitors.md)) | all digital markets (post tokens, boosts, tickets); none prices real-world attention; Privy used mostly for login; almost none on mainnet |

**Our edge:** physical attention as a live market, escrow that pays on proof, an on-chain record per creator, NFTs that grow with delivery, and Privy used deeper than anything else in the track.

## Team

The pitch deck lists three people:
- **Dhruv Pancholi:** builder; 10+ hackathon wins; incubator graduate.
- **Suhani Sharma:** outreach; Network Analyst at Rogers, Canada.
- **Ananya Pancholi:** creator; 70M+ Instagram views.

Day to day, Dhruv builds and markets alone right now, so every plan here should work for one person.

## Before submission (deadline Oct 14, 09:29 IST; submit Oct 12)

| # | Task | Who | State |
|---|---|---|---|
| 1 | Turn on Privy gas sponsorship for Monad mainnet (dashboard) | Dhruv | to do |
| 2 | Send a little MON to the keeper and approver wallets on mainnet | Dhruv | to do |
| 3 | Keep the indexer and keeper running for chain 143 (pg_cron on the mainnet site, or a second cron) | code + Dhruv | check |
| 4 | **One real $5 mainnet cycle** (list, bid, outbid, close, proof, pay); add the hashes to `docs/evidence.md` | both | to do |
| 5 | Verify the mainnet contracts on Sourcify | code | to do |
| 6 | Contest: close Oct 11 09:00 IST, run the draw, pay 3 × $10 on mainnet, post the tx links | Dhruv | Oct 11 |
| 7 | Update the deck's traction slide with Oct 11 numbers (`metrics.mts`) | Dhruv | Oct 11 |
| 8 | Demo video (≤3 min, show the explorer) and pitch video (≤2 min) | Dhruv | to do |
| 9 | README: the Medium link for the Privy write-up; mainnet evidence | code | to do |
| 10 | Live checks: demo-account guards, auto-bid raise flow, campaign budget aggregation, price formatting | code | to do |
| 11 | Submit: logo, description, team invites, repo shared with `metropolis@hackathon.monad.xyz`, progress update | Dhruv | Oct 12 |
| 12 | After judging: turn open admin off (`NEXT_PUBLIC_OPEN_ADMIN`) | code | after |

Known open issue: under heavy parallel load, about 1 in 8 page loads logs React hydration error #418 and recovers by itself ([../requests.md](../requests.md)).

## After the hackathon: the roadmap

### Make mainnet safe for real volume
- Move the owner, admin and treasury from one deployer key to a **multisig**, add a timelock, and eventually call `freezeUpgrades()`.
- Get a security review of `PatchedMarket` (it holds all the money).
- **Separate creator and brand names on-chain:** today one wallet has one on-chain name for both roles, so outside NFT sites show a creator's brand name as the creator. This needs a contract change.

### Product
- **Reach bonus:** pay extra when the creator's X post hits a target (needs a paid X API tier and a small `PatchBonus` contract). This was in the V2 spec and cut for time.
- **Proof that is harder to fake:** location check-ins for vehicles, photo timestamps, the X post's metrics, attendee Spotted photos counted toward proof.
- **Brand pages and analytics:** spend, spots, reach and a public record per brand.
- **Bundles:** buy several creators at an event as one package.
- **An AI "printed" preview:** the brand's logo rendered onto the garment before bidding ends.
- **On-chain social** (`PatchSocial`: follow, check-in, cheer) so the social graph is fully on-chain, not just bids and spots.
- **Referral split** on the fee for whoever brought a creator or brand (needs a contract change, decided once).
- **Patchwork:** a landing hero, embeds for organisers, cross-event history.

### Reach
- **Android app** as a Trusted Web Activity (plan: [../android-and-social-plan.md](../android-and-social-plan.md)): a web manifest, icons, `assetlinks.json`, then PWABuilder. Not started; there is no manifest yet. No iOS app (Add to Home Screen instead).
- **Arc mirror** for Circle's Arc Microgrants (plan: [../arc-plan.md](../arc-plan.md); separate repo, Arc mainnet, USDC as gas). On hold.
- **Bids from any chain:** `bidFor` already lets a relayer bid for a brand and forwards the money if the bid fails on arrival.
- **Beyond crypto events:** sports days, college fests, marathons, car meets. Anywhere people look at people.

### Things we decided not to do
- No banks, cards, fiat on-ramps, off-ramps or KYC. Wallets hold USDC only.
- No automatic X posting on someone's behalf.
- No Telegram app.
- No 3D in the Patchwork graph (2D canvas fits the design and runs on phones).
