# Security

Patched holds other people's money in escrow, so we take reports seriously.

## Reporting a problem

Please don't open a public issue for a vulnerability. Send a direct message to [@Patched_world](https://x.com/Patched_world) on X, or to the team in [our Telegram](https://t.me/patchedworld), with:

- what you found and where (contract, address, page or API route);
- how to reproduce it;
- what an attacker could do with it.

We'll reply within two days and keep you posted until it's fixed.

## Scope

| In scope | Notes |
|---|---|
| `PatchedMarket`, `PatchReceipt`, `PatchRenderer`, `PatchAutoBidder`, `PatchSweeper`, `PatchSpotter` | Addresses in [packages/shared/src/addresses.ts](packages/shared/src/addresses.ts) |
| The web app and its API routes | [monad.patched.world](https://monad.patched.world) |
| Privy server wallets and their policies | Keeper, approver, open admin, campaign and offer wallets |

## What to know

- The contracts have 134 tests (unit, fuzz, a solvency invariant, timing and upgrade tests) but **no independent audit**.
- `PatchedMarket` is an upgradeable proxy. Owner, admin and treasury are one deployer key today; this moves to a multisig before real volume.
- Open admin and the demo account only work on play money (testnet). They switch off by themselves on real USDC.
- Secrets live in `.env.local` and are never committed.
