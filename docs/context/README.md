# Patched: the full context

Last updated: **2026-10-09**. This folder is the one place to read to understand the whole project: what it is, how every part works, where the code is, what is live, what the numbers are, and what comes next. It is written for the team and for any AI agent picking up the work. When something here goes stale, fix it in the same commit as the change.

**Patched: "Get patched. Get paid."** Creators sell logo spots on their outfit, car or team hoodie. Brands bid for each spot in USDC on Monad. The money sits in an on-chain escrow and is paid to the creator in steps, only after they prove they showed up. Winning a spot mints a patch NFT that updates as the creator proves each step.

- Live site: **https://monad.patched.world** (testnet and mainnet on the same address; a switch in the sidebar changes the chain)
- Creator pages: `https://<handle>.monad.patched.world`
- X: [@Patched_world](https://x.com/Patched_world) (brand), [@dhruvpanch0li](https://x.com/dhruvpanch0li) (founder)
- Telegram: [t.me/patchedworld](https://t.me/patchedworld) (invite link `https://t.me/+TrSZaCSMngo3YWQ9`)
- Hackathon: Monad Metropolis, track 3 *Social, Attention & Culture*. Deadline **Oct 14 2026, 09:29 IST**. Main sponsor bounty: **Privy**.

## The files

| File | What is in it |
|---|---|
| [01-product.md](01-product.md) | The product end to end: the three surfaces, creating a listing, bidding, escrow and proof, the patch NFT, every page (home, creator page, profile tabs, Automate, events, settings, admin), social features, notifications |
| [02-privy.md](02-privy.md) | Every way Patched uses Privy, in detail and with file paths: sign-in, wallet creation, gas sponsorship, silent bids, the keeper, signers for auto-bid, campaign wallets and budget aggregations, "Patch anyone on X", passkeys, verified brands, the demo account, and why open admin is open on purpose |
| [03-contracts-and-chain.md](03-contracts-and-chain.md) | The six contracts, every address on Monad testnet and mainnet, the parameters, the NFT, upgrades, Monad quirks, on-chain evidence |
| [04-infrastructure.md](04-infrastructure.md) | How it runs: Next.js, Supabase, the indexer, the keeper cron, IPFS, AI, X lookups and share posts, creator subdomains and share links, one domain for two chains, Vercel, environment variables, rate limits, moderation, migrations |
| [05-patchwork-graph.md](05-patchwork-graph.md) | Patchwork, the live on-chain graph of an event: what it shows, how it is built, the use cases |
| [06-community-and-traction.md](06-community-and-traction.md) | X accounts, the Telegram group, the Get Patched Week contest and its tracking, today's traction numbers, how to re-count them |
| [07-gtm-and-future.md](07-gtm-and-future.md) | Business model, go-to-market plan, competitors, what is left before submission, and the roadmap after it |

## Where things stand (Oct 9)

| Area | State |
|---|---|
| Testnet app (10143) | Live, full loop proven on-chain (25 transactions in [../evidence.md](../evidence.md)) |
| Mainnet (143), real Circle USDC | Contracts deployed 2026-10-08 with `DeployMainnet.s.sol`. Same site, switch chain in the sidebar. **No listings yet.** Privy gas sponsorship for mainnet is not switched on yet, so wallets need MON for gas there |
| Contract tests | 134 passing (unit, fuzz, invariant, upgrade, fork) |
| Privy features in use | 14 distinct uses, from sign-in to policy-limited server wallets (see [02-privy.md](02-privy.md)) |
| Real users (testnet) | 14 profiles, 7 with X, 4 creators, 10 listings, 8 bids from 4 brands, $93 of bids (our own wallets left out) |
| Contest | Get Patched Week, Oct 8 to Oct 11 09:00 IST, $30 USDC in prizes |

## Before you change anything

- Read [../../AGENTS.md](../../AGENTS.md) first: folder ownership, conventions (no emojis, USDC as `bigint` with 6 decimals, money logic never in the frontend, `prefers-reduced-motion`), and commands.
- Commit straight to `main`, one topic per commit.
- After a contract change: `forge test`, regenerate the ABIs into `packages/shared`, update [../contracts.md](../contracts.md) and [03-contracts-and-chain.md](03-contracts-and-chain.md).
- Chain values live in `apps/web/src/lib/config.ts` and `packages/shared/src/addresses.ts`. Never hard-code an address.
- Demo shortcuts (the demo account, open admin) only run while `PLAY_MONEY` is true (testnet, or mainnet on a test token). They switch off by themselves on real USDC.

## Older docs this folder summarises

[SPEC.md](../SPEC.md) (V1 spec) · [SPEC-v2.md](../SPEC-v2.md) (V2 app structure) · [contracts.md](../contracts.md) (full contract API) · [privy.md](../privy.md) (the Privy table) · [evidence.md](../evidence.md) (on-chain test run) · [nft-plan.md](../nft-plan.md) · [patchwork-graph-plan.md](../patchwork-graph-plan.md) · [contest-handoff.md](../contest-handoff.md) · [final-plan.md](../final-plan.md) · [track3-competitors.md](../track3-competitors.md) · [android-and-social-plan.md](../android-and-social-plan.md) · [arc-plan.md](../arc-plan.md) · [design-system.md](../design-system.md) · [data-model.md](../data-model.md) · [TESTING.md](../TESTING.md)
