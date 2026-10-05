-- Moderation without approval: every listing goes live by itself, and a reported post is hidden afterwards.
--   reports          who reported what and why (server only: nobody reads it from the browser)
--   hidden_listings  listings taken out of the app. The market is untouched: bids and escrow follow the contract, the
--                    app just stops showing the listing anywhere (feeds, events, profiles, its own page).
-- Spotted photos already have posts.hidden (0021); reports can point at those too.
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  chain_id     int  not null,
  target_kind  text not null check (target_kind in ('listing', 'post')),
  target_id    text not null,
  reporter     uuid not null references public.profiles (id) on delete cascade,
  reason       text not null check (reason in ('spam', 'scam', 'inappropriate', 'copyright', 'other')),
  note         text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text check (resolution in ('hidden', 'dismissed')),
  unique (chain_id, target_kind, target_id, reporter)
);
create index if not exists reports_open on public.reports (chain_id, created_at desc) where resolved_at is null;
create index if not exists reports_target on public.reports (chain_id, target_kind, target_id);
alter table public.reports enable row level security;

create table if not exists public.hidden_listings (
  chain_id   int    not null,
  listing_id bigint not null,
  reason     text,
  hidden_by  text,
  hidden_at  timestamptz not null default now(),
  primary key (chain_id, listing_id)
);
alter table public.hidden_listings enable row level security;
drop policy if exists "public read" on public.hidden_listings;
create policy "public read" on public.hidden_listings for select using (true);

-- Same columns as before; hidden listings simply drop out of the view that every page reads.
create or replace view public.listing_cards with (security_invoker = true) as
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
  (select coalesce(sum(x.top_bid), 0) from public.patches x where x.chain_id = l.chain_id and x.listing_id = l.listing_id) as top_bids_total,
  p.bio           as creator_bio,
  e.starts_at     as event_starts_at,
  e.ends_at       as event_ends_at,
  e.city          as event_city
from public.listings l
left join public.listing_metadata m on m.metadata_hash = l.metadata_hash
left join public.profiles p on p.wallet = l.creator
left join public.patched_events e on e.chain_id = l.chain_id and e.event_id = l.event_id
where not exists (select 1 from public.hidden_listings h where h.chain_id = l.chain_id and h.listing_id = l.listing_id);
