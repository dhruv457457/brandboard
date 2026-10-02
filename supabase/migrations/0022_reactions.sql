-- Reactions: a wallet reacts to a post (a spotted photo) with one of three icons, once per icon. Counts are public;
-- writes go through /api/reactions with the service key.
create table if not exists public.reactions (
  wallet      text not null,
  target_kind text not null check (target_kind in ('post')),
  target_id   text not null,
  kind        text not null check (kind in ('flame', 'zap', 'heart')),
  created_at  timestamptz not null default now(),
  primary key (wallet, target_kind, target_id, kind)
);
create index if not exists reactions_target on public.reactions (target_kind, target_id);
alter table public.reactions enable row level security;
drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select using (true);
