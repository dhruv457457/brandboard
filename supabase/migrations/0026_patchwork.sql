-- Patchwork: the on-chain social graph of an event.
-- spots: PatchSpotter's Spotted events (someone posted a photo of a creator). Written by the indexer, public read.
-- listing_payees: who is paid with the creator on a team hoodie (from the market's getPayees). Written by the indexer.
-- posts.spot_tx: the transaction behind a spotted photo, so the graph can link the photo to its on-chain spot.
create table if not exists public.spots (
  chain_id     int not null,
  tx_hash      text not null,
  log_index    int not null,
  event_id     int not null,
  listing_id   bigint not null,
  spotter      text not null,
  creator      text not null,
  photo_hash   text not null,
  photo_uri    text not null,
  block_number bigint not null,
  block_time   timestamptz not null,
  primary key (chain_id, tx_hash, log_index)
);
create index if not exists spots_event on public.spots (chain_id, event_id, block_time);
create index if not exists spots_listing on public.spots (chain_id, listing_id);
create index if not exists spots_spotter on public.spots (chain_id, spotter);
alter table public.spots enable row level security;
drop policy if exists spots_read on public.spots;
create policy spots_read on public.spots for select using (true);

create table if not exists public.listing_payees (
  chain_id   int not null,
  listing_id bigint not null,
  payee      text not null,
  share_bps  int not null,
  primary key (chain_id, listing_id, payee)
);
alter table public.listing_payees enable row level security;
drop policy if exists listing_payees_read on public.listing_payees;
create policy listing_payees_read on public.listing_payees for select using (true);

alter table public.posts add column if not exists spot_tx text;
create index if not exists posts_spot_tx on public.posts (spot_tx) where spot_tx is not null;

-- The Patchwork page refreshes when a spot lands.
do $$ begin
  alter publication supabase_realtime add table public.spots;
exception when duplicate_object then null; when undefined_object then null;
end $$;
