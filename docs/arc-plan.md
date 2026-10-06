# Arc Microgrants: plan for the Patched mirror (Arc mainnet + Circle, no Monad, no Privy)

Researched 2026-09-29. This is for the **separate mirrored repo** (see AGENTS.md: "a mirrored repo for Arc (Circle) Microgrants on Arc mainnet").

## The grant in one paragraph

- **Prize:** 20 microgrants of 500 USDC each.
- **Deadline:** submissions close **Oct 14 2026, 23:59 ET (Oct 15, 09:29 IST)**, one day after Metropolis. Reviews are **rolling**, so an earlier submission gets an earlier answer.
- **Needed:** a **live deployment on Arc mainnet** (a link judges can open), a **public repo**, a short description of what it does and **what it uses Arc for**, and a public builder profile (GitHub, X or Farcaster).
- **Not eligible:** testnet-only builds, mockups, decks, projects with no Arc component, and work already funded by Circle or Arc.
- **Judged on:** relevance to Arc, technical credibility, build quality, and whether it's worth taking further. "Promise counts for more than traction."

## Arc facts we need

| | Value |
|---|---|
| Mainnet chain id | `5042` (testnet `5042002`) |
| RPC | `https://rpc.mainnet.arc.io`; also QuickNode `https://rpc.quicknode.mainnet.arc.io` (we already use QuickNode), Alchemy, dRPC, Blockdaemon |
| Explorer | `https://explorer.arc.io` |
| USDC | `0x3600000000000000000000000000000000000000` (the same address on testnet) |
| Gas | **Paid in USDC.** There's no separate gas token. |
| CCTP (domain 26) | TokenMessengerV2 `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d`, MessageTransmitterV2 `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` |
| Gateway | GatewayWallet `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE`, GatewayMinter `0x2222222d7164433c4C09B0b0D809a9b52C04C205` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` |

**USDC gotchas on Arc (these will break things if ignored):**

1. **One balance, two decimal systems.** The ERC-20 interface uses **6 decimals**; the native gas balance uses **18 decimals**. It's the same money.
   - Our contracts only use `transferFrom` / `approve` (6 decimals), so they're fine.
   - Never mix `msg.value` or `eth_getBalance` (18 decimals) into amounts.
2. **Gas comes out of the same USDC balance.** A brand bidding "everything I have" will fail unless gas is sponsored or we keep a small reserve. The UI's max-bid must subtract a gas buffer when gas isn't sponsored.
3. **The permit domain is different.** On Arc, `name()` is `"USDC"` and `version()` is `"2"` (Ethereum mainnet uses "USD Coin"). Our `useBid` reads `name()` / `version()` from the contract, so it should work. **Test one real `bidWithPermit` on Arc before relying on it.**

## Privy → Circle: feature-by-feature

What we use today (from the Monad app's README table) and the Circle equivalent on Arc:

| # | What Patched uses (Privy) | Circle on Arc | Status |
|---|---|---|---|
| 1 | Sign-in with **X** and email, in our own design (headless hooks) | User-controlled wallets: **Google, Apple, Facebook, email OTP, PIN**. **No X.** Modular wallets: **passkeys only.** | **Gap.** We need our own login (see "Login" below) |
| 2 | Embedded wallet created at login | **Modular wallets** (passkey smart account, `ARC` mainnet supported), or **user-controlled wallets** (EOA/SCA) | Yes |
| 3 | Gas sponsorship | **Gas Station / Circle Paymaster** (`paymaster: true` on modular-wallet user operations; SCA wallets for developer wallets). Circle charges gas + 5%. | Yes. **Confirm Gas Station is enabled for `ARC` mainnet in Circle Console.** |
| 4 | **Silent** permit signing (one tap, no pop-up) | User-controlled wallets **always show Circle's confirmation UI** (challenge + PIN or confirm). Modular wallets prompt a **passkey** per operation. | **Changed.** Not silent, but modular wallets can **batch approve + bid in one user operation**, so it's still one confirmation |
| 5 | Keeper server wallet + **policy engine** (only `closeBidding` / `release` / `markFailed`) | **Developer-controlled wallets** (entity secret, `createContractExecutionTransaction`). **No policy engine.** | **Gap.** The allowlist moves into our code, and ideally a role check in the contracts |
| 6 | Idempotency keys | **Built in:** every mutating Circle request *requires* an `idempotencyKey` (UUID) | Yes, stronger |
| 7 | **Campaign wallets whose policy checks `bidFor.bidder`, `bidFor.amount`, and an end time** | Developer-controlled wallets have no calldata rules | **Gap.** Build the **`PatchCampaign` contract** from SPEC-v2 (budget, per-spot max, end time, bidder = brand), and have the campaign wallet only call it |
| 8 | Auto-bid (`PatchAutoBidder` + keeper) | Same contract; keeper runs on a developer-controlled wallet | Yes |
| 9 | Sweep (`PatchSweeper`) | Same contract, or a native **batched user operation** in modular wallets | Yes (batching makes it simpler) |
| 10 | Passkey step-up for large bids | Modular wallets **are** passkeys; every operation is passkey-confirmed | Yes (built in) |
| 11 | Linked accounts: verified brand by work email | No account linking | **Gap.** Our own email-code check (Resend or Supabase Auth OTP) |
| 12 | Wallet export | User-controlled: **no key export** (MPC). Modular: a passkey-owned smart account, recoverable through the Circle recovery flow, but no raw key export | **Gap.** Drop it and explain in the README |
| 13 | Server-side auth (Privy access token + linked accounts) | Circle isn't an identity provider | **Gap.** Our own sessions |
| 14 | Polling `transactions().get` | **Webhooks** for transaction states (`X-Circle-Signature`), included | Yes, better (Privy webhooks needed Enterprise) |
| 15 | "How we use Privy" README table | Becomes "How Patched uses Arc + Circle" | Rewrite |

**Summary:**
- **7 of 15 map directly** (some better): wallets, gas, idempotency, auto-bid, sweep, passkeys, webhooks.
- **8 need replacing or dropping:** X login, branded headless login, silent signing, the policy engine (keeper + campaigns), linked-account verification, wallet export, server auth, and the README.

## What Arc + Circle give us that Privy + Monad didn't

- **USDC is gas.** A brand only ever holds dollars. "No second token" is Arc's core pitch and it fits Patched perfectly.
- **CCTP / Gateway funding.** Brands bring USDC from Base, Ethereum, etc. natively. This fixes the "no way to fund on Monad" gap without banks or fiat. Circle's Bridge Kit or App Kits cover the UI.
- **Webhooks included**, plus required idempotency.
- **Batched, sponsored user operations** (approve + bid in one passkey confirmation).
- **Optional Arc-native extra: EURC.** Brands could bid in EURC with Arc's on-chain FX. Only if time allows.

## Recommended architecture for the mirror

**Login (the biggest change):**
- Use our own auth: **Supabase Auth with X (Twitter) OAuth + email magic link**. Supabase is already in the stack.
- It gives the creator's X handle (our identity and page URL) and verified emails (for brand verification), and issues the session our API routes check. This replaces `lib/server/auth.ts`.
- After login, create or load the user's **Circle modular wallet** (passkey) and store the address on the profile.

**User wallets: Circle Modular Wallets** (`@circle-fin/modular-wallets-core` + viem).
- Passkey smart account, gas via `paymaster: true`, batched calls.
- **Bid:** `[approve(market, amount), bid(listing, patch, amount)]` in one sponsored user operation. This replaces the permit flow, though `bidWithPermit` stays as a fallback.
- **Sweep:** the same approach with several `bid` calls.
- If the passkey setup blocks anyone during testing, fall back to user-controlled wallets with email OTP.

**Server wallets: Circle developer-controlled wallets** (`@circle-fin/developer-controlled-wallets`).
- Keeper: `closeBidding`, `release`, `markFailed`, auto-bid `execute`.
- Uses `createContractExecutionTransaction` with named function signatures and the required idempotency key.
- Transaction states come from **Circle webhooks** instead of polling.
- **Allowlist in code**, plus contract-side checks. The contracts are already permissionless for these calls; that's fine.

**Campaigns:** a new **`PatchCampaign`** contract (the SPEC-v2 fallback).
- Holds the brand's budget and enforces `bidder == brand`, `amount <= maxPerSpot`, `block.timestamp <= endsAt`, and the total ≤ budget.
- Leftover budget returns to the brand. The keeper just calls `campaign.bid(...)`.
- This is actually *more* verifiable than a Privy policy, because judges can read the rules on-chain.

**Indexer:**
- **Keep our own indexer** (`services/indexer`) pointed at Arc through QuickNode's Arc RPC. It's the least work, since only the chain config changes.
- Optionally add **Alchemy webhooks** (Arc is supported) or **Envio / Goldsky** later.
- **Circle webhooks** cover our own wallets' transactions.

**Contracts:**
- Redeploy `PatchedMarket`, `PatchReceipt`, `PatchAutoBidder`, `PatchSweeper` (+ `PatchCampaign`) on chain `5042` with USDC `0x3600…0000`.
- Verify them on the Arc explorer.
- Set a sensible `minBond` / `newCreatorCap` in USDC.

**Config:**
- `packages/shared`: add `arcMainnet` (5042) to the chain config and `DEPLOYMENTS[5042]`.
- Remove the Monad chains from the mirror.
- **Keep chain values in config only** (AGENTS.md rule).

## Timeline (grant closes Oct 14 23:59 ET, Metropolis closes Oct 14 09:29 IST)

Monad work comes first, since Metropolis closes earlier. Split the Arc work so an eligible submission exists early:

| When | Arc work | Result |
|---|---|---|
| Day 1 (after Metropolis core is safe) | Create the mirror repo. Fund a deployer with a few USDC on Arc. Deploy and verify the contracts on 5042. Point the indexer at Arc. | **Eligible:** "deployed and working on Arc mainnet" |
| Days 2–3 | Supabase Auth (X + email). Circle modular wallets for users (passkey, sponsored, batched approve+bid). | Users can list and bid gaslessly on Arc |
| Day 4 | Circle developer-controlled wallet keeper + webhooks. `PatchCampaign` contract + campaign flow. | Auctions close and pay out automatically |
| Day 5 | CCTP / Gateway "bring USDC from another chain". README "How Patched uses Arc + Circle". A real listing + bid + payout on Arc mainnet. | Submit (rolling review, so earlier is better) |

**Fast fallback if time runs out:**
- Arc's docs list **Privy as a supported provider on Arc**, so the mirror could ship on Privy first and swap to Circle wallets after.
- The grant doesn't require Circle Wallets, only a working Arc mainnet deployment with a clear Arc use.
- The Circle swap mainly raises "relevance to Arc" and "technical credibility".

## Before starting: set up in Circle Console
- API key + **entity secret** (registered and stored securely; never commit it).
- Modular wallets: **Client Key** + **passkey domain** (our production domain).
- **Gas Station** enabled for `ARC` mainnet, with a spending policy.
- A webhook endpoint (public HTTPS) for transaction notifications.
- Add each new variable to `.env.example` with a comment.

## Deeper research (round 2, 2026-09-29)

### The chain: rules that affect our contracts and keeper
- **Minimum base fee is 20 gwei** (ceiling 20,000 gwei). Transactions below the floor are *silently dropped*. Set `maxFeePerGas ≥ 20 gwei` and a 1 gwei tip. The target cost is about **$0.001 per ERC-20 transfer**.
- **Finality is instant and deterministic** (Malachite BFT, under a second). No confirmation counts or reorg handling are needed, so the indexer and keeper can treat an included transaction as final.
- **Block timestamps** don't decrease and have one-second granularity; blocks within the same second share a timestamp. Our anti-snipe logic (`block.timestamp`) is fine. Order events by block number, not time.
- **`PREVRANDAO` always returns 0.** We don't use randomness. If we ever do, use an oracle.
- **The USDC blocklist is enforced at runtime.** A transfer to a blocklisted address reverts. Our market already credits `refundable` when a push fails (`Refunded(pushed=false)` / `Credited`), so refunds can't brick an auction. Keep that design.
- "Transfers to contracts are not guaranteed" refers to **native value** sends. We only use the ERC-20 interface (`transferFrom` / `transfer`). **Test the full bid → refund → release cycle on Arc before trusting it.**
- No blob transactions and no withdrawals. Neither affects us.
- **Tooling:** Circle ships **Arc Foundry** (`arc-forge`, `arc-cast`, `arc-anvil`), a Foundry fork that simulates Arc's EVM rules locally. It isn't on `foundryup`; download the binaries from `circlefin/arc-foundry`. Run our 56 tests with `arc-forge test --network arc` before deploying.
- **Verification:** the explorer is **Blockscout**: `arc-forge verify-contract <addr> <path:Name> --chain-id 5042 --verifier blockscout --verifier-url https://explorer.arc.io/api/`.
- Circle's contract platform recommends compiling with **`evmVersion: "paris"`** (no `PUSH0`) when deploying through its API. Arc's EVM-differences page doesn't list `PUSH0` as missing, so the Arc Foundry tests will tell us. If deployment fails, set `evm_version = "paris"` in `foundry.toml`.
- **Privacy (Arc Privacy Sector) isn't live yet.** Don't plan around it.

