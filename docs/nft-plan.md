# Patch NFT: audit and plan (2026-10-04)

Written from a read of the code and the live testnet contracts.

## Status (2026-10-04)

Built and tested (120 contract tests pass, web typechecks and lints clean). **Not deployed yet**: the testnet upgrade script is ready (`contracts/script/UpgradeReceipt.s.sol`) and still has to be broadcast; until it is, the new pages show nothing and the app falls back to the old receipt picture. After it runs, put the printed addresses in `packages/shared/src/addresses.ts` (`receipt`, `legacyReceipt`, `renderer`, `livingPatch: true`), redeploy the web app, and re-run the indexer.

Where the build differs from the plan below:
- The token `image` is always the on-chain SVG (it also draws the Printed, Seen and Delivered stamps, with the patch moved aside, so it never needs the photo). The photo is shown by the website's card and the share picture (`/patch/<token>/card.png`), because SVG on marketplaces cannot load outside images, and one `submitProof` call carries one cover for every patch of a listing, not one per patch. The newest proof and cover are in the metadata as `proof` and `proof_image`.
- No database migration or indexer change: stage, sponsor number and the newest proof are read from the market (`tokenView`) when a card is drawn, and owners are already in `receipts`.
- Creator and Collection views are new tabs on the profile (`Sponsors` for creators, `Collection` for holders).
- Mainnet is not touched. Redeploy it with the same script before the real-USDC cycle.
- The brand name is written on-chain automatically (silent, Patched wallets only) before a first bid or listing, from the profile. Campaign wallets and pregenerated X wallets cannot, because their policies only allow bids; their patches show a short address.

## 1. How it works today

- **Contract:** `PatchReceipt` (`contracts/src/PatchReceipt.sol`), ERC-721 "Patched Receipt" (PATCH), plus ERC-2981 royalties.
  - Testnet: `0xC4Abf876…AeD4e`.
  - Token id is `listingId << 8 | patchId`.
- **Minting:** `PatchedMarket.closeBidding` mints one token to each winning bidder. The keeper calls `closeBidding` when bidding ends, or the creator does it from Studio.
- **Transfers:** only the market can move a token. The one way to do that is `listForResale` / `buyResale`, which only works while the listing is **Delivering**. Resales pay a 5% royalty to the creator.
- **Rights:** the holder can dispute or approve proofs, and gets the refund if the creator fails.
- **Art:** a fully on-chain SVG built from these fields: brand name (`brandName[topBidder]`, set with `setBrandName`), patch label, event name, surface and winning bid.
- **Where people see it:**
  - Profile → **Bids** tab, which is owner-only and the 5th tab. The "won" cards there call `tokenURI` over RPC and show the SVG.
  - Nowhere else shows the art.
- **Live tokens on testnet:**
  - `256` (listing 1, Chest).
  - `1792`, `1793`, `1794` (listing 7, Token2049 Demo).

## 2. Bugs and weak spots (checked on the live contract)

