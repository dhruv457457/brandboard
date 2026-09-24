-- Creator-editable sponsor page layer (copy, colour, sections). Listing metadata is fixed by its on-chain hash,
-- so everything the creator may change after publishing lives here. Written only by /api/listings/[id]/page.
create table if not exists public.listing_pages (
  chain_id    int not null,
  listing_id  bigint not null,
  creator     text not null,
  page        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (chain_id, listing_id)
);
alter table public.listing_pages enable row level security;
create policy "public read" on public.listing_pages for select using (true);