### Circle wallet stack on Arc (confirmed)
- **Gas Station is live on Arc mainnet and testnet**, for user-controlled and developer-controlled wallets. It requires smart accounts (SCA or modular MSCA); EOAs can't be sponsored. Gas is billed to our card, plus 5%.
- **Circle Paymaster** (users pay gas in USDC, 10% surcharge) is **not on Arc**, and isn't needed there because gas is USDC anyway.
- **Modular wallets:** passkey smart accounts on Arc mainnet; `sendUserOperation({ calls: [...], paymaster: true })` batches **approve + bid** into one sponsored passkey confirmation. There's also a module system (multisig, subscriptions, **session keys**), which could run auto-bid from the brand's own account. Availability on Arc still needs checking.
- **User-controlled wallets:** Google, Apple, Facebook, email OTP, PIN. **No X login**, and every transaction goes through Circle's confirmation UI.
- **Developer-controlled wallets** (`@circle-fin/developer-controlled-wallets`): entity secret, wallet sets, `createContractExecutionTransaction`, required UUID idempotency keys, webhooks (`X-Circle-Signature`). **No policy engine.**
- **Circle Smart Contract Platform** (`@circle-fin/smart-contract-platform`) can deploy and import contracts and read them. Writes still go through the wallets SDK. **Its event monitors and webhooks are documented for Arc testnet only**, so on mainnet we keep our own indexer.

