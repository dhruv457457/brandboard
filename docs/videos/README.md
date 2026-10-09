# Submission videos

Three videos for the Metropolis submission (deadline **Oct 14, 09:29 IST**; we submit **Oct 12**), plus an optional promo clip.

| # | Video | Form field | Limit | Rules from the form | Script |
|---|---|---|---|---|---|
| 1 | **Privy bounty** | Bounties → Privy | **≤ 2 min** | Privy's rule: "Using Privy only for login/authentication will not qualify." Judges want a demo that clearly shows what Privy powers, with bonus points for several Privy features | [01-privy-bounty.md](01-privy-bounty.md) |
| 2 | **Technical demo** | Demo and pitch → demo | **≤ 3 min** | "Must run on Monad Mainnet or Testnet. Show the working product, not slides or a code walkthrough." | [02-technical-demo.md](02-technical-demo.md) |
| 3 | **Pitch** | Demo and pitch → pitch | **≤ 2 min** | "Introduce your team, the problem you solve, and why you are building it." | [03-pitch.md](03-pitch.md) |
| – | Promo (optional) | Optional promotion | ≤ 30 s | Not judged; used on X after the hackathon | reuse the Remotion ad: the `Ad` composition is exactly 30 s (900 frames at 30 fps); the newest render is `marketing/video/out/patched-ad-v5.mp4`. Watch it first: anything it shows must still be true |

Hosts allowed: YouTube (unlisted is fine), Loom, Vimeo. Upload each, check the link in a private window, and paste it into the form.

## Recording order

1. **Privy bounty video first** (today). It reuses most of the demo setup, and its parts are short and independent.
2. **Technical demo** next. It has one time-critical beat (see below).
3. **Pitch** last, once the contest numbers are in (Oct 12, 9 AM IST), so the traction line is current.

## Do this first: one deadline that can't slip

Listing **#12** (dhruvpanch0li, Monad Open Singapore, status Delivering) has its last proof due on **Oct 10, 11:26 UTC (16:56 IST)**.
- If no proof is posted by then, the keeper calls `markFailed`. The brands get refunded, the creator's stake goes to them, and the record shows a miss.
- If the proof is posted, it's the best live beat in the technical demo: proof → fast-track → the keeper pays → the patch NFT turns **Delivered**. Record that beat **before Oct 10, 16:00 IST** (see [02-technical-demo.md](02-technical-demo.md), beat 6).

## Prep checklist (both screen videos)

**Accounts and windows**
- **Window A, brand:** Chrome incognito → `monad.patched.world` → Sign in → **Use the demo account**. It's the Privy test account "Patched Test Brand", wallet `0x8fbf…99d1`, with **$37.80** of test USDC on Oct 9. If it drops under $25, top it up from the Circle faucet (Monad Testnet, USDC) or move test USDC from the deployer.
- **Window B, creator:** Chrome normal profile, signed in as **@dhruvpanch0li** with X.
- **Terminal, rival brand:** a bot outbids on cue, which makes auto-bid and refunds happen on camera. Run from `apps/web`:

  ```bash
  BIDDERS_FILE=<path to the bot wallets json> STEP=bid BOT=Alice LISTING=14 SPOT=0 npx tsx scripts/onchain-cycle.mts
  ```

  This bids the minimum next bid. Add `AMOUNT=` to choose. It also appends a row to `docs/evidence.md`, which is fine.

**Listings to use (testnet, live on Oct 9)**

| Listing | What | Use it for |
|---|---|---|
| **#14** `dhruvpanch0li.monad.patched.world/14` | Dhruv's outfit at Get Patched Week, 6 spots, $10 floors, bidding until **Oct 11 16:05 UTC** | bidding, auto-bid, sweep (the demo account is a different wallet, so it can bid) |
| **#16** shaurya01836, team hoodie, 6 spots, bidding until **Oct 13** | a second listing for sweep or a campaign |
| **#13** dhruvpanch0li, car, 14 spots, until Oct 11 | the car road layout |
| **#12** dhruvpanch0li, Delivering, milestone 1 due Oct 10 | proof → payout → NFT Delivered |
| **Patch NFT 3072** (`/patch/3072`) | listing 12, spot 0 | the NFT page: card, timeline, proof check |
| Event **#5** `/e/get-patched-week` | | event page, Spotted wall, Patchwork |

**Screen**
- Record at 1920×1080, browser zoom 110–125%, bookmarks bar hidden, one tab per window, light theme (show dark once).
- Turn on cursor highlight and click circles (OBS plugin, or Loom's setting).
- Close Slack, mail and notifications. Make sure no seed phrase, private key or `.env` file is ever on screen. Cut the export modal before the key appears.
- Sign both windows in 10 minutes early. Privy's session restore is slow on first load, so wait for the balance to show before you start.

**Editing**
- Speed up waiting (AI canvas, a transaction confirming) to 2–4× and label it "sped up". Never fake a result.
- One caption per Privy feature in the same place each time, bottom-left, e.g. **PRIVY · Gas sponsorship**.
- Voice-over recorded separately reads cleaner than talking while clicking. The scripts are written to be read aloud at about 150 words a minute.
- End card for the demo: live URL, "Sign in → Use the demo account", the repo link.

## What to paste in the form next to the videos

- **Live product:** `https://monad.patched.world`
- **Access instructions (private field):** "Open https://monad.patched.world → Sign in → Use the demo account (one tap, a Privy test account with test USDC on Monad testnet). Or sign in with your own X or email; test USDC comes from https://faucet.circle.com (Monad Testnet). Admin is open on purpose for judges at /admin, through a policy-limited Privy wallet. The sidebar switch moves the same site to Monad mainnet (real USDC)."
- **Repo:** `https://github.com/dhruv457457/brandboard` (public, or shared with `metropolis@hackathon.monad.xyz`)
