# Patched

Get patched. Get paid. Creators sell patches on their outfit, car or team hoodie; brands bid in USDC per patch; escrow on Monad pays out when the creator shows up.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Contracts: [docs/contracts.md](docs/contracts.md)
- Design system: [docs/design-system.md](docs/design-system.md)
- Data model: [docs/data-model.md](docs/data-model.md)
- Agent guide: [AGENTS.md](AGENTS.md)

## Setup

```bash
pnpm install
pnpm contracts:setup
pnpm contracts:test
cp .env.example .env.local
```

## How Patched uses Privy

Privy does much more than sign-in here. Every row is live in the app and links to the code.

| Privy feature | What it does in Patched | Code |
|---|---|---|
| Login with X or email + embedded wallets | A brand or creator gets a self-custodial wallet in seconds, with no seed phrase and no extension. The X handle becomes the creator's page. | [PrivyAuthProvider.tsx](apps/web/src/components/providers/PrivyAuthProvider.tsx), [api/profile](apps/web/src/app/api/profile/route.ts) |
| Gas sponsorship | Bids, listings, proofs and disputes cost users no MON on testnet (`sponsor: true`); it's a setting per network. | [useTx.ts](apps/web/src/lib/market/useTx.ts), [useBid.ts](apps/web/src/lib/market/useBid.ts) |
| Silent typed-data signing | A bid is one USDC permit signature plus one transaction, with no separate approve step. | [useBid.ts](apps/web/src/lib/market/useBid.ts), [permit.ts](apps/web/src/lib/market/permit.ts) |
| Server wallet + policy (keeper) | A Privy server wallet closes auctions, releases milestone payouts and marks no-shows. Its policy allows only `closeBidding`, `release` and `markFailed` on our market, plus `execute` on the auto-bidder. Anything else is rejected with `policy_violation` (checked by a script). | [keeper.ts](apps/web/src/lib/server/keeper.ts), [privy-keeper-add-chain.mjs](apps/web/scripts/privy-keeper-add-chain.mjs), [privy-policy-check.mjs](apps/web/scripts/privy-policy-check.mjs) |
| Auto-bid on the policy-limited server wallet | "Keep me on top up to $X": when a brand is outbid, the keeper bids the next step for them within seconds. The contract caps every bid at the brand's max. | [useAutoBid.ts](apps/web/src/lib/market/useAutoBid.ts), [PatchAutoBidder.sol](contracts/src/PatchAutoBidder.sol) |
| Sweep in one signature | Pick several patches, sign once, and all bids land in one gasless transaction, or none do. | [SweepPanel.tsx](apps/web/src/components/market/SweepPanel.tsx), [PatchSweeper.sol](contracts/src/PatchSweeper.sol) |
| Passkey MFA step-up | Bids, sweeps and auto-bid maximums over a threshold ask for a passkey (Face ID, Touch ID, Windows Hello) first. | [stepUp.ts](apps/web/src/lib/market/stepUp.ts), [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Linked accounts: verified brands | A brand links a work email (Privy one-time code). If the domain matches its website, its patches show "Verified brand". This stops impersonation. | [BrandVerify.tsx](apps/web/src/components/market/BrandVerify.tsx), [verify-brand route](apps/web/src/app/api/profile/verify-brand/route.ts) |
| Wallet export | "Your wallet is yours": export the embedded wallet's key to any wallet. | [AccountMenu.tsx](apps/web/src/components/navigation/AccountMenu.tsx) |
| Server-side auth | Every API route verifies the Privy access token (JWKS) and reads the user's wallet and verified emails from Privy's API, never from the browser. | [auth.ts](apps/web/src/lib/server/auth.ts) |

Not used, and why: **Funding (card or bank on-ramps)** is left out on purpose: Patched has no banks or fiat, and wallets hold USDC only. **session signers** aren't enabled on our Privy app, so auto-bid runs on the policy-limited server wallet instead. **Transaction webhooks** need Privy's Enterprise plan, so notifications come from our own indexer and Supabase Realtime.

## Contracts

| Contract | Monad testnet | Monad mainnet (TestUSD run) |
|---|---|---|
| PatchedMarket | `0xd3808dE425493934f036f8E77ef5a4de332e9552` | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` |
| PatchReceipt (NFT) | `0x598Ea7C3Cf739Dbea1B809d5Cd0174818b680a8f` | `0x18Cb49292c1562932a1EdcC6674a30Fd71b27F97` |
| PatchAutoBidder | `0x6388BDAc2b256Df65CF0f29DFd946Fa2479f32DA` | `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` |
| PatchSweeper | `0x65f0e25e5D503FCc5549624D6f9B138b17A3054f` | `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba` |
| TestUSD (faucet token) | – | `0xB0fabbBc9a26dC78b200a36b2344cAc2518D0e3f` |

All verified on Sourcify. Details: [docs/contracts.md](docs/contracts.md).
