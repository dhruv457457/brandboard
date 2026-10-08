# Patchwork: the live on-chain graph of an event (plan, 2026-10-08)

Status: **proposed**. Prototype: [docs/prototype/patchwork-graph.html](prototype/patchwork-graph.html) (open it in a browser; it runs on mock data).

## The idea in one line

Home gets a switch: **Feed | Patchwork**. Feed is today's Instagram-style column. Patchwork shows one event as a living
graph where every creator, spot, brand and spotter is a node, every bid, win and spot photo is a thread, and the whole
thing moves as the chain moves. Anyone can press **Find me**, see where they sit in the event, and post that picture.

Why it matters for judging: it makes the "everything is on-chain" claim visible in one screen (technical execution),
it is the most memorable thing in the demo video (design & craft, originality), and "see yourself in the event" is a
share loop (traction).

Name: **Patchwork** (a quilt is literally patches stitched together, and the threads are drawn as stitches). The
fallback name is "Graph".

## Scope decisions

- **One event at a time.** The graph is always scoped to one `patched_events` row. An event picker chip switches events.
  Cars have `eventId = 0`, so they get their own pseudo-event "On the road" in the picker. Cross-event view is out of
  scope (too dense to read, and a wallet's history across events is what their profile page is for).
- **A wallet is one node.** A creator who also bids on another creator's spot, or a brand that also spots someone, is
  the same node with several roles. That is where the graph earns its "everything is connected" feel.
- **2D canvas, not 3D.** We already ship three.js, but the design system is flat stickers with ink outlines and hard
  shadows, 3D graphs are hard to read, and they are slow on phones. 2D canvas with depth faked by shadows and parallax.
- **Read-only.** The graph never moves money. Clicking a node opens its listing, profile or the bid sheet that already
  exists.

## What is in the graph

### Nodes

| Node | Id | Drawn as | Size by |
|---|---|---|---|
| Event (hub) | `event:<id>` | the orange logo patch, rotated -8deg, pinned at the center | fixed, large |
| Creator | `w:<wallet>` | round avatar, 2px ink border, hard shadow, small surface badge (Shirt / Car / Users) | USDC escrowed on their listings |
| Spot (patch) | `p:<listingId>:<patchId>` | small pastel rounded square with a dashed stitch ring; open spots are dashed orange outlines with "OPEN" | its top bid |
| Brand | `w:<wallet>` | logo in a rounded square, ink border, verified tick if `brand_verified_domain` | total USDC it leads with |
| Spotter | `w:<wallet>` | small avatar with a camera badge | number of spots it posted |
| Holder (resale buyer) | `w:<wallet>` | same as brand, with a receipt badge | resale price paid |
| You | your wallet | any of the above plus a pulsing orange halo | |

Spots orbit their creator on short stiff links, so each creator reads as a little solar system around the event hub.

### Threads (edges)

| Thread | From -> to | Source table | Drawn as |
|---|---|---|---|
| `lists` | creator -> event | `listings` | faint ink line |
| `has` | creator -> spot | `patches` | short stiff stitch |
| `leads` | brand -> spot | `patches.top_bidder` | solid ink thread, width by amount, orange USDC particles flowing toward the spot while the auction is live |
| `outbid` | old bidder -> spot | `bids.prev_bidder` | faint ghost thread (toggle "Bid history") |
| `won` | holder -> spot | `receipts.owner` after close | solid thread with a small receipt tag |
| `spotted` | spotter -> creator | `spots` (new, on-chain, see below) | dashed stitch thread with a camera bead in the middle; hover shows the photo |
| `paid` | spot -> creator | `payouts` / `milestones` | green particles on release |
| `team` | creator <-> teammate | `listing_payees` (new, see below) | double thread |
| `follows` | wallet -> creator | `follows` (off-chain) | dotted, off by default, labelled "off-chain" |

Every thread except `follows` comes from a contract event, and the details panel shows the tx hash with a Monad
explorer link. That is the "on-chain social graph" claim, made checkable.

## Contract change: `PatchSpotter` (new, small, PatchedMarket untouched)

Today "Spotted" is a Supabase `posts` row. To make spotting an on-chain contribution, add a tiny contract next to
`PatchSweeper` and `PatchAutoBidder`. It holds no funds and needs no role on the market, so the audited market and its
tests do not change.

```solidity
contract PatchSpotter {
    IPatchedMarket public immutable market;
    mapping(address spotter => mapping(uint256 listingId => bool)) public hasSpotted;
    mapping(uint256 listingId => uint32) public spotCount;
    mapping(address spotter => uint32) public spotsBy;

    event Spotted(uint32 indexed eventId, uint256 indexed listingId, address indexed spotter,
                  address creator, bytes32 photoHash, string photoURI);

    error NotSpottable();   // listing not Active or Delivering
    error OwnListing();     // creator (or a payee) spotting themselves
    error AlreadySpotted(); // one spot per wallet per listing

    function spot(uint256 listingId, bytes32 photoHash, string calldata photoURI) external;
}
```

- Reads `market.getListing(listingId)` for `creator`, `eventId` and `status`; rejects payees too (`getPayees`).
- One spot per wallet per listing keeps the graph honest and spam-free; the existing 20 a day API limit stays.
- `photoURI` is `ipfs://<record>` pinned through QuickNode IPFS; `photoHash = keccak256(record bytes)`, same pattern as
  `submitProof`.
- Patched wallets spot with Privy gas sponsorship (one more "Privy beyond login" line for the README table); outside
  wallets pay their own gas, which is cents on Monad.
- Tests: `test/PatchSpotter.t.sol` (happy path, each revert, payee rejection, counters). Deploy script
  `script/DeploySpotter.s.sol` for testnet and mainnet; address goes into `@patched/shared` config.

### Team payees (no contract change)

Hoodie listings split money across `payees`, but the indexer does not store them. At `ListingCreated` the indexer calls
`getPayees(listingId)` and writes `listing_payees (chain_id, listing_id, payee, share_bps)`. That gives the `team`
threads.

## Data layer

### Migration `0026_patchwork.sql`

```sql
create table public.spots (
  chain_id int not null, tx_hash text not null, log_index int not null,
  event_id int not null, listing_id bigint not null,
  spotter text not null, creator text not null,
  photo_hash text not null, photo_uri text not null,
  block_number bigint not null, block_time timestamptz not null,
  primary key (chain_id, tx_hash, log_index)
);
create index spots_event on public.spots (chain_id, event_id, block_time);
alter table public.posts add column if not exists spot_tx text;   -- links the photo post to its on-chain spot
create table public.listing_payees (chain_id int, listing_id bigint, payee text, share_bps int,
  primary key (chain_id, listing_id, payee));
-- public read RLS on both, writes by the indexer only; add spots to the Realtime publication.
```

Hidden spotted posts (moderation) hide the photo and drop the thread from the graph; the chain event stays, as it must.

### Indexer (`packages/indexer`)

- Add `PatchSpotter` to the watched addresses; `Spotted` -> `spots` row + a `spotted` notification (moved here from the
  API route).
- `ListingCreated` -> read `getPayees` -> `listing_payees`.

### Loader `apps/web/src/lib/graph/server.ts`

`fetchEventGraph(eventId): Promise<EventGraph>` builds nodes and threads from `listings`, `patches`, `bids`,
`receipts`, `spots` (+ `posts` for photos), `listing_payees`, `profiles`, `payouts`. One parallel round of queries, the
same way `/e/[slug]/page.tsx` already does it.

```ts
type NodeKind = "event" | "creator" | "spot" | "brand" | "spotter" | "holder";
interface GNode { id: string; kind: NodeKind; roles: NodeKind[]; label: string; image: string | null;
  wallet: string | null; href: string; weight: number; firstSeen: number; verified?: boolean; open?: boolean }
interface GThread { id: string; kind: "lists" | "has" | "leads" | "outbid" | "won" | "spotted" | "paid" | "team" | "follows";
  source: string; target: string; amount?: bigint; time: number; txHash?: string; photo?: string }
interface EventGraph { event: EventInfo; nodes: GNode[]; threads: GThread[]; stats: GraphStats }
```

`firstSeen` / `time` (block time) drive the replay. Amounts go over the wire as strings, as with `toWire`.

### API

- `GET /api/graph/[eventId]` -> `EventGraph` JSON, `revalidate = 15`, same cache rules as Explore.
- `GET /api/graph/[eventId]/me?wallet=` -> the wallet's stats in this event (degree, USDC locked, spots won, people
  spotted, rank by connections).

