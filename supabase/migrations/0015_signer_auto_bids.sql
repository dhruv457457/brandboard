-- Auto-bid through Privy signers: Patched's key quorum is added as a signer on the brand's own embedded wallet,
-- limited by one Privy policy per wallet that lists the brand's auto-bids (spot + maximum). The keeper bids from the
-- brand's wallet when they're outbid. Brands on an outside wallet (MetaMask...) keep using PatchAutoBidder instead.

-- One row per brand wallet: its Privy wallet id, its policy, and whether our signer is on the wallet.
create table if not exists public.signer_delegations (
  wallet           text primary key,               -- lowercase brand wallet address
  privy_did        text not null,
  privy_wallet_id  text not null,
  policy_id        text not null,
  signer_added_at  timestamptz,                    -- set once Privy shows our signer on the wallet with this policy
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- One row per auto-bid (chain, spot). The policy is rebuilt from the active rows of the wallet on every change.
create table if not exists public.signer_auto_bids (
  chain_id    int not null,
  wallet      text not null,
  listing_id  bigint not null,
  patch_id    smallint not null,
  max_amount  bigint not null,                     -- USDC, 6 decimals
  active      boolean not null default true,
  updated_at  timestamptz not null default now(),
  primary key (chain_id, wallet, listing_id, patch_id)
);
create index if not exists signer_auto_bids_active on public.signer_auto_bids (chain_id, listing_id, patch_id) where active;

alter table public.signer_delegations enable row level security;
alter table public.signer_auto_bids   enable row level security;
-- Auto-bid maximums are public like auto_bid_rules; delegations (Privy ids) are service role only.
create policy "public read" on public.signer_auto_bids for select using (true);