### App Kit (`@circle-fin/app-kit`): every feature is supported on Arc mainnet
| Module | Use in Patched | Notes |
|---|---|---|
| **Unified Balance (Gateway)** | **"Fund your bids from any chain":** a brand deposits USDC on Base, Ethereum, Arbitrum, etc. into one balance and spends it on Arc in **under 500 ms** | The best answer to "how do brands get USDC onto Arc". GatewayWallet `0x7777…00eE`, GatewayMinter `0x2222…C205`. |
| **Bridge (CCTP V2)** | Move USDC to or from Arc (domain 26) | For creators cashing out to another chain |
| **Send** | Payout transfers, returning campaign budgets | Simple |
| **Swap (USDC ↔ EURC)** | Optional: EU brands bid in EURC | Needs a `kitKey`. Only if time allows. |
| **Earn** | Optional and risky: idle campaign budget earning yield | Separate API keys per environment. Skip for the grant. |
| **Onramp** | Buying USDC by card | **Out of scope:** AGENTS.md says no banks or fiat. Only if the user changes that rule for the Arc mirror. |

Adapters: `@circle-fin/adapter-viem-v2`, `@circle-fin/adapter-ethers-v6`, `@circle-fin/adapter-circle-wallets` (developer-controlled). There's no modular-wallet adapter listed, so for user-side App Kit calls wrap the modular account's viem client, or use Gateway's API directly.

