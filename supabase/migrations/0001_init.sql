-- Patched — initial schema. Shares a Supabase project with another app, so the event table is
-- named patched_events to avoid clashing with its existing public.events.
-- Money truth lives on-chain. Tables in the "chain mirror" section are written only by the indexer
-- (service role). Tables in the "app" section are written by server routes after verifying the Privy
-- session. The browser only ever reads (publishable key + RLS).
-- Amounts are raw USDC units (6 decimals) in bigint. Addresses are lowercase hex text.

-- ─────────────────────────────── chain mirror ───────────────────────────────

create table public.indexer_cursors (
  chain_id      int primary key,
  last_block    bigint not null,
  updated_at    timestamptz not null default now()
);

create table public.chain_events (
  chain_id      int not null,
  tx_hash       text not null,
  log_index     int not null,
  block_number  bigint not null,
  block_time    timestamptz,
  event_name    text not null,
  args          jsonb not null,
  primary key (chain_id, tx_hash, log_index)
);
create index chain_events_block on public.chain_events (chain_id, block_number);

create table public.patched_events (
  chain_id      int not null,
  event_id      int not null,
  name          text not null,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  active        boolean not null default true,
  -- app-managed presentation fields
  slug          text,
  city          text,
  banner_url    text,
  description   text,
  primary key (chain_id, event_id)
);
create unique index patched_events_slug on public.patched_events (chain_id, slug) where slug is not null;

create table public.listings (
  chain_id        int not null,
  listing_id      bigint not null,
  creator         text not null,
  event_id        int not null default 0,
  surface         smallint not null,          -- 0 outfit, 1 car, 2 hoodie
  status          smallint not null,          -- mirrors PatchedMarket.Status
  bidding_ends_at timestamptz not null,
  hard_ends_at    timestamptz not null,
  patch_count     smallint not null,
  bond            bigint not null,
  total_escrow    bigint not null default 0,
  sold_mask       int not null default 0,
  next_milestone  smallint not null default 0,
  metadata_uri    text not null,
  metadata_hash   text not null,
  created_block   bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (chain_id, listing_id)
);
create index listings_creator on public.listings (chain_id, creator);
create index listings_status on public.listings (chain_id, status, bidding_ends_at);
create index listings_hash on public.listings (metadata_hash);

create table public.patches (
  chain_id      int not null,
  listing_id    bigint not null,
  patch_id      smallint not null,
  label         text not null,
  floor         bigint not null,
  buy_now       bigint not null,
  top_bid       bigint not null default 0,
  top_bidder    text,
  bought        boolean not null default false,
  bid_count     int not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (chain_id, listing_id, patch_id),
  foreign key (chain_id, listing_id) references public.listings on delete cascade
);

create table public.bids (
  chain_id      int not null,
  tx_hash       text not null,
  log_index     int not null,
  listing_id    bigint not null,
  patch_id      smallint not null,
  bidder        text not null,
  amount        bigint not null,
  prev_bidder   text,
  prev_amount   bigint,
  is_buy_now    boolean not null default false,
  block_number  bigint not null,
  block_time    timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);
create index bids_listing on public.bids (chain_id, listing_id, block_number desc);
create index bids_bidder on public.bids (chain_id, bidder);

create table public.milestones (
  chain_id        int not null,
  listing_id      bigint not null,
  idx             smallint not null,
  bps             int not null,
  deadline        timestamptz not null,
  status          smallint not null default 0,   -- 0 open, 1 submitted, 2 released
  review_ends_at  timestamptz,
  disputed_mask   int not null default 0,
  resolved_mask   int not null default 0,
  proof_hash      text,
  proof_uri       text,
  primary key (chain_id, listing_id, idx),
  foreign key (chain_id, listing_id) references public.listings on delete cascade
);

create table public.disputes (
  chain_id      int not null,
  listing_id    bigint not null,
  milestone     smallint not null,
  patch_id      smallint not null,
  holder        text not null,
  reason_uri    text,
  resolved      boolean not null default false,
  to_creator    bigint,
  to_holder     bigint,
  created_at    timestamptz not null default now(),
  primary key (chain_id, listing_id, milestone, patch_id)
);

create table public.payouts (
  chain_id      int not null,
  tx_hash       text not null,
  log_index     int not null,
  listing_id    bigint not null,
  kind          text not null,                 -- milestone | dispute | refund | bond | royalty
  milestone     smallint,
  amount        bigint not null,
  fee           bigint not null default 0,
  block_time    timestamptz not null default now(),
  primary key (chain_id, tx_hash, log_index)
);
create index payouts_listing on public.payouts (chain_id, listing_id);

create table public.receipts (
  chain_id      int not null,
  token_id      numeric(78,0) not null,
  listing_id    bigint not null,
  patch_id      smallint not null,
  owner         text not null,
  resale_price  bigint,
  primary key (chain_id, token_id)
);
create index receipts_owner on public.receipts (chain_id, owner);

-- ─────────────────────────────── app data ───────────────────────────────

