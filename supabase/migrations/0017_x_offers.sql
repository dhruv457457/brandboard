-- "Patch anyone on X": a brand's offer to an X account, even one that isn't on Patched yet. An offer is a campaign
-- aimed at one person: Privy creates that person's user (with their X account linked) and a wallet ahead of time, the
-- offer's campaign wallet only bids on that wallet's listings at the event, and it may advance the listing stake to
-- exactly that wallet. When they sign in with X, the wallet and the offer are already theirs.
alter table public.brand_campaigns
  add column if not exists kind             text not null default 'event',  -- event | x_offer
  add column if not exists target_x_id      text,        -- numeric X user id (Privy's twitter_oauth subject)
  add column if not exists target_x_handle  text,
  add column if not exists target_x_name    text,
  add column if not exists target_x_avatar  text,
  add column if not exists target_wallet    text,        -- lowercase; the person's Patched wallet
  add column if not exists target_privy_did text,
  add column if not exists pregenerated     boolean not null default false, -- we created their Privy user
  add column if not exists message          text,
  add column if not exists advance          bigint,      -- the listing stake the offer may pay to them (USDC)
  add column if not exists advanced_at      timestamptz,
  add column if not exists claimed_at       timestamptz;
create index if not exists brand_campaigns_target on public.brand_campaigns (chain_id, target_wallet) where kind = 'x_offer';
