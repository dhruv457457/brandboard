# Video 2 · Technical demo (target 2:55, hard stop 3:00)

**Rules:** must run on Monad mainnet or testnet; show the working product, **not slides or a code walkthrough**.

**What it must prove, in order of score weight:** the product works end to end on-chain (technical execution), it looks and feels good (design and craft), it's new (originality), real people use it (traction).

**The story:** one creator lists, a brand bids, a rival forces a bidding war, the creator proves they showed up, and gets paid, with the patch NFT changing in front of you. Then the social layer and mainnet.

Use two windows side by side for the bidding beats: **creator (Window B)** on the left, **brand (Window A)** on the right, so the live updates are visible.

## Prep

1. Everything in the [prep checklist](README.md#prep-checklist-both-screen-videos).
2. Dhruv's wallet needs **$1+ of test USDC** for the listing stake (testnet stake is $1).
3. A good outfit photo on the desktop for Studio (a white tee works best for the AI canvas).
4. **Listing #12:** a proof photo ready (photo from the event, or a dated photo with the patch) and the X post link, if one exists. Record beat 6 **before Oct 10, 16:00 IST** (the deadline is 16:56 IST).
5. Check in Window A that `/admin` shows the open-admin note.

## Script

### 0:00 – 0:12 · Hook
- **Screen:** the landing page on `monad.patched.world`.
- **VO:** "This is Patched, live on Monad. Creators sell the logo spots on their outfit, car or team hoodie. Brands bid for each spot in USDC. The money waits in escrow until the creator proves they showed up. Here's the whole loop."

### 0:12 – 0:45 · A creator lists in under a minute (Window B)
- **Screen:** **Create** → **What**: Outfit, event Get Patched Week, upload the photo → the AI canvas appears (sped up, labelled) → **Spots**: AI places the spots; drag and rename one; set a floor and buy-now → **Deal**: pick "part before, for printing", show the payout bar with the proof dates → **Page**: accent colour, background → **Publish**: "Approving your stake…" → "Publishing on-chain…" → the listing opens, already **live**. Show the address bar: `dhruvpanch0li.monad.patched.world/<id>`.
- **VO:** "A creator uploads a photo, and AI turns it into a clean canvas and suggests where the logos go. They set a floor and a buy-now price for each spot, choose how they get paid, and publish. That's a real transaction on Monad: their stake is locked, and the listing goes live in seconds, with its own address."

### 0:45 – 1:20 · Live auction (both windows)
- **Screen (Window A, brand):** open the new listing (or #14) → tap a spot → the brand check → **Bid** → "You lead". Window B updates on its own: the bid, the brand's logo on the spot, the activity row, "watching now". Then **sweep** two more spots in one tap.
- **Screen (terminal):** rival bid on the brand's spot.
- **Screen (Window A):** the outbid toast with a one-tap **Bid $X** button; the balance went back up: refunded in the same transaction. Rebid, or let auto-bid answer.
- **VO:** "A brand taps a spot and bids. No wallet pop-up, no gas. The creator sees it land in about a second. Sweep takes several spots at once, all or nothing. Now a rival outbids: the first brand's USDC comes back in the same transaction, and one tap bids again. A bid in the last five minutes extends the auction, so nobody can snipe it."

### 1:20 – 1:35 · Cars and events
- **Screen:** listing **#13** (the car on the moving road, spots beside it) → the event page `/e/get-patched-week`: leaderboard, live wall, Spotted photos.
- **VO:** "Cars sell their panels per event day. Every event has its own page, with leaderboards, a live wall of bids, and photos from people who spotted a patched creator. Spotting is on-chain too."

### 1:35 – 2:20 · Proof, payout, and the patch NFT (Window B, then the NFT page)
- **Screen:** Studio for listing **#12** → the milestone due → upload the proof photo and the X post link → **Submit proof** (on-chain). Then `/admin` → **Proofs and disputes** → fast-track it (it says why admin is open). Wait for the keeper (sped up, under a minute): the **paid** notification in the bell. Open `/patch/3072`: the card now says **DELIVERED**; the timeline has every step with explorer links; press the proof check: it fetches the proof from IPFS, hashes it in the browser and matches the hash on-chain.
- **VO:** "After the event the creator posts proof: photos and their X post. The photos go to IPFS and the hash goes on-chain. Brands have seventy-two hours to dispute. For the demo, admin fast-tracks it. Then Patched's keeper pays the creator automatically, and returns their stake. The winning brand holds a patch NFT drawn by the contract itself. It changed from Won to Printed to Delivered as the creator proved each step. Anyone can check the proof against the chain, right here."

### 2:20 – 2:40 · The social side
- **Screen:** Home feed (a listing with reactions and inline comments; a bid moment "unseated … took …" with **Outbid**) → switch to **Patchwork** → **Replay** (let it run 4 seconds) → **Find me**.
- **VO:** "Home is a feed of listings, bids and proofs, with likes and comments. Patchwork turns an event into a live graph of who sponsored whom, all from on-chain events. Replay plays the whole event back, and Find me shows where you sit in it."

### 2:40 – 2:52 · Same site, mainnet, real USDC
- **Screen:** the network toggle at the bottom of the sidebar → the modal "Mainnet uses real USDC" → continue → the same address, now on Monad mainnet. Optionally flash the mainnet market on the explorer.
- **VO:** "Everything you saw runs on testnet for the demo, and the same site switches to Monad mainnet, with real USDC."

### 2:52 – 3:00 · End card (the only non-product frame)
- **Screen:** `monad.patched.world` · "Sign in → Use the demo account" · `github.com/dhruv457457/brandboard`.
- **VO:** "Try it yourself: sign in and use the demo account. Get patched. Get paid."

## If you're over time

Cut in this order: the car and event beat (say one line over the feed instead), the sweep, the mainnet modal (keep one second of the toggle). Keep listing → bid → outbid refund → proof → payout → NFT: that's the product.

## If something fails on camera

- **AI canvas slow or failing:** pre-make the listing up to the Spots step, then record from there.
- **Keeper slow:** it runs every minute; cut the wait. If it doesn't pay within 3 minutes, check `/api/keeper/run` logs before re-recording.
- **Rival bid fails:** run the command again with `AMOUNT=` set above the current top bid.