create table public.profiles (
  id            uuid primary key default gen_random_uuid(),
  privy_did     text unique not null,
  wallet        text unique,
  handle        text unique,
  display_name  text,
  x_handle      text,
  x_verified    boolean not null default false,
  avatar_url    text,
  banner_color  text default '#FF5A1F',
  bio           text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9][a-z0-9._-]{1,30}$')
);

-- Off-chain listing JSON, stored before createListing and matched to the listing by metadata_hash.
create table public.listing_metadata (
  metadata_hash text primary key,
  creator       text not null,
  metadata      jsonb not null,
  moderation    jsonb,
  created_at    timestamptz not null default now()
);

create table public.proof_files (
  chain_id      int not null,
  listing_id    bigint not null,
  milestone     smallint not null,
  files         jsonb not null,
  note          text,
  ai_check      jsonb,
  created_at    timestamptz not null default now(),
  primary key (chain_id, listing_id, milestone)
);

create table public.brand_logos (
  chain_id      int not null,
  listing_id    bigint not null,
  patch_id      smallint not null,
  wallet        text not null,
  brand_name    text,
  logo_url      text not null,
  created_at    timestamptz not null default now(),
  primary key (chain_id, listing_id, patch_id, wallet)
);

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  author        uuid not null references public.profiles on delete cascade,
  chain_id      int,
  listing_id    bigint,
  body          text not null check (char_length(body) <= 500),
  media         jsonb,
  created_at    timestamptz not null default now()
);
create index posts_author on public.posts (author, created_at desc);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null,
  kind          text not null,
  payload       jsonb not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index notifications_wallet on public.notifications (wallet, created_at desc);

create table public.auto_bid_rules (
  id            uuid primary key default gen_random_uuid(),
  chain_id      int not null,
  wallet        text not null,
  listing_id    bigint not null,
  patch_id      smallint not null,
  max_amount    bigint not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (chain_id, wallet, listing_id, patch_id)
);

-- ─────────────────────────────── views ───────────────────────────────

-- One row per listing with everything a card needs (explore grid, profile, share image).
create view public.listing_cards with (security_invoker = true) as
select
  l.*,
  m.metadata,
  p.handle        as creator_handle,
  p.display_name  as creator_name,
  p.avatar_url    as creator_avatar,
  p.x_verified    as creator_verified,
  e.name          as event_name,
  e.slug          as event_slug,
  (select count(*) from public.patches x where x.chain_id = l.chain_id and x.listing_id = l.listing_id and x.top_bidder is not null) as patches_with_bids,
  (select coalesce(sum(x.top_bid), 0) from public.patches x where x.chain_id = l.chain_id and x.listing_id = l.listing_id) as top_bids_total
from public.listings l
left join public.listing_metadata m on m.metadata_hash = l.metadata_hash
left join public.profiles p on p.wallet = l.creator
left join public.patched_events e on e.chain_id = l.chain_id and e.event_id = l.event_id;

-- ─────────────────────────────── security ───────────────────────────────
-- RLS on everywhere. Public read for public data; nothing is writable with the publishable key.
-- Writes happen only through the service role (indexer, server routes).

alter table public.indexer_cursors   enable row level security;
alter table public.chain_events      enable row level security;
alter table public.patched_events    enable row level security;
alter table public.listings          enable row level security;
alter table public.patches           enable row level security;
alter table public.bids              enable row level security;
alter table public.milestones        enable row level security;
alter table public.disputes          enable row level security;
alter table public.payouts           enable row level security;
alter table public.receipts          enable row level security;
alter table public.profiles          enable row level security;
alter table public.listing_metadata  enable row level security;
alter table public.proof_files       enable row level security;
alter table public.brand_logos       enable row level security;
alter table public.posts             enable row level security;
alter table public.notifications     enable row level security;
alter table public.auto_bid_rules    enable row level security;

create policy "public read" on public.patched_events   for select using (true);
create policy "public read" on public.listings         for select using (true);
create policy "public read" on public.patches          for select using (true);
create policy "public read" on public.bids             for select using (true);
create policy "public read" on public.milestones       for select using (true);
create policy "public read" on public.disputes         for select using (true);
create policy "public read" on public.payouts          for select using (true);
create policy "public read" on public.receipts         for select using (true);
create policy "public read" on public.profiles         for select using (true);
create policy "public read" on public.listing_metadata for select using (true);
create policy "public read" on public.proof_files      for select using (true);
create policy "public read" on public.brand_logos      for select using (true);
create policy "public read" on public.posts            for select using (true);
-- indexer_cursors, chain_events, notifications, auto_bid_rules: no public access.

-- ─────────────────────────────── realtime ───────────────────────────────

alter publication supabase_realtime add table public.bids, public.patches, public.listings, public.milestones;

-- ─────────────────────────────── storage ───────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('canvases', 'canvases', true, 10485760, array['image/png','image/jpeg','image/webp']),
  ('logos',    'logos',    true,  2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('proofs',   'proofs',   true, 10485760, array['image/png','image/jpeg','image/webp','application/pdf']),
  ('avatars',  'avatars',  true,  2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