### Arc-native standards worth using (strong "relevance to Arc")
- **ERC-8183 Jobs:** Arc's escrow standard. The *client* funds USDC escrow, the *provider* submits a `bytes32` deliverable hash, and the *evaluator* completes (pays) or rejects. The states are Open → Funded → Submitted → Completed / Rejected / Expired. **This is almost exactly a Patched deal** (brand = client, creator = provider, Patched or the brand = evaluator, proof hash = deliverable). The reference contract on testnet is `0x0747EEf0706327138c69792bF28Cd525089e4583`; check for a mainnet address.
  - **Cheapest angle:** make our milestone escrow *speak* ERC-8183: emit its events, or expose `submit` / `complete` names mapping to `submitProof` / `release`, and describe Patched deals as ERC-8183 jobs in the README.
- **ERC-8004 registries** (identity, reputation, validation). Testnet addresses: `0x8004A818…BD9e`, `0x8004B663…8713`, `0x8004Cb1B…4272`. They're agent-focused, but `register(metadataURI)` mints an identity, and the reputation registry could carry **creator delivery reputation**. Optional; check mainnet addresses first.
- **Refund Protocol:** Circle's EIP-712 non-custodial USDC escrow with disputes, used by the **`circlefin/arc-escrow`** sample (Next.js + Supabase + developer-controlled wallets + webhooks + AI-checked deliverables). **It's almost our stack.** Read it for Circle wallet, webhook and Supabase patterns to copy. Note the open issues about refund-after-withdraw double-pay; don't copy its contract blindly.
- **Commerce Payments Protocol** (`circlefin/arc-ecommerce-payments`): escrow-based USDC/EURC checkout. Not needed; our market already escrows.
- **Compliance:** Chainalysis, Elliptic and TRM Labs support Arc wallet screening. Optional: screen brand wallets before campaigns.

