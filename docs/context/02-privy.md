# 02 · Privy, in detail

Privy is how nobody has to know they're using a wallet. **Every wallet, signature and payment on Patched goes through Privy, and every key Patched owns sits behind a Privy policy.** Privy is the main sponsor bounty we target; the rule is "used beyond login", and this file lists each use with where it lives in the code. The shorter public table is [../privy.md](../privy.md); the README has the picture "who can sign what".

All paths below are under `apps/web/src/` unless they start with `apps/web/scripts/` or `contracts/`.

## Overview: who signs what

| Signer | Kind of Privy wallet | What its policy allows | Code |
|---|---|---|---|
| The user | Embedded wallet (made for X and email users) or their own wallet (MetaMask etc.) | Anything the user signs; Patched signs nothing for them unless they add our signer | `components/providers/PrivyRuntime.tsx` |
| Auto-bid signer (our key quorum on the user's wallet) | Signer on the user's embedded wallet | `bid` on the brand's chosen spots up to their maximum; `approve` of the market up to the largest maximum | `lib/market/autoBidPolicy.ts`, `lib/server/autoBidSigner.ts` |
| Keeper | Server wallet | `closeBidding`, `release`, `markFailed` on the market; `execute` on `PatchAutoBidder` | `lib/server/keeper.ts`, `apps/web/scripts/privy-keeper-setup.mjs` |
| Approver | Server wallet | `approveListing` on the market only | `lib/server/autoApprove.ts`, `apps/web/scripts/privy-approver-setup.mjs` |
| Campaign wallet (one per campaign) | Server wallet + policy + budget aggregation | `bidFor` for that brand only, up to the per-spot cap, until the end time; `approve` of the market; `transfer` back to the brand | `lib/market/campaignPolicy.ts`, `lib/server/campaigns.ts` |
| X offer wallet (one per offer) | Server wallet, same as a campaign, plus one transfer | As a campaign, plus one transfer to the X user's own wallet for their listing stake | `lib/server/xOffers.ts` |
| Open admin (play money only) | Server wallet | `approveListing`, `rejectListing`, `fastTrack`, `resolveDispute`, `createEvent`, `setEventActive` | `app/api/admin/act/route.ts`, `apps/web/scripts/privy-open-admin-setup.mjs` |

Every server wallet is owned by our **authorization key** (`PRIVY_AUTHORIZATION_KEY_ID` / `PRIVY_AUTHORIZATION_PRIVATE_KEY`), so a leaked app secret alone can't move anything, and any call outside a policy is refused by Privy with `policy_violation`.

## 1. Sign-in in our own design

- **Where:** `/welcome` (`app/welcome/WelcomeView.tsx`), using Privy's **headless hooks** through our auth bridge (`components/providers/PrivyRuntime.tsx`):
  - **X:** `useLoginWithOAuth().initOAuth({ provider: "twitter" })`. Marked "Recommended": the X handle becomes the creator's page, and the X name, picture and follower count fill the profile.
  - **Email:** `useLoginWithEmail()`: `sendCode`, then `loginWithCode`.
  - **Own wallet:** headless Sign-In With Ethereum (`useLoginWithSiwe`): the picked browser wallet shows one signature and Privy never opens a window. "More wallets" opens Privy's own list (WalletConnect, phone wallets).
- Privy's own window, when it shows, is branded: our logo, orange `#FF5A1F`, "Welcome to Patched", "No wallet needed. We make one for you." (`PrivyProvider` config).
- After sign-in: a profile screen (name, handle checked live by `/api/profile/handle`, role: sell, sponsor or both). The profile row is created by `/api/profile`.
- Signing in on a creator subdomain sends you to the main domain and back again (`middleware.ts` keeps `next`).

## 2. Wallet creation

- **X and email users get a Privy embedded wallet:** self-custodial, no seed phrase, no extension. Config `embeddedWallets.ethereum.createOnLogin: "users-without-wallets"`. As a safety net, the bridge calls `createWallet()` right after sign-in if the account still has none, with one retry (`PrivyRuntime.tsx`, "Email and X sign-ins need a wallet too").
- **MetaMask users keep MetaMask.** We used `"all-users"` once; it gave MetaMask users a second, empty wallet and moved their account to it, so we switched.
- **Which wallet is "yours":** the one chosen at sign-in (saved in Privy `customMetadata.accountWallet` by `/api/profile/wallet`), else the one linked first. The server uses the same rule (`lib/server/auth.ts`).
- **Privy's confirmation pop-ups are off** (`showWalletUIs: false`): bids are confirmed in our own UI.
- **Wallet export:** "Your wallet is yours": Settings → Security exports the embedded wallet's key (`useExportWallet`).
- **The on-chain name:** before a Patched wallet's first bid or listing, the app writes its name on-chain (`setBrandName`, `lib/market/useOnchainName.ts`) so the NFT shows a name instead of an address.

## 3. Gas sponsorship

- Patched wallets pay **no gas**. Every transaction from an embedded wallet goes through Privy's `sendTransaction(..., { sponsor: true })` (`lib/market/useTx.ts`, `lib/market/useBid.ts`): bids, approvals, listings, proofs, disputes, spotting, sweep, signer auto-bid.
- Outside wallets sign in their wallet and pay a little MON.
- A switch per network: `NEXT_PUBLIC_GAS_SPONSORED` (`lib/config.ts`, `GAS_SPONSORED`). Server wallets use `KEEPER_GAS_SPONSORED`.
- **State:** on testnet it's on. On mainnet it's **off** until gas sponsorship for Monad mainnet is enabled in the Privy dashboard. Until then, mainnet wallets and the keeper need MON.

## 4. Silent, sponsored bids (and a bug the chain found)

- An **embedded wallet** approves the exact amount, then bids: two sponsored transactions, no prompt (`lib/market/useBid.ts`).
- An **outside wallet** signs one USDC permit and sends `bidWithPermit` (`lib/market/permit.ts`).
- Why not permits for Privy wallets: gas sponsorship gives the wallet an **EIP-7702 delegation**, so the address has code, and USDC then checks a permit with ERC-1271 and rejects it. The on-chain test run found this ([../evidence.md](../evidence.md)).
- Privy's `signTypedData` sends typed data as JSON, so uint256 values go as strings (`jsonSafe` in `PrivyRuntime.tsx`).

## 5. The keeper: a server wallet with a policy

- A Privy server wallet runs everything that has to happen on time:
  - closes auctions when they end;
  - releases milestone payouts after the review window;
  - marks no-shows;
  - answers auto-bids;
  - runs campaigns.
- Code: `lib/server/keeper.ts` (`runKeeper`, `respondAutoBids`).
- **Policy:** only `closeBidding`, `release`, `markFailed` on our market and `execute` on `PatchAutoBidder`, per chain. Anything else is refused. `apps/web/scripts/privy-policy-check.mjs` proves it. `apps/web/scripts/privy-keeper-add-chain.mjs` adds the rules for a new chain (done for mainnet).
- **Idempotency:** every send carries an `idempotency_key` for the *situation* (the action, the listing, the milestone, and for auto-bid the top bid it answers), namespaced by chain. A retried tick can't pay or bid twice.
- **When it runs:** Supabase `pg_cron` calls `/api/keeper/run` every minute (migration `0013_keeper_cron.sql`; secret in Supabase Vault), and right after each indexer sync that sees new logs.

## 6. Auto-bid: Privy signers on the brand's own wallet

- "Keep me on top up to $X" on a Patched wallet adds our **key quorum as a signer** with a **policy** (`useSigners().addSigners({ address, signers: [{ signerId, policyIds: [policyId] }] })` in `PrivyRuntime.tsx`; server side `lib/server/autoBidSigner.ts`, `app/api/autobid/route.ts`).
- **The policy lists the brand's auto-bids:** `bid` on those spots only (`bid.id`, `bid.patchId`, `bid.amount` ≤ max) and `approve` of the market up to the largest max (`lib/market/autoBidPolicy.ts`).
- **Lowering or turning off** narrows the policy in place.
- **A new spot or a higher maximum needs the brand to approve again:** a new policy, which only counts once the wallet swaps our signer onto it (`removeSigners`, then `addSigners`). A stolen session can't raise anything.
- **When the brand is outbid,** the keeper bids the next step from the brand's own wallet within seconds. If the wallet is out of USDC or allowance, the auto-bid shows **Paused** and the brand is told what to fix (at most once an hour per spot).
- **Revoke in one tap** in Settings → Security (`removeSigners`, then `/api/autobid` "revoke" empties the policy).
- **Outside wallets** can't take a Privy signer, so they use `PatchAutoBidder` (`contracts/src/PatchAutoBidder.sol`): the keeper calls `execute()` and the contract caps each bid at the maximum. It is weaker (the maximum is public, so shill bidding is possible), which is why Patched wallets use the signer.
- **Proof:** `apps/web/scripts/privy-signer-check.mts`; on-chain, the T5–T6 row in [../evidence.md](../evidence.md).
- **Setup:** key quorum `PRIVY_SIGNER_QUORUM_ID` / `NEXT_PUBLIC_PRIVY_SIGNER_ID`, made by `apps/web/scripts/privy-signer-setup.mjs`.

## 7. Campaigns: server wallets with brand-written policies and a stateful budget

- A brand says "spend up to $300 at Token2049, never more than $40 a spot, until the event ends, cheapest spots first" (or "prime spots only"). Built in `/campaigns/new` (`app/campaigns/new/CampaignBuilder.tsx`).
- Each campaign gets **its own Privy server wallet and its own policy**, written from those settings (`lib/market/campaignPolicy.ts`):
  - `bidFor` on our market, only for this brand (`bidFor.bidder`), at most the per-spot cap (`bidFor.amount`), until the end time (`current_unix_timestamp`);
  - `approve` only for the market;
  - `transfer` only back to the brand.
- The brand sees the same rules **in plain words and as JSON** before funding.
- **The budget is a Privy aggregation**, a stateful policy (`lib/server/privy.ts`, `createAggregation`, `deleteAggregation`):
  - It adds up the `bidFor.amount` the wallet signs, and a rule only signs while the total stays within the budget. Privy counts the bid being checked, so the last bid can't overshoot.
  - Each bid is simulated, then checked by Privy (`eth_signTransaction`; aggregations are only evaluated when Privy signs), then sent with sponsored gas.
- **Limits we found:**
  - The window is at most 72 hours, and the running total lags a few seconds, so checks are 5 seconds apart.
  - An app gets **10 aggregations**, and one aggregation keeps a single total for every wallet on it, so campaigns can't share one.
  - What we built: one aggregation per live campaign, deleted when it ends. Past 8 live campaigns, a new one goes without and relies on the per-bid cap plus a wallet that only holds its budget.
- **Proof:** `apps/web/scripts/privy-campaign-budget-check.mts` ($3 + $2 of a $5 budget approved; the bid that would pass $5, a bid over the cap and a bid for another brand refused). On-chain, rows T9a–T9b in [../evidence.md](../evidence.md).

## 8. Patch anyone on X: pregenerated wallets

- A brand offers money to **any X handle**, even someone who has never used Patched (`/automate#x-offer`, `app/api/offers`, `app/offers/[id]/OfferView.tsx`).
- The server looks up the handle's numeric X id (`lib/server/xLookup.ts`: the official X API when `X_BEARER_TOKEN` is set, else the free FxTwitter API).
- It then finds or creates the Privy user (`lib/server/xOffers.ts`, `privyUserForX`):
  - `privy.users().getByTwitterSubject({ subject })`, or
  - `privy.users().create({ linked_accounts: [{ type: "twitter_oauth", subject, username }], wallets: [{ chain_type: "ethereum" }] })`.
- When that person first signs in with X, Privy logs them into this user, so the wallet and the offer are already theirs.
- The offer money waits in a **campaign-style wallet** whose policy also allows exactly one kind of transfer: their listing stake, to their wallet only. It buys their spot when they list. One tap shares the offer on X.
- **Proof:** `apps/web/scripts/privy-x-offer-check.mts`; on-chain, the offer row in [../evidence.md](../evidence.md).

## 9. Passkey step-up (MFA)

- Bids, sweeps, auto-bid maximums and campaign or offer budgets of **$1,000 or more** (`NEXT_PUBLIC_STEP_UP_USD`) need a passkey: Face ID, Touch ID, Windows Hello (`lib/market/stepUp.ts`).
- Uses Privy MFA (`useMfa().promptMfa`, `useMfaEnrollment`). Once a passkey is on, Privy asks for it before the wallet signs, then remembers it for a short while.
- Turn it on in Settings → Security.

## 10. Linked accounts

- **Verified brands:** a brand links a **work email** with a Privy one-time code (`useLinkAccount().linkEmail`). If the domain matches its website, its bids and patches show "Verified brand". This stops impersonation. Free mail domains don't count (`lib/brandDomain.ts`, `app/api/profile/verify-brand/route.ts`, `components/market/BrandVerify.tsx`).
- **X profile data:** signing in with X fills the profile from the account Privy links: X name, full-size picture, follower count (refreshed at most once a day), so brands see real reach (`lib/server/auth.ts`, `app/api/profile`).

## 11. Server-side auth

- Every API route that acts for someone verifies the **Privy access token** (JWKS, `PRIVY_JWKS_URL`). It never trusts a wallet sent by the browser (`lib/server/auth.ts`).
- Routes that move money or read private data get the wallet, linked wallets and verified emails from Privy's API (`getSessionUser`).
- Light actions on your own account (follows, reactions, spotted photos) read the wallet from our `profiles` row for the verified user, saving a Privy round trip.

## 12. The demo account (test accounts)

- A **Privy test account** (fixed email and code: `DEMO_LOGIN_EMAIL` / `DEMO_LOGIN_CODE`, served by `app/api/demo-login`) is behind **"Use the demo account"** on the sign-in card. It signs a judge in as a brand with its own wallet in one tap.
- **Only on play money** (`PLAY_MONEY`, `lib/config.ts`). On real USDC the button disappears.
- Everyone shares it, so it can't add a passkey, export its key or change its email in the app, and the server refuses to switch its wallet or verify a brand on it (`lib/server/demoAccount.ts`, `lib/demoAccount.ts`).
- The same account signs in the end-to-end UI tests (`E2E_TEST_EMAIL` / `E2E_TEST_CODE`, `apps/web/e2e/signed-in.spec.ts`).

## 13. Listings go live by themselves: the approver wallet

The market still has a Pending state, but nobody reviews listings. A Privy server wallet whose policy allows exactly one call, `approveListing` on our market, moves each new listing to Active within seconds (`lib/server/autoApprove.ts`). Reported listings are hidden afterwards instead.

- Testnet uses the open-admin wallet for this.
- Mainnet has its own approver wallet (`PRIVY_APPROVER_WALLET_ID`, address `0x9B32…1c95`). It holds `ADMIN_ROLE` on the mainnet market only.

## Open admin, on purpose

**What:** on play money, **anyone signed in can use the admin console** (`/admin`): approve or reject listings, fast-track milestones, settle disputes, create and edit events.

**Why it's open:** judges and testers must be able to run the whole loop alone, including the parts a real admin does (fast-tracking a proof so the payout happens during the demo, settling a dispute). Without it, a judge would stop at "waiting for review".

**Why it's safe:**
- Those actions are sent by a **separate Privy server wallet** (`PRIVY_OPEN_ADMIN_WALLET_ID`). Its policy allows only `approveListing`, `rejectListing`, `fastTrack`, `resolveDispute`, `createEvent` and `setEventActive` on our market.
- It can't pause the market, change fees, move the treasury, grant roles or upgrade the contract. Privy refuses every other call.
- The routes are rate-limited per user (`open-admin`, 100 a day).

**When it's off:** `OPEN_ADMIN = NEXT_PUBLIC_OPEN_ADMIN === "true" && PLAY_MONEY`. It switches off by itself on real USDC, and is meant to be turned off after judging.

**What to say:** "Admin is open on purpose for judging, through a policy-limited Privy wallet. Try it: approve your own listing or fast-track a proof." The console says so too.

## What we don't use from Privy, and why

- **Funding (card or bank on-ramps):** Patched has no banks or fiat by design; wallets hold USDC only.
- **Transaction webhooks:** Enterprise plan only. Our indexer plus Supabase Realtime do the job.

## Privy dashboard checklist (per environment)

One Privy app serves both chains.

| Setting | Status |
|---|---|
| Login methods: X, email, wallet | on |
| Allowed origins include `monad.patched.world`, the creator subdomains, `localhost:3000` and `localhost:3200` | needed; port 3100 is not allowed, so local sign-in only works on 3000 and 3200 |
| HttpOnly cookies on the parent domain (one sign-in across creator subdomains) | needed for subdomain sign-in (see the comment in `middleware.ts`) |
| Gas sponsorship, Monad testnet (10143) | on |
| Gas sponsorship, Monad mainnet (143) | **to do**: until then, mainnet wallets and the keeper need MON |
| Keeper policy rules for mainnet | done (`apps/web/scripts/privy-keeper-add-chain.mjs`) |
| Signer key quorum | one quorum, both chains |
| Test accounts | on; only offered on play money

## Lessons worth writing up (blog material)

1. Permits fail for sponsored embedded wallets (EIP-7702 + ERC-1271). Approve and bid instead.
2. Aggregations keep one total per aggregation, not per wallet, and an app gets 10. Use one per live campaign.
3. Aggregations are evaluated only when Privy signs. Ask Privy to sign, discard the signature, then send sponsored.
4. A signer policy can't be raised without the owner. Swap the signer onto a new policy, so a stolen session can't raise a maximum.
5. `createOnLogin: "all-users"` moves MetaMask users onto an empty wallet. Use `"users-without-wallets"`.
6. Make idempotency keys describe the situation, not the attempt, so retries are safe.
