# What past Privy prize winners did, and what Patched should copy (2026-09-27)

We studied 24 ETHGlobal projects that won a Privy prize. For each, we read the showcase page, and for 15 of them we also read the repo code. One page (Sweem) was behind a Cloudflare check, so it was read through a fetch instead. Only Privy usage is covered here.

**Done from the gaps below (2026-09-27, same day):**
- Gap 1 (config): tried `createOnLogin: "all-users"` and reverted it. It gave MetaMask users a second, empty wallet and moved their account onto it. The account's wallet is now always the one linked first; one-tap bidding for MetaMask users needs a deliberate "fund your Patched wallet" step instead.
- Gap 2 (idempotency): every keeper send now carries an `idempotency_key` — see [keeper.ts](../apps/web/src/lib/server/keeper.ts).
- Still open: session signers (needs a key quorum registered in the Privy dashboard first, an operator step, not just code), campaign wallets with policies, "Patch anyone on X", the key-quorum team vault, deposit addresses, and test accounts.

**Checked against the code on 2026-09-30:**
- Done since: campaign wallets with policies ([campaigns.ts](../apps/web/src/lib/server/campaigns.ts), [campaignPolicy.ts](../apps/web/src/lib/market/campaignPolicy.ts)) with `bidFor.bidder`, `bidFor.amount` and `current_unix_timestamp` rules; transaction polling for sponsored sends ([privy.ts](../apps/web/src/lib/server/privy.ts)); a "keep my wallet or get a fresh Patched wallet" choice at wallet sign-in. The keeper policy allows the v3 market and auto-bidder and refuses everything else (`scripts/privy-policy-check.mjs`, run 2026-09-30).
- Not built: signers, "Patch anyone on X", the team vault, deposit addresses, a judge test login, linked-X data, a Privy aggregation for the campaign budget (the budget is capped only by the wallet balance today), and a "what's verified" transaction per README row.
- Installed SDKs already cover all of it: `@privy-io/node` 0.35 has `aggregations`, `keyQuorums`, `intents` and `users().create` with `twitter_oauth`; `@privy-io/react-auth` 3.45 has `useSigners`, `useAuthorizationSignature` and `useDepositAddress`. No upgrade needed.
- `users().create` with a `twitter_oauth` account needs the numeric X user id (`subject`), not only the handle.

**Decided 2026-09-30: build everything below except Farcaster and x402.** Order (bounty value per day, deadline Oct 14 09:29 IST):

| # | Feature | Operator step first (Privy dashboard / accounts) |
|---|---|---|
| 1 | Judge test login + "what's verified" tx per README row | Enable Test accounts |
| 2 | "Patch anyone on X" (pregenerated wallet for an X handle, offer waits for them) | A way to turn a handle into a numeric X user id (X API access, or another source) |
| 3 | Share-to-earn referrals (market upgrade) | None |
| 4 | **Built 2026-09-30.** Auto-bid through signers (`addSigners` with a policy, one-tap revoke), `PatchAutoBidder` stays the fallback for outside wallets | Key quorum registered by API (`scripts/privy-signer-setup.mjs`), no dashboard step. Apply migration 0015. Proven by `scripts/privy-signer-check.mts`; the bid rules still need a run against a live listing. |
| 5 | Linked X data on creator pages (reach, floor suggestion, new-creator gate) | Same X data source as #2 |
| 6 | Campaign budget as a Privy aggregation | None |
| 7 | Team hoodie vault on a 2-of-3 key quorum (`intents` + `useAuthorizationSignature`) | None |
| 8 | Deposit from any chain (`useDepositAddress`), mainnet only if Monad is supported | Check Monad support |

## How winners win Privy prizes

1. **The Privy feature is the product, not a login add-on.**
   - Sweem: "Delegation is the whole product."
   - PayGate: the approval workflow *is* Privy key quorums.
   - Publi-cité, an ad platform like us: payouts run on server wallets limited by the policy engine.