### Live updates

One Supabase Realtime channel per open graph: `bids` and `spots` inserts and `patches` / `receipts` updates on
`chain_id`, filtered on the client to the event's listing ids. Each change is turned into a graph diff, not a refetch:

| Change | Animation |
|---|---|
| New bid | USDC particle shoots brand -> spot, ring ripples from the spot, the spot bumps, the old leader's thread snaps (it springs apart and fades) and a small refund particle flies back to them |
| Buy-now | "SOLD" stamp on the spot, the thread locks solid |
| New spot photo | spotter node drops in, a dashed thread stitches itself toward the creator, the camera bead flashes |
| New listing | creator drops in with its spots popping out around it one by one |
| Milestone released | green particles flow from each sold spot to the creator |

## Frontend

### Where it lives

- **Home**: the header becomes `Home` + a `Seg` toggle **Feed | Patchwork**. State in the URL (`/?view=patchwork&event=token2049`)
  so it can be shared and survives refresh. The graph takes the main column and the right rail becomes the details
  panel. The graph bundle loads with `next/dynamic` only when the toggle is on, so the Feed stays as fast as today.
- **Event page**: a third tab "Patchwork" next to the listings, and a full-screen route `/e/[slug]/patchwork` (the
  shareable link and the demo-video page).
- Logged-out landing: a small looping, non-interactive Patchwork of the busiest event as a hero background (later,
  optional).

