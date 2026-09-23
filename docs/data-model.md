# Data model

Money truth lives on-chain (see [contracts.md](contracts.md)). Everything visual and social lives in Supabase. The indexer (Claude, `services/indexer`) copies contract events into Supabase so pages load fast and Realtime can push live bids.

## Off-chain listing metadata (the JSON behind `metadataURI` / `metadataHash`)

```json
{
  "version": 1,
  "title": "Token2049 dress",
  "surface": "outfit",
  "eventSlug": "token2049-singapore",
  "sourceImage": "https://.../original.jpg",
  "canvasImage": "https://.../white-canvas.png",
  "patches": [
    { "id": 0, "name": "Neckline", "x": 38, "y": 24.5, "w": 24, "h": 7, "rotation": -2 }
  ],
  "milestones": [
    { "name": "Print proof", "bps": 4000 },
    { "name": "Venue proof", "bps": 6000 }
  ]
}
```

`x, y, w, h` are percentages of the canvas box. `id` equals the on-chain `patchId`. `metadataHash = keccak256(utf8(JSON))` with keys in the order above.

## Supabase tables

Written by the **indexer** (read-only for the app):

| Table | Key columns |
|---|---|
| `listings` | `id` (on-chain id), `creator`, `event_id`, `surface`, `status`, `bidding_ends_at`, `hard_ends_at`, `patch_count`, `bond`, `total_escrow`, `sold_mask`, `metadata_uri`, `metadata_hash`, `next_milestone`, `created_block` |
| `patches` | `listing_id`, `patch_id`, `label`, `floor`, `buy_now`, `top_bid`, `top_bidder`, `bought`, `updated_at` |
| `bids` | `id`, `listing_id`, `patch_id`, `bidder`, `amount`, `prev_bidder`, `prev_amount`, `is_buy_now`, `tx_hash`, `block_time` |
| `milestones` | `listing_id`, `index`, `status`, `review_ends_at`, `disputed_mask`, `resolved_mask`, `proof_hash`, `proof_uri` |
| `disputes` | `listing_id`, `milestone`, `patch_id`, `holder`, `reason_uri`, `resolved`, `to_creator`, `to_holder` |
| `payouts` | `listing_id`, `milestone`, `to_creator`, `fee`, `tx_hash` |
| `receipts` | `token_id`, `listing_id`, `patch_id`, `owner`, `resale_price` |
| `chain_events` | raw log mirror, `(tx_hash, log_index)` unique |

Written by the **app** (server routes, RLS by wallet/user):

| Table | Key columns |
|---|---|
| `profiles` | `user_id` (Privy DID), `wallet`, `handle` (slug), `display_name`, `x_handle`, `x_verified`, `avatar_url`, `banner_color`, `role_flags` |
| `patched_events` | on-chain event info + `slug`, `city`, `banner_url`, `description` (named to avoid a clash with another app in the same project) |
| `listing_meta` | `listing_id`, `metadata` (jsonb, the JSON above), `moderation` (jsonb from AI moderation) |
| `proof_files` | `listing_id`, `milestone`, `files` (jsonb of storage URLs), `ai_check` (jsonb) |
| `posts` | `id`, `author`, `listing_id?`, `body`, `media`, `created_at` |
| `notifications` | `user_id`, `kind`, `payload`, `read_at` |
| `auto_bid_rules` | `brand_wallet`, `listing_id`, `patch_id`, `max_amount`, `active` (used with Privy session signers) |
| `brand_logos` | `wallet`, `listing_id`, `patch_id`, `logo_url` (logos shown on patches) |

Storage buckets: `canvases`, `logos`, `proofs`, `avatars`.

Realtime: the listing page subscribes to `bids` and `patches` filtered by `listing_id`.

## Mock mode (for building the UI before contracts are live)

`apps/web` reads data only through `lib/data/*` functions and writes only through `lib/chain/*` hooks. With `NEXT_PUBLIC_DATA_MODE=mock`:

- `lib/data` returns fixtures from `lib/data/fixtures.ts` shaped exactly like the tables above (listings for Mira / Samir / Team Rektangle from the prototype).
- `lib/chain` hooks resolve after a fake 1s delay and emit the same events into a local event bus, so the live-bid animations work.
- A mock "other brands bidding" timer (every 4.5–8.5s) drives the live feed, like the prototype.

Switching to `NEXT_PUBLIC_DATA_MODE=live` swaps in Supabase + viem implementations with the same function signatures.