2. **Crypto disappears for the user.** Prize names include "Crypto behind the scenes", "Best Consumer App", "Best financial flow". ArcBeam: "If you don't look under the hood, you might not even notice that it's an on-chain app."
3. **They name every primitive they use.** Sweem's README has a "Privy control" row pointing to `useSigners().addSigners` / `removeSigners`. PayGate lists `useAuthorizationSignature`, `override_policy_ids` and key quorums. Judges check code.
4. **They're honest in the README** about what is verified and what isn't (Sweem's "known gaps" section).

## Who used what

| Project | Prize | Privy primitives in the code |
|---|---|---|
| Sweem | Best financial flow | `useSigners().addSigners({ address, signers: [{ signerId, policyIds }] })`, `removeSigners` (one-button revoke), a key quorum wrapping the executor's authorization key, a **policy generated from an allowlist file** (not hand-written), `useExportWallet` |
| PayGate | Best B2B financial product | Organization wallets, `wallets().create({ additional_signers: [{ signer_id, override_policy_ids }] })`, **key quorums with M-of-N approvals**, `privy.intents().rpc(walletId, …)`, `useAuthorizationSignature().generateAuthorizationSignature` signed in each approver's browser |
| goddid.money | Best App Using Signers | `useSessionSigners` + `policyIds`, then server `wallets().ethereum().sendTransaction` with `authorization_context` so the protocol acts while the user is offline |
| ArcBeam | Best App Using Native Gas Sponsorship | Embedded wallet, `useSign7702Authorization`, gas sponsorship behind a wrapped EIP-1193 provider, fully gasless USDC flow |
| Trade Royale | Best AI agent built with Privy | **One server wallet per player** (`wallets().create`), `sponsor: true` on every send, polling `transaction_id` for the real hash (sponsored sends come back with an empty hash), `resolveDepositorAddress` from the user's linked accounts |
| Vouch | Best cross-chain funding experience | `useDepositAddress().createDepositAddress({ destinationChain, destinationAddress, destinationCurrency })`, per-user server wallets that act for offline users |
| Publi-cité | Best Policy Engine with Server Wallets | A server wallet per user, **policies created by API** (`POST /v1/policies`) with value caps and address allowlists, `PATCH` to update them, **idempotency keys** so a reward can't be paid twice |
| Agent 4 Your Mom | Best Policy Engine with Server Wallets | Server wallet per agent, a policy-limited allowlist of recipients |
| OSS-Rewards-Agent | Best consumer experience with Server Wallets | GitHub login, server wallet signs claims, the policy engine limits signing |
| Victus | Best AI Managed Wallet | Server wallet + `sponsor: true` + idempotency keys |
| Payce | Best Stablecoin App | A **wallet created for a phone number before the person signs up**; they claim it later through a magic link |
| HeyLola | Best existing project upgraded | Embedded wallets for sponsors; **server wallets for things that aren't users** (each dog, each shelter) |
| Aragorn | Best onchain financial product | Work-email login for members, `useFundWallet`, **`privy.apps().getTestAccessToken()`** for test logins |
| x402-utils | Best App Using x402 | Embedded wallet + delegated signing so each pay-per-call payment feels automatic |
| ChainSpeed | Best Consumer App | `useEmbeddedEthereumWallet`, gasless, no seed phrase |
| Secret Pineapple | Best Financial App | Login + smart accounts for merchants and customers |
| Cosurf | Best App Involving AI | Login (email, social, wallet) |
| LinkHub | Honorable mention | A **linktree-style page** with Privy social login |
| OnlyFrames | Infrastructure wizard | Farcaster login + an embedded wallet tied to the Farcaster ID |
| HearMeOut | Most engaging use of frames | Spotify + Farcaster login |
| Fundev | Using Privy | GitHub login |
| Swift Easy | Crypto behind the scenes | (showcase page gives no details) |
| Gossip Girl | Best consumer experience with Server Wallets | Wallet management for minting and trading |

### Remaining repos (second pass)

- **Unavailable (404, deleted or private):** Cosurf, Gossip Girl, LinkHub, AstroFi. HeyLola never listed a repo. For these, the showcase text above is all there is.
- **Swift Easy** ("Crypto behind the scenes"):
  - Users are identified by **phone number** (`privy.getUserByPhoneNumber(phone)`).
  - The server signs transactions from that user's embedded wallet (`privy.walletApi.rpc(...)`, the older delegated-actions API; today that's done with signers) and broadcasts them itself.
  - The user never sees a wallet: a bank partner triggers the payout and it happens.
- **OnlyFrames** ("Infrastructure wizard"):
  - `loginMethods: ['farcaster']` with `embeddedWallets.createOnLogin: 'all-users'`, so every Farcaster user gets a signing wallet.
  - Uses the linked Farcaster ID's **reputation score** (Karma3/OpenRank) to decide who can *sell*. Low-reputation users can only buy. This is a Sybil gate.
