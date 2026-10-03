-- Auto-bid through Privy signers: a raise (a new spot, or a higher maximum on a spot) must be approved by the brand's
-- own wallet. The server never widens the policy our signer carries on the wallet; it makes a new policy (the active
-- auto-bids plus the raise) and keeps the raise here until the browser has swapped our signer onto that policy
-- (removeSigners, then addSigners: wallet actions Privy guards with the brand's passkey). Until then the keeper keeps
-- bidding with the old maximums, since it only reads the active rows of signer_auto_bids.

-- At most one raise waits per wallet: a newer request replaces it.
create table if not exists public.signer_pending_raises (
  wallet      text primary key,                    -- lowercase brand wallet address
  policy_id   text not null,                       -- the new Privy policy: active auto-bids plus this raise
  chain_id    int not null,
  listing_id  bigint not null,
  patch_id    smallint not null,
  max_amount  bigint not null,                     -- USDC, 6 decimals
  created_at  timestamptz not null default now()
);

-- Service role only, like signer_delegations (it holds Privy policy ids).
alter table public.signer_pending_raises enable row level security;