### Files

```
apps/web/src/lib/graph/server.ts         fetchEventGraph, wallet stats
apps/web/src/lib/graph/types.ts          GNode, GThread, EventGraph, wire helpers
apps/web/src/lib/graph/useGraphLive.ts   Realtime -> graph diffs
apps/web/src/components/graph/Patchwork.tsx       the canvas, simulation, input
apps/web/src/components/graph/draw.ts             node and thread painters (design-system stickers)
apps/web/src/components/graph/particles.ts        particles, rings, snaps, stamps
apps/web/src/components/graph/GraphPanel.tsx      details panel / mobile bottom sheet
apps/web/src/components/graph/YouCard.tsx         "You in Token2049" card + Post button
apps/web/src/components/graph/Replay.tsx          time scrubber
apps/web/src/app/api/graph/[eventId]/route.ts
apps/web/src/app/e/[slug]/patchwork/page.tsx
apps/web/src/app/share/patchwork/[eventId]/[wallet]/route.tsx   OG image
```

### Rendering

- **`d3-force`** for the simulation only (about 20 KB, no DOM). Our own Canvas 2D renderer draws everything, so nodes
  look like Patched stickers instead of library dots. Considered and rejected: `react-force-graph` (heavy, fights the
  design system), SVG (slow past a few hundred animated nodes), three.js (see Scope).
- Forces: radial ring per role (creators on an inner ring around the hub, brands and spotters outside), stiff short
  links for `has`, longer soft links for `leads` and `spotted`, collision by node radius, a gentle charge. Brands that
  sponsor many creators settle between them, which is the picture we want.
- **Always alive, never jittery**: after the layout settles, the simulation keeps `alphaTarget` at about 0.01 and each
  node gets a slow sine drift, so the web breathes. New nodes reheat it briefly.