- **HearMeOut** ("Most engaging use of frames"):
  - Links **Spotify and Farcaster** through Privy and uses the linked account's data (what you're listening to) as the product.
  - `createOnLogin: "users-without-wallets"`.
- **Fundev** ("Using Privy"):
  - GitHub login only (`createOnLogin: 'users-without-wallets'`).
  - A GitHub App webhook pays the bounty when the fixing PR merges, so a linked account triggers the payout.

**Takeaways for us:**
- **Linked accounts are data, not just login.** Winners read the linked account (Spotify, Farcaster reputation, GitHub PRs) and act on it.
  - For us: read the creator's linked X account to show real follower count and reach on their page.
  - Suggest a floor price from it.
  - Check the V2 "X proof" post automatically.
  - Gate new listings the way OnlyFrames gates sellers: low-reach or brand-new accounts get the new-creator cap.
- **Our config:** `createOnLogin: "users-without-wallets"` means people who log in with MetaMask never get an embedded wallet, so no sponsored gas or signers for them. OnlyFrames uses `"all-users"`. Consider giving every user an embedded wallet and treating the external wallet as a funding source.

### Third batch (older winners, 2022–2024, mostly Farcaster Frames)

| Project | Prize | What they did with Privy |
|---|---|---|
| Frogue | Headless frame apps (prize pool) | **Creates a Privy embedded wallet for a Farcaster ID from inside a frame, before the user ever logs in** (`createOrFindEmbeddedWalletForFid`, via Privy's REST API with the app secret). Game NFTs land in that wallet, and the player sees them after signing in. |
| InfoCast | Honorable mention | The same wallet-per-FID pattern. NFTs are minted to the user's Farcaster-linked Privy wallet "behind the scenes". |
| Glyphcast | Honorable mention | Farcaster login + `useExperimentalFarcasterSigner()`: `requestFarcasterSigner` once, then **`submitCast` posts to Farcaster for the user**. Transactions go from embedded wallets. |
| Soundcaster | Honorable mention | **Spotify + Farcaster** login as linked accounts. |
| FrameQuest | Honorable mention | Mint NFTs with just an email or Farcaster ID. |
| Puzzlemon | Honorable mention | Privy connector set to Farcaster login. |
| Funding the Future | Honorable mention | Login only (`createOnLogin: users-without-wallets`). |
| BunnyAI | Consumer Award | **SMS login** + embedded wallet + account abstraction, so paying per AI query feels like web2 billing ("near parity to a web2 billing experience"). |
| Swirl | Best UX | Privy login so researchers never set up a wallet. The funding logic (a Safe + voting) is separate. |
| Solvify | Integration Wizard | `useCreateWallet` to make a wallet **on demand** for users who connect without one. External wallets are still supported. |
| Keyko (2022) | Best data-driven UX | Privy's old *data* API (encrypted user data). That product is gone and not relevant now. |
| SkyFrames | Honorable mention | Repo deleted; the showcase doesn't mention Privy. |

**Takeaways:**
- **Wallets for people who haven't signed up yet are a proven pattern** (Frogue, InfoCast, Payce).
  - Privy today supports `privy.users().create({ linked_accounts: [{ type: "twitter_oauth", subject: <X user id>, username }], wallets: [{ chain_type: "ethereum" }] })`. The wallet appears when that person first logs in with X.
  - This is exactly what **"Patch anyone on X"** needs.
  - Catch: `twitter_oauth` needs the numeric X user id (`subject`), so we must resolve the handle to an id first (X API, or have the brand paste the profile link and resolve it server-side).
- **Posting on the user's behalf is a Privy feature** (Glyphcast's Farcaster signer). For us: a creator could let Patched auto-post the "I got patched" / proof cast on Farcaster. X posting isn't a Privy feature, so the V2 X proof stays manual.
- **Consumer wins came from web2-feeling payments** (BunnyAI's SMS login + pay-per-use), which again says: hide the crypto.

## Where Patched stands

**Already done (good, keep it visible):**
- Email or X login with an embedded wallet.
- Native gas sponsorship.
- One-signature permit bids.
- A policy-limited keeper server wallet.
- Auto-bid (`PatchAutoBidder`) and sweep (`PatchSweeper`).
- Passkey MFA step-up for large bids.
- Verified brands through a linked work email.
- `useExportWallet`.
- A "How Patched uses Privy" README table.

**Gaps and incorrect assumptions:**

1. **"Session signers aren't enabled on our Privy app" is a setup step, not a limit.**
   - Winners enable signers by registering a **key quorum** (wrapping our authorization public key, which the keeper already has) in the dashboard. That gives a `signerId`; then call `useSigners().addSigners({ address, signers: [{ signerId, policyIds: [policyId] }] })`, and revoke with `removeSigners`.
   - Gotcha from Sweem: a signer added *without* `policyIds` keeps an unconstrained override, and existing delegations don't pick up a new policy. **Always pass the policy id when adding the signer.**
2. **The keeper sends without idempotency keys.** Publi-cité and Victus use them, so a retried `closeBidding`, `release` or auto-bid `execute` can't be sent twice. Add one per action, e.g. `release:<listing>:<milestone>`. Privy supports a `privy-idempotency-key` header; check the exact option name in `@privy-io/node`.
3. **The open question in the V2 spec (SPEC-v2 §6) is answered: yes.**
   - Policies can match decoded calldata arguments: `field_source: "ethereum_calldata"`, `field: "bidFor.bidder"` / `"bidFor.amount"`, with the ABI attached.
   - Policies can expire: `field_source: "system"`, `field: "current_unix_timestamp"`, operator `lte`, the campaign end.
   - **Stateful aggregations** (`POST /v1/aggregations`, then `field_source: "reference"`, `field: "aggregation.<id>"`) can cap the **total** a campaign spends (sum of `bidFor.amount` over a window). That's enforced by Privy, not just by the wallet balance.
   - A **template variable** `{{wallet.address}}` lets one policy work for many wallets.
   - So `PatchCampaign` isn't needed.
4. **Funding on Monad:** the card onramp doesn't list Monad. `useDepositAddress().createDepositAddress({ destinationChain: "eip155:143", destinationAddress, destinationCurrency: <USDC> })` (cross-chain deposits, powered by Relay) may support Monad mainnet. **Test it before promising it.** Vouch won a prize with exactly this feature.
5. **Judges need a login.** Enable **Privy test accounts** in the dashboard. `privy.apps().getTestAccessToken()` can pre-seed a demo brand and creator.

## Features to add (ranked by bounty value per day)

1. **Campaign wallets with Privy policies** (already in SPEC-v2). Publi-cité won with the same idea for ads.
   - One server wallet per campaign.
   - One policy using `{{wallet.address}}` plus calldata rules (`bidFor.bidder == brand`, `bidFor.amount <= max`), a time rule (`current_unix_timestamp <= end`), and an aggregation for the total budget.
   - Show the rules to the brand in plain words.
2. **Signers-based auto-bid from the brand's own wallet.** Keep `PatchAutoBidder` as the fallback, but make the headline flow "Let Patched bid for you up to $X", using `addSigners` with a generated policy and a one-tap **Revoke** (`removeSigners`) in Settings. Sweem and goddid won with this.
3. **"Patch anyone on X"** (pregenerated wallets, as Payce and HeyLola did).
   - A brand makes an offer to any X handle, even someone not on Patched.
   - Patched creates a Privy user with that Twitter account linked and a pregenerated wallet, and escrows the offer.
   - When the person signs in with X, the wallet and the offer are already theirs.
   - Strong for the Social track (growth through X) and for Privy.
4. **Team hoodie vault on a key quorum** (as PayGate did).
   - The team's shared wallet is owned by a 2-of-3 key quorum of the members.
   - Spending, such as the printing budget or moving the pot, is proposed as `privy.intents().rpc(...)`, and teammates approve in their own browsers with `useAuthorizationSignature`.
5. **Idempotency keys + transaction polling** in the keeper (small, correctness).
6. **Crypto deposit from any chain** (`useDepositAddress`) if Monad is supported, and **test accounts** for judges.
7. Optional and small: **Farcaster login**, since winners in social categories used it. Or an **x402 endpoint** (for example, brands pay a few cents per AI poster or report call). Only if time allows.

## README checklist (what judges look for)

- A "How Patched uses Privy" table, one row per primitive, with a file link. Add rows for signers (`addSigners` / `removeSigners`), policies with calldata, time and aggregation rules, idempotency keys, deposit addresses and test accounts as they land.
- A "What's verified" line per feature (the transaction hash from a real run).
- A demo script where each Privy feature has its own captioned moment.
