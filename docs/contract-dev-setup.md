# Patched on contract.dev

> **Goal:** Watch the live Patched contracts on contract.dev so you can show a founder a real-time dashboard of auction activity, escrow flows, bid events, and revert spikes — while mentioning any gaps or issues you found.

---

## 1. What we are watching

| Contract | Testnet (10143) | Mainnet (143) |
|---|---|---|
| `PatchedMarket` (UUPS proxy) | `0x2AaC6f2E5221078982736F33271CD6484d0cd005` | `0xcBE6fA620fc6F61192a94CFbd33aae7893579a56` |
| `PatchReceipt` (ERC-721) | `0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e` | `0x18Cb49292c1562932a1EdcCC6674a30Fd71b27F97` |
| `PatchAutoBidder` | `0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c` | `0x0e59Ab0DE6b61874B6aA728806433c2eB3D362C1` |
| `PatchSweeper` | `0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B` | `0x1fe99eb81EDF35699c3FA6BE3cb5D6749084A9ba` |
| `PatchSpotter` | `0x0C063771aFEe7f391DC4E851A39ba092ba3f3A44` | `0x3dfA83743C76Ce6bd9A4948Ee0E12D0ECabd4e65` |

> **Note:** contract.dev currently supports Ethereum, Arbitrum, Avalanche, and Sepolia.  
> Monad is **not yet a supported chain** — reach out to the team at contract.dev to request Monad support. This is a great talking point for a founder conversation: "I'm already set up and waiting on Monad indexing."

---

## 2. One-time setup

```bash
# Install the CLI (Node 18+)
npm install -g contract.dev

# Log in (opens a browser)
contract.dev login
```

---

## 3. Watch the contracts (run once per workspace)

When Monad is supported, run:

```bash
# --- Monad Testnet (chain id 10143) ---
contract.dev watch 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  --chain 10143 --name "PatchedMarket (testnet)"

contract.dev watch 0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e \
  --chain 10143 --name "PatchReceipt (testnet)"

contract.dev watch 0x67dE9d8CCB7A79FF57cCf117D73135724c46Cf2c \
  --chain 10143 --name "PatchAutoBidder (testnet)"

contract.dev watch 0x1c9F3029E4a7Bf86B4E3D7fC64C471E7DBF7cF6B \
  --chain 10143 --name "PatchSweeper (testnet)"

# --- Monad Mainnet (chain id 143, TestUSD) ---
contract.dev watch 0xcBE6fA620fc6F61192a94CFbd33aae7893579a56 \
  --chain 143 --name "PatchedMarket (mainnet/TestUSD)"

contract.dev watch 0x18Cb49292c1562932a1EdcCC6674a30Fd71b27F97 \
  --chain 143 --name "PatchReceipt (mainnet)"
```

---

## 4. Push ABIs so calls decode cleanly

contract.dev can decode every function call, event and revert if it has the ABIs.  
You don't need verified source — just compile and push.

```bash
# From the repo root
forge build

contract.dev push-contracts
```

This uploads `PatchedMarket`, `PatchReceipt`, `PatchRenderer`, `PatchAutoBidder`, and `PatchSweeper` ABIs in one shot. Re-run after any contract change.

---

## 5. Track the metrics that matter

Run these after watching the contracts (addresses must already be watched or accepted as-is):

```bash
# Escrow / TVL in the market
contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  function --function "nextListingId() returns (uint256)" \
  --label "Total listings created (testnet)"

# revert rate on the market (bids, proofs, disputes)
contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  revert-rate --method "bid(uint256,uint8,uint96)" \
  --window 1h --label "bid() revert rate 1h"

contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  revert-rate --method "bidWithPermit(uint256,uint8,uint96,uint256,uint8,bytes32,bytes32)" \
  --window 1h --label "bidWithPermit() revert rate 1h"

# Method call volume
contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  method-calls --method "bid(uint256,uint8,uint96)" \
  --window 24h --label "bids last 24h"

contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  method-calls --method "submitProof(uint256,uint8,bytes32,string)" \
  --window 24h --label "proofs submitted 24h"

contract.dev track 0x2AaC6f2E5221078982736F33271CD6484d0cd005 \
  method-calls --method "closeBidding(uint256)" \
  --window 24h --label "auctions closed 24h"

# PatchReceipt NFT total supply
contract.dev track 0xC4Abf876Ef2A6FF1A324F4916c330fe01efAeD4e \
  total-supply --label "PatchReceipt NFTs minted (testnet)"
```

---

## 6. Add monitors (alerts)

```bash
# Alert if bid revert rate spikes above 10%
contract.dev monitor add "bid() revert rate 1h" \
  --above 0.10 --warn 0.05 \
  --to email   # or --to telegram / --to slack

# Alert if no new bids for 24h (call count drops to 0)
contract.dev monitor add "bids last 24h" \
  --below 1 \
  --to email
```

Default monitors (revert spike, dependency failure, control change) fire automatically for every watched contract — no extra setup needed.

---

## 7. Stagenet — replay a stuck/failed tx before mainnet

When a dispute or a revert needs debugging:

```bash
# Create a Monad-flavoured stagenet (once Monad is supported)
contract.dev stagenet create patched-debug --chain monad

contract.dev stagenet use patched-debug

# Push ABIs so calls decode inside the stagenet
forge build
contract.dev push-contracts

# Generate a funded wallet for replaying
contract.dev generate-wallet
# → gives you an address + private key pre-loaded with test ETH

# Then deploy or replay with your existing Foundry scripts, pointed at the stagenet RPC
```

---

## 8. Gaps / issues to mention to the founder

These are real limitations discovered while setting up — good conversation material:

| # | Issue | Impact |
|---|---|---|
| 1 | **Monad not yet a supported chain** for the observability dashboard or stagenets | Can't watch live contracts until the team adds Monad; have to show via Sepolia mirror or wait |
| 2 | **`v3` testnet contracts not yet Sourcify-verified** (per `docs/contracts.md`) | ABIs must be pushed manually via CLI; decoded call names won't appear on Monad's own explorer either |
| 3 | **contract.dev supports Monad in Stagenets** (listed under "Supported chains") but **not in the main watch feature** | Inconsistent — stagenets say "Monad" but observability doesn't list it |
| 4 | **Auto-bid shill-bidding vector** (noted in `docs/contracts.md`) | `PatchAutoBidder` exposes a brand's max on-chain; a third party can shill-bid a brand up toward its maximum. Docs acknowledge it, but no on-chain mitigation exists yet |

---

## 9. Quick reference: useful CLI commands

```bash
contract.dev watch --help
contract.dev metrics                        # list all tracked metrics
contract.dev metrics export <metric> --csv  # download history as CSV
contract.dev monitor add --help
contract.dev stagenets                      # list stagenets
contract.dev monitor disable <name>        # stop a monitor
```

---

*File owner: Antigravity. No production code was changed. All addresses from `docs/contracts.md` and `packages/shared/src/addresses.ts`.*