### Sample apps to crib from (all `github.com/circlefin/…`)
- `arc-escrow`: developer-controlled wallets, Refund Protocol, webhooks, Supabase.
- `arc-p2p-payments`: **gasless passkey modular wallets**, our user-wallet flow.
- `arc-commerce`: developer-controlled wallets + webhook settlement.
- `arc-multichain-wallet`: Gateway unified balance with wagmi, our "fund from any chain" UI.
- `arc-fintech`: Bridge Kit + Gateway treasury.
- `arc-stablecoin-fx`: App Kit swap with platform fees.

## Open questions to verify during the build
1. ~~Is Gas Station live on Arc mainnet?~~ **Yes**, for Circle SCA and modular wallets (not EOAs).
2. Does a real `bidWithPermit` on Arc succeed with the "USDC" / "2" domain? (Fallback only; the main path is the batched approve + bid.)
3. Are modular-wallet **session-key modules** available on Arc mainnet? If yes, auto-bid can run from the brand's own account.
4. Do ERC-8183 and ERC-8004 have **mainnet** deployments on Arc? If not, deploy our own ERC-8183-compatible escrow or skip.
5. Do our contracts pass `arc-forge test --network arc`, and do they deploy without `evm_version = "paris"`?

Sources: [Arc connect](https://docs.arc.io/arc/references/connect-to-arc), [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses), [Arc EVM compatibility](https://docs.arc.io/arc/references/evm-compatibility), [Arc account abstraction providers](https://docs.arc.io/arc/tools/account-abstraction), [Arc data indexers](https://docs.arc.io/arc/tools/data-indexers), [Circle supported blockchains](https://developers.circle.com/wallets/supported-blockchains), [Circle Wallets](https://www.circle.com/wallets), [Circle skills: user-controlled](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-user-controlled-wallets/SKILL.md), [modular](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-modular-wallets/SKILL.md), [developer-controlled](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-developer-controlled-wallets/SKILL.md) wallets, [Arc USDC permit docs PR](https://github.com/circlefin/arc-node/pull/290).