| # | Problem | Evidence |
|---|---|---|
| 1 | **A won NFT says "Your brand here".** The on-chain brand name is only set when a brand saves Settings with a name. Privy users who just bid, campaign wallets and pregenerated "Patch anyone on X" wallets never set it. | Token 256 reads "Proof that Your brand here won this patch". |
| 2 | **Long brand names run off the patch.** The font size is fixed at 30px. | Token 1792: "Patched Test Brand" spills past both edges. |
| 3 | **"Event" repeats the surface** when a listing has no event. | Token 256: Surface "Team hoodie", Event "Team hoodie". |
| 4 | **The art never changes.** It looks the same before printing, after proof, when completed, when failed and refunded, and when disputed. After a failure the description still says "The holder owns the spot and its escrow rights". | `tokenURI` reads no status. |
| 5 | **No real images.** No brand logo, no creator photo, no patch on the canvas, no proof photo. All images live in Supabase Storage, which is central and editable. | `lib/server/storeImage.ts` |
| 6 | **Proofs can't be checked from outside.** The on-chain `proofURI` is `patched://proof/<chain>/<listing>/<milestone>`, which nobody can open. The hashed JSON only lives in our database. | `app/api/proofs/route.ts:45` |
| 7 | **No collection metadata.** `contractURI()` reverts, so explorers and marketplaces show an unnamed collection with no image. | `cast call … contractURI()`: reverts |
| 8 | **No ERC-4906 refresh events.** Even if the art changed, marketplaces would keep showing the old cached image. | |
| 9 | **Locked forever.** After a listing completes, resale is closed and transfers revert, so the token can never move again. **Decision (2026-10-04): keep it this way for now.** Transfers stay market-only. | `_update` override plus the `Delivering` check |
| 10 | **Art shows the original winner, not the holder.** After a resale the art still names the first winner's brand and does not mention the holder. | `receiptData` uses `P.topBidder` |
| 11 | **Hard to find.** Profile → Bids (owner-only) is the only place. There is no public NFT page or share link, no NFT on the listing page or the public profile, and the "You won" notification links to the listing. Creators get no on-chain token at all, even though the landing page says the creator "earns reputation". | `ProfileView.tsx:88`, `notifications.ts:58`, `LandingView.tsx:426` |

## 3. Why this matters for Track 3

The judges' wording maps directly onto this:
- **Technical, 20%:** "does the mechanism run onchain and produce correct, **verifiable** results". Bug 6 means our proofs are not verifiable by an outsider today.
- **Originality, 15%:** "is the onchain layer **decorative**?" A static receipt nobody sees is decorative.
- **Suggested idea #11:** "Generative art that evolves … based on onchain events … moving the NFT from static collectible to **living object**".
- **Suggested idea #4:** "Early-supporter registries that cryptographically prove … fans who were there before the audience arrived".

Patched can hit both ideas with one change. The patch NFT **grows up as the creator delivers**, and it records **which brand backed this creator first**.

## 4. The plan: the "Living Patch"

### 4.1 Stages (driven only by on-chain state)
| Stage | When | What the NFT shows |
|---|---|---|
| **Won** | `closeBidding` | On-chain SVG: the patch shape in the surface's colour, the brand name sized to fit, the price, and the stamp "Sponsor #N of @creator". |
| **Printed** | Proof for milestone 0 accepted (or submitted) | `image` = the real proof photo of the printed patch, from IPFS. |
| **Seen** | Each later milestone proven | The newest proof photo; a "Seen 2/4" trait. |
| **Delivered** | Listing `Completed` | The final photo with a "Delivered" stamp. Stays in the brand's wallet as a permanent record (transfers stay market-only). |
| **Refunded** | `markFailed`, or a dispute lost by the creator | Greyed out, "Refunded $X". The description stops claiming escrow rights. |
| **Disputed** | Holder disputed the current milestone | Red "Under dispute" ribbon. |

The SVG always stays on-chain as the fallback (`animation_url` or a `svg` field), so the token never breaks if a gateway is down.

### 4.1b Card design v2 (mockups: `docs/nft-design/mockups-v2.html`; v1 is kept in `mockups.html` for comparison)
The source of truth is the `card()` function in `mockups-v2.html`. The Solidity renderer and the server card both copy it.

**Concept:** an embroidered patch sewn onto the creator's fabric, with a woven clothing label that carries the facts. Every proven milestone adds a passport stamp.

- **Fabric background, by surface:** full-bleed twill texture plus a dark edge.
  - Outfit: denim `#22385C`.
  - Car: racing green `#1D5A45` with two cream racing stripes.
  - Team hoodie: fleece `#24212E`.
- **The patch:**
  - A soft drop shadow (it sits on the fabric).
  - A pastel satin fill (diagonal sheen lines) with a light top half.
  - A **merrowed edge**: a thick border in the tier's thread colour with dark stitch ticks over it.
  - A dashed inner stitch ring.
  - The brand name in Bricolage 800 with a diagonal thread texture, sized by length so it always fits.
