# 05 · Patchwork: the live on-chain graph of an event

**Patchwork** turns one event into a living graph. Creators, their spots, the brands bidding on them and the people who spotted them are nodes. Bids, wins, payouts and spotted photos are the threads. The graph moves as the chain moves. A quilt is patches stitched together, so the threads are drawn as stitches.

**Where:**
- **Home:** the **Feed | Patchwork** switch (`?view=patchwork&event=<id>`).
- **Each event page:** a Patchwork button.
- **A public full-screen page:** `/e/<slug>/patchwork`, open without signing in. Shared links land there.

The full plan is [../patchwork-graph-plan.md](../patchwork-graph-plan.md); the prototype is [../prototype/patchwork-graph.html](../prototype/patchwork-graph.html).

## Why it exists

1. **It makes "everything is on-chain" visible in one screen.** Every thread except follows comes from a contract event, and the details panel shows the transaction with an explorer link. That makes it a social graph you can check, not a claim. (Technical execution, originality.)
2. **It's the most memorable shot in the demo video.** Replay plays a whole event in about 20 seconds. (Design and craft.)
3. **"See yourself in the event" is a share loop.** Find me puts you on the graph, and Post my spot shares a card of your corner of it on X. (Traction.)
4. **It shows the network effect.** A brand that sponsors several creators sits between them; a creator who also bids is one node with two roles. Each person connects the others.

## What is on it

| Node | Drawn as | Size by |
|---|---|---|
| Event (hub) | the event banner / orange logo patch, pinned in the middle | fixed |
| Creator | round avatar, ink border, hard shadow, surface badge | USDC escrowed on their listings |
| Spot | small pastel square with a stitch ring; open spots are dashed orange "OPEN" | its top bid |
| Brand | logo in a rounded square, verified tick | USDC it leads with |
| Spotter | small avatar with a camera badge | spots it posted |
| Holder (resale buyer) | like a brand, with a receipt badge | price paid |
| Teammate (hoodie payee) | avatar, double thread to the creator | share |
| You | any of the above with an orange halo | |

| Thread | From → to | Source |
|---|---|---|
| lists | creator → event | `ListingCreated` |
| has | creator → spot | `PatchListed` |
| leads | brand → spot (USDC particles while the auction is live) | `BidPlaced` |
| outbid (layer "Bid history") | old bidder → spot, faint | `BidPlaced.prevBidder` |
| won | holder → spot | receipts after `BiddingClosed` |
| spotted | spotter → creator, dashed with a camera bead; hover shows the photo | `PatchSpotter.Spotted` |
| paid (layer "Money flow") | spot → creator, green particles | `MilestoneReleased` |
| team | creator ↔ teammate | `getPayees` → `listing_payees` |

## What you can do

| Control | Result |
|---|---|
| Hover a node | its threads light up, the rest fades |
| Click a node | a details panel: roles, threads with amounts and transaction links, Open listing / Place bid / View profile |
| Drag, scroll, pinch | move nodes, zoom and pan |
| **Find me** | the camera flies to your node, it pulses, and the "You in <event>" card opens: roles, connections, USDC locked, spots led, people spotted, rank ("#4 most connected") |
| **Post my spot** | an X post whose link (`/share/patchwork/<event>/<wallet>`) previews as a 1200×630 card of your node and its neighbours |
| **Replay** | plays the event from the first listing to now in about 20 seconds, in block order, with a scrubber |
| Layer chips | Bids, Money flow, Spots, Bid history |
| **View as list** | the same data as a table, for screen readers and anyone who wants numbers |
| Live | Supabase Realtime turns each new bid or spot into an animation: a particle from brand to spot, a ripple, the old leader's thread snapping, a toast. A slow poll is the safety net. |

Reduced motion: the layout is computed up front and frozen, with no drift or particles; live changes recolour instead of animating.

## How it is built

| Part | File |
|---|---|
| Types | `apps/web/src/lib/graph/types.ts` |
| Loader (`fetchEventGraph`): listings, patches, bids, receipts, spots, posts, payees, profiles, payouts in one parallel round | `apps/web/src/lib/graph/server.ts` |
| Where a wallet sits (degree, rank, locked, neighbours) | `apps/web/src/lib/graph/standing.ts` |
| API | `/api/graph/events`, `/api/graph/[eventId]` |
| Simulation and canvas renderer (d3-force for physics only; our own Canvas 2D painters so nodes look like Patched stickers) | `apps/web/src/components/graph/engine.ts`, `sprites.ts` |
| The view, panel, Find me, Replay, layers, list | `apps/web/src/components/graph/Patchwork.tsx`, `ViewSwitch.tsx` |
| Share card image | `apps/web/src/app/share/patchwork/[eventId]/[wallet]/card.png/route.tsx` |
| On-chain spotting | `contracts/src/PatchSpotter.sol` (12 tests), migration `0026_patchwork.sql`, indexer `Spotted` and payees |
| Seed a busy demo event | `apps/web/scripts/demo-bidding-war.mts` |

Cars have no event (`eventId = 0`), so they get a pseudo-event, "On the road".

## Use cases

| Who | What they get from it |
|---|---|
| **A judge or a newcomer** | One screen that explains the whole market: who is selling, who is buying, how money moves, all checkable on-chain |
| **A creator** | Proof of their pull: how many brands bid, how hot their spots are, who spotted them. A card to post on X ("I'm #2 most connected at Token2049") |
| **A brand** | Where the action is: the creators with bidding wars, open spots nobody has bid on yet, which rival brands are where. Click a spot and bid |
| **An attendee (spotter)** | A reason to take part: spot a patched creator, appear on the graph, share it |
| **An event organiser** | A live picture of the event's attention economy, to put on a screen at the venue or post after |
| **Us (marketing)** | Replay videos of every event for X, and a visual for the deck and the demo |

## What could come next

- A small looping Patchwork of the busiest event as the landing page's hero background.
- A cross-event "my history" view on profiles.
- Follows as an optional off-chain layer (it's off by default, as the only thread not from the chain).
- An embed for event organisers' own sites.