- Images (avatars, logos) are loaded once into an offscreen sprite cache with the ink border and hard shadow baked in.
- DPR-aware canvas, `ResizeObserver`, one `requestAnimationFrame` loop, paused when the tab is hidden.
- Budget: 60 fps with 1,000 nodes on a laptop and 300 on a mid-range phone. Above 600 nodes, spots fold into their
  creator (a count badge) until you zoom in.

### Interactions

| Input | Result |
|---|---|
| Hover a node | its neighbors and threads light up, everything else fades to 15%; a tooltip with name, role and amount |
| Click a node | details panel: avatar, roles, threads list with amounts and tx links, "Open listing" / "Place bid" / "View profile" |
| Drag | moves a node; the web follows with springs |
| Scroll / pinch | zoom; drag on empty space pans (`d3-zoom`) |
| **Find me** | camera flies to your node (zoom + pan easing), halo pulses, your threads light up, the You card opens |
| Layer chips | Bids, Spots, Wins, Money flow, Bid history, Follows |
| **Replay** | scrubber at the bottom; plays the event from the first listing to now in about 20 seconds: nodes drop in, threads stitch in, money flows, all in block order |
| Search | type a name or handle, jump to that node |
| Keyboard | `/` search, `F` find me, `R` replay, `Esc` clears the selection |

### You card and sharing

Signed-in users see "You in Token2049": roles, connections, USDC locked, spots won, people spotted, and a rank ("#4 most
connected"). **Post my spot** opens an X intent with a link to `/share/patchwork/<event>/<wallet>`, whose OG image
(resvg, already used for cards) draws the user's node and its neighbors as a sticker cluster. Not on the graph yet?
The card says how to get in: "Spot a creator" or "Bid on a spot", each a button.

### Motion and accessibility

- Every effect follows the motion table in [design-system.md](design-system.md): drops use its spring, rings its 1.1s
  expand, SOLD its stamp.
- `prefers-reduced-motion`: the layout is computed up front (300 ticks, then frozen), no drift, no particles, live
  changes recolor instead of animating, replay jumps in steps.
- The canvas has `role="img"` with a summary label, and **View as list** shows the same data as a table (node, role,
  connections, amount) for screen readers and for anyone who wants plain numbers.
- Light and dark themes read the CSS tokens at draw time, so the theme toggle repaints the graph.

## Build order (deadline Oct 14, 09:29 IST)

| Day | Work | Shippable on its own |
|---|---|---|
| 1 (Oct 8-9) | types + `fetchEventGraph` + API; `Patchwork.tsx` with d3-force, sticker painters, hover, click panel, drag, zoom; Feed / Patchwork toggle on Home | yes: a static but good-looking graph |
| 2 (Oct 9-10) | breathing drift, node drops, particles, rings, snaps; `useGraphLive` Realtime diffs | yes: the live graph |
| 3 (Oct 10-11) | `PatchSpotter` + tests + deploy (testnet, mainnet) + ABI in shared + `docs/contracts.md`; migration 0026; indexer `Spotted` and payees; Spotted flow pins to IPFS and sends the sponsored `spot` tx | yes: spots on-chain |
| 4 (Oct 11-12) | Find me, You card, OG share image, Replay, `/e/[slug]/patchwork`, layer chips, search | yes |
| 5 (Oct 12-13) | mobile bottom sheet + pinch, reduced motion, View as list, perf pass, seed a busy demo event (`scripts/demo-bidding-war.mts`), record the demo | |

**Cut line if time runs short:** drop day 3's contract work first and draw spotted threads from the existing `posts`
rows, labelled "off-chain". Never cut Replay or Find me: they are the demo.

## Open questions

1. Name: Patchwork (recommended) or Graph?
2. Should spotting require the on-chain `spot` tx (recommended: yes for Patched wallets, it is sponsored and invisible),
   or stay optional with an off-chain fallback?
3. Should the `follows` layer be shown at all, given it is the only off-chain thread? (Recommended: off by default.)