- **Five patch shapes, by `patchId % 5`:** rounded rectangle, round, shield, hexagon, scalloped. One listing's patches look like a real set.
- **Thread tiers (from the winning bid):**
  - Cotton, under $100: black.
  - Silk, $100–999: iridescent purple to pink to sky gradient.
  - Gold, $1,000 and up: a gold gradient with a white sheen.
- **Header:** "No.003", the sponsor number in big Bricolage, then "SPONSOR OF @MIRA" underneath. Sponsor #1 reads "FIRST SPONSOR OF @MIRA" in orange. The logo mark sits top-right.
- **Woven label** (bottom, cream, stitched folds at both ends):
  - Patch label in Bricolage.
  - Event, price and tier in mono, then "PATCHED ON MONAD · #7-0".
  - On the right, the stage word in orange (WON, PRINTED, SEEN 2/3, DELIVERED; REFUNDED in grey, IN REVIEW in red) above 4 progress pills.
- **Stages:**
  - **Won:** the patch on the fabric. Fully on-chain.
  - **Printed / Seen:** the real proof photo goes full-bleed (with a dark fade at top and bottom), and the patch becomes a sticker in the lower left. Round passport stamps build up: an orange "PRINTED · SEP 28", then a lilac "SEEN · TOKEN2049 · OCT 1", with rim text on a circular path.
  - **Delivered:** an orange double-border "DELIVERED" stamp.
  - **Refunded:** the fabric turns grey and the patch is **unpicked**: only rings of stitch holes remain, plus a "REFUNDED $420" stamp.
  - **Disputed:** yellow-and-black hazard tape across the patch reading "PROOF DISPUTED".
- **Two renderers, one look:**
  - **On-chain** (`PatchRenderer`) draws Won, Refunded and Disputed. It is also the fallback for every stage.
  - Fonts there are system stacks only (Arial Black / Arial / Courier New), because marketplaces render SVG in a sandbox without web fonts. The last row of the mockup shows this still looks right.
  - Patterns, gradients, `feDropShadow`, `textPath` and `clipPath` are all plain SVG and fine on-chain. Keep the renderer string small: the fabric and satin are tiny `<pattern>`s, not images.
  - **Server** (`next/og` `ImageResponse` with the real fonts) draws the photo stages at 1000x1000 PNG. When the brand has a logo, the sticker shows the logo. The server pins each PNG to QuickNode IPFS and passes the CID as `coverURI` in `submitProof`.
  - `next/og` (Satori) does not support SVG `<pattern>` or `textPath` in JSX. Render the card as an SVG string, the same as on-chain, and turn it into PNG with `sharp`, using the font files embedded.
- **Traits:** Stage, Thread, Shape, Fabric, Sponsor #, Creator, Surface, Patch, Event, Winning bid (USDC), Proofs (n/m).
- **Same card everywhere:** use it on `/patch/[tokenId]`, the Collection tab and the Sponsors wall, and as the Open Graph image.

### 4.2 IPFS on QuickNode (the user's Pro plan includes IPFS)
- **API:** `POST https://api.quicknode.com/ipfs/rest/v1/s3/put-object`.
  - Header: `x-api-key`.
  - Multipart fields: `Body` (the file), `Key` (a name), `ContentType`.
  - The response includes `pin.cid`.
  - One file per call. Folder and CAR uploads are not documented, so don't rely on them.
- **Gateway:** create a dedicated gateway in the QuickNode dashboard (IPFS → Gateways). Its URLs look like `https://<name>.quicknode-ipfs.com/ipfs/<cid>`; copy the exact one. Make it **public**, because marketplaces and judges must load images without a key.
- **Server only.** Add `QUICKNODE_IPFS_API_KEY` (an IPFS key from the dashboard, separate from the RPC URL) and `NEXT_PUBLIC_IPFS_GATEWAY` to `.env.example` with comments.
  - One helper, `lib/server/ipfs.ts`, with `pinFile(bytes, name, contentType) → cid` and `ipfsUrl(cid)`.
  - Keep the provider behind this helper so Arc can reuse it.
