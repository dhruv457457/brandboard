-- Comments on a listing, optionally about one spot. Free to post, one line each. A hidden comment is dropped by the read policy.
create table if not exists public.listing_comments (
  id          uuid primary key default gen_random_uuid(),
  chain_id    int    not null,
  listing_id  bigint not null,
  patch_id    int,
  author      uuid   not null references public.profiles on delete cascade,
  body        text   not null check (char_length(body) between 1 and 280),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists listing_comments_listing on public.listing_comments (chain_id, listing_id, created_at desc);

alter table public.listing_comments enable row level security;
drop policy if exists "public read" on public.listing_comments;
create policy "public read" on public.listing_comments for select using (hidden = false);
-- Writes go through the API with the service role, which checks who is signed in.
