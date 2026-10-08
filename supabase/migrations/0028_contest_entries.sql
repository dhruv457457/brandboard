-- Get Patched Week contest entries.
-- contest_entries holds emails and Telegram names, so RLS is on with NO policy: the publishable (anon) key can read
-- nothing. The app reads and writes it only through server routes with the service key, which return public fields
-- (handle, avatar, tracks) and the signed-in person's own entry.
create table if not exists public.contest_entries (
  id               uuid primary key default gen_random_uuid(),
  contest          text not null default 'get-patched-week',
  privy_did        text not null,
  profile_id       uuid references public.profiles (id) on delete set null,
  wallet           text,
  x_handle         text not null,
  email            text,
  telegram         text not null,
  tracks           text[] not null,
  post_url         text,
  feedback_url     text,
  feedback_text    text,
  joined_telegram  boolean not null default false,
  -- admin review: null = not reviewed yet, true = counts, false = left out of the draw and the judging
  valid            boolean,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (contest, privy_did)
);
create index if not exists contest_entries_order on public.contest_entries (contest, created_at, id);
alter table public.contest_entries enable row level security;

-- Winners and their prize transactions: filled by an admin, shown to everyone.
create table if not exists public.contest_winners (
  contest    text not null default 'get-patched-week',
  track      text not null check (track in ('post', 'feedback', 'lucky')),
  x_handle   text not null,
  note       text,
  tx_hash    text,
  created_at timestamptz not null default now(),
  primary key (contest, track)
);
alter table public.contest_winners enable row level security;
drop policy if exists contest_winners_read on public.contest_winners;
create policy contest_winners_read on public.contest_winners for select using (true);