- **Proof bundle:** when a creator submits a proof, pin each file separately, then pin the JSON that links them:
  1. Pin each proof photo, which gives one `ipfs://<photoCid>` per photo.
  2. Optionally pin a crop per patch, used as that token's image.
  3. Pin `proof.json`: the same record we hash today, but with the `ipfs://` photo links and `patches: { "0": "ipfs://…" }`.
- **How the proof goes on-chain:**
  - `proofHash = keccak256(<the exact proof.json bytes that were pinned>)`. Hash the uploaded bytes, not a re-serialised object, or Verify will fail.
  - `proofURI = ipfs://<jsonCid>` replaces `patched://…`. The existing `submitProof` already takes the URI, so **verifiable proofs need no contract change**.
  - Supabase keeps a copy for speed.
- **NFT image:** the contract can't read inside IPFS JSON, so a token's image link must also be on-chain. The market upgrade (4.3) adds `submitProof(id, m, hash, uri, coverURI)`, which stores `proofCoverOf[listing][milestone] = ipfs://<photoCid>`.
  - The renderer uses that cover, or the per-patch crop when one is given, as the token `image`.
- **Listing art:** at listing creation, pin the canvas, the spot layout and each brand logo once the auction closes. This is optional, after the proof bundle.
- **Collection:** pin the collection image and JSON, then serve them from `contractURI()`.
- **Verify button** on the NFT page. The browser fetches `proof.json` from IPFS, hashes it with keccak256, and compares the result with `proofHash` read from the chain. A green "Matches on-chain proof" with the tx link is the 10-second "verifiable" moment for the demo video.

### 4.3 Contract changes (one new receipt plus a small market upgrade)
`PatchReceipt` is not upgradeable, so the art fixes need a new receipt contract. The market is a UUPS proxy and only needs an upgrade.

1. **`PatchReceipt` v2:**
   - Rendering moves to a swappable `PatchRenderer` contract (`setRenderer`, admin only), so later art fixes don't need another redeploy.
   - Implements **ERC-4906** (`MetadataUpdate`, `BatchMetadataUpdate`), plus a market-only `refresh(listingId)` that emits `BatchMetadataUpdate(id<<8, id<<8 | 255)`.
   - Adds `contractURI()` (ERC-7572), set by admin.
   - Transfers: unchanged, market-only at all times (decision 2026-10-04). Keep ERC-2981 for the royalty info.
   - Mint takes a `sponsorNumber`.
2. **`PatchedMarket` upgrade:**
   - `proofURIOf[listing][milestone]` and `proofCoverOf[listing][milestone]` storage. A new `submitProof` overload with `coverURI` writes both; the old signature keeps working.
   - `creatorSponsorCount[creator]`, incremented per patch at `closeBidding`. Its value at mint is the token's "Sponsor #N".
   - Call `receipt.refresh(id)` from `closeBidding`, `submitProof`, `release`, `markFailed` and dispute resolution.
   - A one-time admin `setReceipt(newReceipt)` in a `reinitializer(2)`.
   - `receiptData` returns the holder, status, milestones proven/total and the latest `proofURI`.
3. **`PatchRenderer`:**
   - The improved SVG: font size by name length, no duplicate event, a stage stamp and a "Sponsor #N" line.
   - JSON with `image`: the latest proof's `patch-<id>.jpg` (or `photo-0.jpg`) from IPFS once a proof exists, otherwise the SVG.
   - Traits: Stage, Sponsor #, Milestones proven, Creator, Surface, Event, Winning bid.
4. **Redeploy:**
   - Testnet: new receipt plus the market upgrade. The 4 old test tokens stay on the old receipt contract.
   - Mainnet: do it **before** the real-USDC cycle, so the real cycle mints Living Patches.
   - Then follow `CLAUDE.md`: run `forge test`, export the ABIs to `packages/shared`, and update `docs/contracts.md`.

