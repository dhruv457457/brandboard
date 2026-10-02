-- Follows: a wallet follows a profile (creator or brand, by wallet) or an event (as "<chain>:<event id>"). Anyone can
-- read the counts; writes go through /api/follows with the service key, so the rows can't be forged from the browser.
create table if not exists public.follows (
  follower    text not null,
  target_kind text not null check (target_kind in ('profile', 'event')),
  target_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (follower, target_kind, target_id)
);
create index if not exists follows_target on public.follows (target_kind, target_id);
create index if not exists follows_follower on public.follows (follower, created_at desc);
alter table public.follows enable row level security;
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select using (true);
