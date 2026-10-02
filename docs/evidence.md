# On-chain evidence

Every step of the test cycle in docs/final-plan.md, run on Monad testnet (chain 10143), newest last.

| Step | Actor | What happened | Transaction | When (UTC) |
|---|---|---|---|---|
| T1a | Team Patched (creator) | Created listing #5 "Dhruv's Token2049 fit" with 4 spots and a $1 stake | [0xafb0aca3…](https://testnet.monadexplorer.com/tx/0xafb0aca307e2ed72175ee39f97c94c7706f5c18c4061fd4b1c59d9f23a679009) | 2026-10-02 07:52 |
| T1b | Team Patched (creator) | Created listing #6 "Suhani's Monad Open fit" with 4 spots and a $1 stake | [0xbb4d1702…](https://testnet.monadexplorer.com/tx/0xbb4d17026ad4db9dce22945192507e4456c67e2d2c195521bc56907516cd602a) | 2026-10-02 07:52 |
| T2a | Open admin (Privy policy wallet), as the test account | Approved listing #6 through the policy-limited open-admin server wallet | [0x4d11b23d…](https://testnet.monadexplorer.com/tx/0x4d11b23dd7aa068e1e86d9bee16256d87ede4856691434ca40b7de7c972b6e98) | 2026-10-02 07:55 |
| T2b | Open admin (Privy policy wallet), as the test account | Approved listing #5 through the policy-limited open-admin server wallet | [0x11a6f46c…](https://testnet.monadexplorer.com/tx/0x11a6f46c18c70697cd9ee23007ee68471e39eac5b80b729cbd422a7cf30340ac) | 2026-10-02 07:55 |
| T3 | Patched Test (Privy wallet, browser) | Bid $5 on "Chest pocket" of listing #5 from a Privy embedded wallet: a sponsored approve, then the bid, no prompt and no gas | [0x77d837d6…](https://testnet.monadexplorer.com/tx/0x77d837d64256a20cb45fe02cbc3e1305ff977e4e87907b705eb884237666e92b) | 2026-10-02 08:05 |
| T4 | Alice (rival brand) | Bid $6 on "Chest pocket" of listing #5; 0x8fBf04… refunded $5 in the same transaction | [0x419332c5…](https://testnet.monadexplorer.com/tx/0x419332c5a9dde1b0b33bcfe5034208f4d98e9ab46e66077f59e8fb6448268e15) | 2026-10-02 08:05 |
| T5-T6 | Keeper, through the Privy signer on Patched Test's wallet | Auto-bid: after Alice bid $6, the keeper bid $7 from the brand's own wallet within seconds, signed through the Privy key-quorum signer and limited by its policy (max $10) | [0x28e3a8c5…](https://testnet.monadexplorer.com/tx/0x28e3a8c5a43459d4e7b4b6cea90cc91fd99aed62febdb50f5c56074c5adc58b1) | 2026-10-02 08:08 |
| T7 | Rahul (rival brand) | Bid $11 on "Chest pocket" of listing #5; 0x8fBf04… refunded $7 in the same transaction | [0x707d2568…](https://testnet.monadexplorer.com/tx/0x707d2568a457edad7e6965533d83dfd94e99c08edcef9c15da06ffa0a8dc8e6c) | 2026-10-02 08:08 |
| T8 | Patched Test (Privy wallet, browser) | Sweep: bid on "Tee center" ($8) and "Right sleeve" ($3) of listing #5 in one transaction through PatchSweeper, all or nothing | [0x0584ad7a…](https://testnet.monadexplorer.com/tx/0x0584ad7a9b11e03fbdbd79abef2585ed0aa5260501884665ad0febeb89f8d3a4) | 2026-10-02 08:09 |
| T9a | Campaign wallet (Privy server wallet + policy) | Campaign "$10 at Monad Open, at most $5 a spot": bid $3 on "Left sleeve" of listing #6 for the brand (bidFor), gas-sponsored | [0xe6677871…](https://testnet.monadexplorer.com/tx/0xe66778711a82c8c1d5372dfad64f985d90df0b12ff2d8e1100c825ebce95ff35) | 2026-10-02 08:15 |
| T9b | Campaign wallet (Privy server wallet + policy) | Bid $3 on "Jogger thigh" of listing #6. The next bid ($4) was refused by Privy's budget aggregation: it would have passed the $10 budget | [0x2a5d3397…](https://testnet.monadexplorer.com/tx/0x2a5d3397c267b182a3daef0dce7f854b3713e681ece27e7303b7984a4891e1a3) | 2026-10-02 08:15 |
| T1c | Team Patched (creator) | Created listing #7 "Dhruv's demo-day fit (test cycle)" with 3 spots and a $1 stake | [0xe2e61fb5…](https://testnet.monadexplorer.com/tx/0xe2e61fb5a20c7af912bc3c6bcb4b7618ddebfec96cc4eaf997580cf80bba0531) | 2026-10-02 08:17 |
| T2c | Admin | Approved listing #7; bidding is open | [0x3f91eb5b…](https://testnet.monadexplorer.com/tx/0x3f91eb5bf562a509571de9c90a36f81dce497d7de5f9423cd5865dfcdb103126) | 2026-10-02 08:17 |
| T3c | Kenji (rival brand) | Bid $2 on "Tee center" of listing #7 | [0xb78f94a6…](https://testnet.monadexplorer.com/tx/0xb78f94a6ed3f8002e77aaa668fcefdcd290fcd0167ffaa50bd0834bd8e2e3b83) | 2026-10-02 08:17 |
| T15 | Patched Test (Privy wallet, browser) | "Patch anyone on X": offered $5 to @dhruvpanch0li for a spot at Token2049 Singapore; the money moved into its own policy-limited Privy offer wallet | [0x6172ae36…](https://testnet.monadexplorer.com/tx/0x6172ae361a4dcfb6237339da6148e50a94409519a731297ed7f672d1c54e203f) | 2026-10-02 08:24 |
| T3d | Patched Test (Privy wallet, browser) | Bid $2 on "Chest pocket" of listing #7 (approve, then bid, sponsored) | [0x8b1fad5f…](https://testnet.monadexplorer.com/tx/0x8b1fad5f5bb67163a56982693f8e8f0041f85a03ec5e9818bf0f0a7ffa535335) | 2026-10-02 08:26 |
| T3e | Patched Test (Privy wallet, browser) | Bid $2 on "Blazer back" of listing #7 | [0x06e9b0a9…](https://testnet.monadexplorer.com/tx/0x06e9b0a960d230545fb64c3b04869ae623bc7bdcbd92b7d519325175de375a1e) | 2026-10-02 08:27 |
| T11 | Keeper (Privy server wallet + policy) | Closed bidding on listing #7 eight seconds after it ended: $6 in escrow, 3 of 3 spots sold, receipt NFTs minted to the winners | [0x2d1eb116…](https://testnet.monadexplorer.com/tx/0x2d1eb116841d9ce242685c4d32a4da0bfca97f3bb166e0ce47a807fdd7a34b19) | 2026-10-02 08:29 |
| T12 | Team Patched (creator) | Submitted proof for milestone 1 of listing #7 (2 photos); review window started | [0xe470ee99…](https://testnet.monadexplorer.com/tx/0xe470ee990d4e9bb24143d1938e66a184566c3b9fc5bf97485f78e1ae8ada0caa) | 2026-10-02 08:29 |
| T14b | Admin | Settled the dispute on spot 3 of listing #7, milestone 1: 50% to the creator, the rest back to the holder | [0x6df7fed0…](https://testnet.monadexplorer.com/tx/0x6df7fed00c19f7f0829492eeaa2fd3dde069c79923539222fd4383df3c0ba023) | 2026-10-02 08:32 |
| T13 | Patched Test (spot holder, browser) | Approved the proof for "Chest pocket" (milestone 1 of listing #7) during the review window | [0x637a324f…](https://testnet.monadexplorer.com/tx/0x637a324f7cc9ae447792c126aec17621ab7c7c1bc3d5afe4c02bbfd3e0f4d364) | 2026-10-02 08:32 |
| T14a | Patched Test (spot holder, browser) | Disputed the proof for "Blazer back" (milestone 1 of listing #7) with a reason, through the dispute sheet | [0x3260057d…](https://testnet.monadexplorer.com/tx/0x3260057d7cd9f4ac083daddee507d7087855b2aa2e05141c53dc9989a1a41861) | 2026-10-02 08:32 |
| T13b | Keeper (Privy server wallet + policy) | Released milestone 1 of listing #7 after the review window: $1.14 to the creator and a $0.06 fee for the undisputed spots; the disputed spot's share waited for the admin | [0xae240a9b…](https://testnet.monadexplorer.com/tx/0xae240a9bb8b040f230ceade15b77293e74ec0e768a78fdf0430e55bef1d7ed41) | 2026-10-02 08:33 |
| T12b | Team Patched (creator) | Submitted proof for milestone 2 of listing #7 (2 photos); review window started | [0xcec4ebc5…](https://testnet.monadexplorer.com/tx/0xcec4ebc59fc43296b3d75492f9c09d0ceb4322490d530ffcd28df0ebcb49c053) | 2026-10-02 08:34 |
| T13c | Keeper (Privy server wallet + policy) | Released the final milestone of listing #7: $3.99 to the creator and a $0.21 fee. The listing completed and the creator's $1 stake came back. Full cycle done. | [0x99a160d6…](https://testnet.monadexplorer.com/tx/0x99a160d6999785850adf73d43818b1323e8d73888b6e506d1e89ef453d03f602) | 2026-10-02 08:37 |

## Steps without a transaction

| Step | What happened | Where to check |
|---|---|---|
| T5 | Turning on auto-bid added Patched's key quorum as a Privy signer on the test wallet, with the auto-bid policy, without any prompt | `signer_delegations.signer_added_at` 2026-10-02 08:06 |
| T7 | Rahul's $11 passed the brand's $10 maximum: the keeper stopped bidding, and the brand got an "outbid" notification with the $7 refund | `notifications` (kind `outbid`) |
| T9 | Privy's budget aggregation refused the campaign's $4 bid that would have passed its $10 budget; the campaign page logs it as "Privy blocked" | `/campaigns/f278077a-7caf-4bfd-881b-1b9f607e4819` |
| T10 | Settings → Security → "Revoke Patched's access" removed the Privy signer; auto-bids stopped | `signer_delegations.revoked_at` 2026-10-02 08:20 |

## Found and fixed by this run

- **Every Privy wallet's bid failed.** Privy's `signTypedData` couldn't serialize a `bigint` (fixed in 698e49b). Then USDC rejected the permit: Privy's gas sponsorship gives each embedded wallet an EIP-7702 delegation, and USDC checks permits from an address with code through ERC-1271. Privy wallets now approve the exact amount, then bid (f26d8b0). The same fix covers sweep and outside-wallet auto-bid.
- **A campaign tried to outbid its own brand** right after winning a spot, because the index lagged behind the chain, and two runs logged one bid twice (fixed in e1444a6, with migration 0019).

## Not run yet

- **T16:** claiming the X offer needs a real sign-in with @dhruvpanch0li (manual).
- **T17:** passkey step-up on a big bid (passkeys can't be automated).
- **T18:** the Add money screen (module M5, not built yet).
- **The fee is now 1%** (rows U-fee and U-release below). Listings #5 to #8 were created at 5% and keep their payouts at the current setting, as they have no saved terms.
| T3-live | Patched Test (Privy wallet, live site) | Bid $7 on "Hoodie chest" of listing #6 on monad.patched.world after the deploy: the approve-then-bid fix works in production, and the $5 bid of 0x6aBDd3… was refunded in the same transaction | [0xdf8fb9eb…](https://testnet.monadexplorer.com/tx/0xdf8fb9eb4350a58167145695c961781740b79589f0680fb4994d357e6229915a) | 2026-10-02 14:59 |
| U1 | Team Patched (creator) | Created listing #9 "Post-upgrade check (1% fee)" with 3 spots and a $1 stake | [0xd2be268b…](https://testnet.monadexplorer.com/tx/0xd2be268bd18b7a28e60cde9c6fd881c62572df36bf9a149b84d4c8192081eae4) | 2026-10-02 19:19 |
| U2 | Admin | Approved listing #9; bidding is open | [0x8bf51680…](https://testnet.monadexplorer.com/tx/0x8bf51680157ec0382dfec2dd24294c17526519672f39d82f6a76a266a93c7a98) | 2026-10-02 19:19 |
| U3 | Priya (rival brand) | Bid $2 on "Chest pocket" of listing #9 | [0xb32dc320…](https://testnet.monadexplorer.com/tx/0xb32dc3205b458b4aa8e58db8aef5850670ebe2b0a8f6b22e10d1fce93d93500b) | 2026-10-02 19:20 |
| U4 | Team Patched (creator) | Submitted proof for milestone 1 of listing #9 (2 photos); review window started | [0x8524c440…](https://testnet.monadexplorer.com/tx/0x8524c440cf10a5c5448452f63ea3281e7587c8d889bc480b78fa8280b3c2786e) | 2026-10-02 19:24 |
| U6 | Team Patched (creator) | Submitted proof for milestone 2 of listing #9 (2 photos); review window started | [0x47839cbe…](https://testnet.monadexplorer.com/tx/0x47839cbeb55cd0ea3ccddb7c6ffd43e09707f4689799284d9efe14f454f8f2ea) | 2026-10-02 19:28 |
| U-upgrade | Deployer (market admin) | Upgraded the live testnet market to the hardened code (new implementation 0x4b08D9F1…): same proxy, same listings, same escrow; the deadline, pause, saved-terms and stale-dispute fixes are live | [0x6fccffe0…](https://testnet.monadexplorer.com/tx/0x6fccffe007eec2878e63bcf5cb94a828d36be1065e52d7fb7447800ad4af3596) | 2026-10-02 19:32 |
| U-fee | Deployer (market admin) | Set the market fee to 1% with setParams; every other setting unchanged | [0xaa3e7573…](https://testnet.monadexplorer.com/tx/0xaa3e7573b6154b08cfdb2e0960b5d302bdb857c7e2a2b8fa3f2a7d1582e892f6) | 2026-10-02 19:32 |
| U-close | Keeper (Privy server wallet + policy) | Closed listing #9; the first proof deadline was set 6 minutes after the auction ended, so the contract moved both deadlines later by 54.6 minutes (DeadlinesShifted): the creator has an hour to deliver | [0x57ee46b4…](https://testnet.monadexplorer.com/tx/0x57ee46b49e7bf1b542d208810e6d7ff6d9790c2528913a191904e1cb3e1998c2) | 2026-10-02 19:32 |
| U-release1 | Keeper (Privy server wallet + policy) | Released milestone 1 of listing #9 at the new 1% fee: $0.594 to the creator, $0.006 fee (1% of $0.60) | [0x2075b760…](https://testnet.monadexplorer.com/tx/0x2075b7607dfe9bc8e08183d6011a87609de736428ff16baa010b7b8bb019ea67) | 2026-10-02 19:33 |
| U-release2 | Keeper (Privy server wallet + policy) | Released the final milestone of listing #9: $1.386 to the creator, $0.014 fee; the listing completed and the stake came back | [0x309ff93f…](https://testnet.monadexplorer.com/tx/0x309ff93f05282a3d02229ab888310bae47281d245dd7448022d4b73c3103273b) | 2026-10-02 19:33 |

## After the contract hardening (2026-10-03)

The U-rows above the table end show the upgrade of the live testnet market after a mentor review (see
[docs/contracts.md](contracts.md), "Timing and settings") and a short cycle on listing #9 that proves the new code:
the deadline shift at close (`DeadlinesShifted`, +54.6 minutes) and both payouts at the saved 1% fee. Twelve new
tests in `contracts/test/Timeline.t.sol` cover the rest (pause grace, fee and review window kept per listing,
stale-dispute settlement, hand-worked payout recipients).