### 4.4 Fix "Your brand here" (bug 1)
- When a wallet places its first bid and has no on-chain brand name, ask "Name on your patch" once (prefilled from the profile or X handle). Send `setBrandName` before the bid, sponsored by Privy, so it's no extra cost.
- Campaign wallets and pregenerated X wallets: the server calls `setBrandName` when it creates them. Add `setBrandName` to the keeper policy allowlist.
- Renderer fallback: the short address `0x8fBf…99D1`, never "Your brand here".

### 4.5 Navigation: make the NFT easy to find
1. **New public page `/patch/[tokenId]`** (works on creator subdomains too). It shows:
   - The large art and the stage timeline (Won → Printed → Seen → Delivered), with tx and IPFS links at every step.
   - Holder, brand, creator, "Sponsor #N of @creator", the resale price, and a Buy button.
   - The **Verify** box and an explorer link.
   - An Open Graph image equal to the NFT image, so shared links show the patch.
2. **Public profile:**
   - Brands get a **Collection** tab (the NFTs they hold, as an art grid).
   - Creators get a **Sponsors** wall: every patch NFT minted on their listings, ordered #1, #2, #3 ("backed me first").
3. **Listing page:** each sold patch shows a small NFT thumbnail that links to `/patch/[tokenId]`.
4. **Notifications and toasts:**
   - "You won", "Proof posted" and "Delivered" link to the NFT page.
   - After close: "Your patch NFT is live. View it".
5. **Bids tab:** rename "Won" to **Your patch NFTs**; cards link to the NFT page.
6. **Wallet panel:** a "Patch NFTs (n)" row.
7. **Landing page:** replace "Onchain receipt … creator earns reputation" with "A living NFT that updates as the creator delivers".

### 4.6 Indexer and database
- Migration: add these columns to `receipts`:
  - `stage`
  - `sponsor_number`
  - `image_uri`
  - `updated_at`
- Owners still only change through `ResaleBought`, so no `Transfer` indexing is needed.
- Index `MetadataUpdate` events to refresh the cached `image_uri`.
- Store `proof_uri` as the `ipfs://` link.

## 5. Order and time (about 2.5 days of coding)
| Step | Work | Time |
|---|---|---|
| 1 | IPFS helper and proof bundle pinning; `proofURI = ipfs://`; Verify box (no contract change) | 0.5 day |
| 2 | `PatchReceipt` v2, `PatchRenderer`, market upgrade, tests, ABIs, docs; redeploy testnet | 1 day |
| 3 | `/patch/[tokenId]` page, OG image, Collection and Sponsors tabs, links from listing, notifications and bids | 0.75 day |
| 4 | Brand-name prompt, server `setBrandName`, indexer and migration | 0.25 day |
| 5 | Mainnet redeploy, then the real-USDC cycle (already planned) | with Oct 8–9 |

This fits if comments shrink to a simple version (listing comments only) on Oct 7. Steps 1 and 3 alone, without the contract work, already fix verifiability and discoverability if time runs short.

## 6. Demo script lines this unlocks
- "The brand won Chest. Here is its patch NFT, Sponsor #1 of @dhruv."
- "The creator printed it and posted proof. The NFT updated itself; it's now the real photo, pinned on IPFS."
- "Anyone can verify: we fetch the proof from IPFS, hash it, and it matches the hash on Monad."
- "When the run is delivered, the NFT is stamped Delivered: a permanent on-chain record of who backed this creator and that it happened. Every resale during the run paid the creator 5%."

## 7. Open questions
- Pinning service: **QuickNode IPFS**, set up and tested 2026-10-04. Public gateway `https://figure-wash-outside.quicknode-ipfs.com`; the IPFS-only key is in the root `.env.local` as `QUICKNODE_IPFS_API_KEY`. A test upload through `put-object` returned a CIDv0 (`Qm…`) with status `pinned` and loaded through the gateway at once. The storage behind it is Filebase. Still to do: add both variables in Vercel.
- Transfers: **decided 2026-10-04, keep them market-only** (no free transfers, even after delivery). Revisit after the hackathon.
- Should creators also get their own token (a "creator pass" with total sponsors and delivered runs)? Recommended: **not before Oct 12**; the Sponsors wall shows the same thing from existing data.
