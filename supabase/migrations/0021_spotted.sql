-- Spotted: anyone posts a photo of a patched creator at an event. It's a post (the table already exists) tied to the
-- listing, its event and the creator who was spotted. A post can be hidden (by the creator it shows, or its author)
-- without deleting the row, and hidden posts drop out of the public read.
alter table public.posts add column if not exists event_id int;
alter table public.posts add column if not exists spotted_wallet text;
alter table public.posts add column if not exists hidden boolean not null default false;

create index if not exists posts_event on public.posts (chain_id, event_id, created_at desc) where hidden = false;
create index if not exists posts_spotted on public.posts (spotted_wallet, created_at desc) where hidden = false;
create index if not exists posts_listing on public.posts (chain_id, listing_id, created_at desc) where hidden = false;

drop policy if exists "public read" on public.posts;
create policy "public read" on public.posts for select using (not hidden);
