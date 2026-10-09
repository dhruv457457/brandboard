# 06 · Community, the contest and traction

Traction is 20% of the score and "founder and market readiness" is another 25%, so this matters as much as code.

## Channels

| Channel | What | Link |
|---|---|---|
| X, brand | Demos, build updates, the hand-drawn patches for the launch outfit, contest threads | [@Patched_world](https://x.com/Patched_world) |
| X, founder | Build-in-public, quotes the brand's threads | [@dhruvpanch0li](https://x.com/dhruvpanch0li) |
| Telegram group "Patched.World" | Early testers try the product on testnet and say what to fix; contest announcements | [t.me/patchedworld](https://t.me/patchedworld) (invite `t.me/+TrSZaCSMngo3YWQ9`) |
| Privy write-up | "Everything we learned" about using Privy beyond login (lessons in [02-privy.md](02-privy.md#lessons-worth-writing-up-blog-material)) | Medium link still to add to the README |

**Telegram is a community channel only.** No Telegram bot or mini app: the user decided against a Telegram app on 2026-10-03.

**Honesty rules for everything public:**
- Testnet bidding uses test USDC from the faucet; say so plainly.
- Never show other companies' logos as bidders or partners.
- Events like ETHGlobal are named in text only, with "not affiliated".

## Get Patched Week (the contest)

A 3-day contest that gets real people through the whole loop (sign in with X, list, bid, proof, payout) before submission.

| | |
|---|---|
| When | Oct 8 00:00 IST to **Oct 11 09:00 IST** (`DEADLINE` = 2026-10-11T03:30Z) |
| Event | "Get Patched Week Mumbai", testnet event **#5**, `https://monad.patched.world/e/get-patched-week`. Created from the open-admin Privy wallet, tx `0x3ae86464…3504` |
| Page | `https://monad.patched.world/contest` (`app/contest/ContestView.tsx`) |
| Prizes | $30 in real USDC on Monad mainnet: 3 × $10, paid by hand, with the transaction links posted publicly |
| Framing | a practice round before ETHGlobal Mumbai (Nov 5–7), not affiliated |

**Four mandatory steps:**
1. Join the Telegram group (a checkbox; it can't be checked automatically).
2. Sign in with X (checked: the account has an X handle).
3. Do one real action on event #5 after it opened: list, bid or post a Spotted photo (checked against `listings`, `bids` and `spots`).
4. Post on X tagging @Patched_world with #GetPatched (the link goes in the form).

**Tracks:**
- **Best post** ($10): creativity and honesty, not views, so small accounts can win.
- **Best feedback** ($10): a README, blog or Docs link, or 300 to 4,000 characters in the form. The prompts: first two minutes, listing, bidding, what broke, would you use it for real, the one thing to build next.
- **Lucky draw** ($10): complete the four steps.

**Provably fair draw** (`lib/contest.ts` `pickWinner`, `/api/contest/draw`): take the eligible entries oldest first, then the hash of the **first Monad testnet block after the deadline**; the winner is `entries[hash % count]`. The page shows the block number, hash, count and index with an explorer link, so anyone can check.

**The page, top to bottom:**
1. Hero with a live countdown, "Count me in" and "Join the Telegram".
2. A ticker of people who joined.
3. Winners, once drawn.
4. The four steps, each with a live check mark.
5. The tracks.
6. "Broke? Same. Here's free money." (the test USDC faucet).
7. "You're the brand too" (every feature, linked).
8. Timeline, entry form, FAQ.

**Data:**
- `contest_entries` (0028): one per Privy user; re-submitting updates it.
- `contest_signups` (0029): "Count me in" taps.
- `contest_funnel` (0029): anonymous steps.
- RLS is on with no public read; emails are never public.
- Admins (`CONTEST_ADMINS`, `CONTEST_ADMIN_WALLETS`) review entries, mark them valid and add winners (`components/contest/ContestAdmin.tsx`, `/api/contest/admin`).

### Tracking (the contest funnel)

`lib/contestTrack.ts` counts three anonymous steps once per browser (a random id kept in `localStorage`, nothing personal): **view** (opened the page), **join** (tapped "Count me in"), **form** (started the entry form). They are sent to `/api/contest/track` and stored in `contest_funnel`. Vercel Analytics covers page views site-wide.

**Funnel today (Oct 9, 13:30 UTC):** 12 views → 4 joined → 3 started the form → **0 entries** submitted. The thread and the Telegram reminder need to push people from "started" to "submitted" before Oct 11, 09:00 IST.

## Traction numbers

From `apps/web/scripts/metrics.mts` on **2026-10-09 13:33 UTC**. "Real" leaves out the demo bots, the Privy test account and our deployer, admin and keeper wallets, so the slide never counts us.

### Testnet (10143)

| | All | Real |
|---|---|---|
| Profiles | 25 | **14** |
| with X linked | 8 | **7** |
| Creators with a listing | 5 | **4** |
| Listings | 16 | **10** |
| Bids | 49 | **8** |
| Brands that bid (unique wallets) | 14 | **4** |
| Bid volume | $484 | **$93** |
| Campaigns | 1 | 0 |
| Offers to X handles | 2 | **1** |
| Proofs posted | 7 | |
| Milestone payouts to creators | $82.33 | |
| Follows | 4 | 2 |
| Spotted photos | 5 | 3 |
| Reactions | 12 | 12 |

### Mainnet (143), real USDC

Contracts live since Oct 8; **no listings or bids yet**. (Profiles, follows, spotted and reactions are shared tables, so they show the same counts on both chains.)

### Outside the app (from the pitch deck, as of Oct 8)

- 22 people in the Telegram group.
- 3.4K X impressions in 7 days.
- 1.4K views on the Privy write-up, 13 reposts.
- Privy's CEO liked the contest post.

### How to update these

```bash
cd apps/web
npx tsx scripts/metrics.mts                            # testnet
NEXT_PUBLIC_CHAIN_ID=143 npx tsx scripts/metrics.mts   # mainnet
```

Update the deck's traction slide and this file after the contest closes on Oct 11.

## What would move the numbers most before Oct 12

1. **Contest entries.** The 3 people who started the form: remind them in Telegram and by X reply; post a "how to enter in 2 minutes" video.
2. **One real mainnet cycle with real USDC**, even at $5: a real creator, a real brand, a real payout, with explorer links. Only one rival in track 3 showed mainnet transactions.
3. **Real creators.** The founder's network (the deck's creator, 70M+ Instagram views) listing actual event outfits.
4. **Before and after** numbers on the traction slide: Oct 8 vs Oct 11.
