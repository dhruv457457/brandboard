-- Get Patched Week: who joined (one tap, before any entry) and a simple, anonymous funnel.
-- contest_signups: a signed-in person tapped "Count me in" (entering the contest also adds them).
-- contest_funnel: anonymous steps per browser (a random id kept in the browser, nothing personal):
--   view = opened the contest page, join = tapped "Count me in", form = started filling the entry form.
-- Both have RLS on with no policies: only the server (service key) reads or writes them.
create table if not exists public.contest_signups (
  contest     text not null default 'get-patched-week',
  privy_did   text not null,
  profile_id  uuid references public.profiles (id) on delete set null,
  wallet      text,
  x_handle    text,
  created_at  timestamptz not null default now(),
  primary key (contest, privy_did)
);
create index if not exists contest_signups_order on public.contest_signups (contest, created_at);
alter table public.contest_signups enable row level security;

create table if not exists public.contest_funnel (
  contest     text not null default 'get-patched-week',
  visitor     text not null,
  step        text not null check (step in ('view', 'join', 'form')),
  created_at  timestamptz not null default now(),
  primary key (contest, visitor, step)
);
alter table public.contest_funnel enable row level security;

-- Everyone who already entered counts as joined.
insert into public.contest_signups (contest, privy_did, profile_id, wallet, x_handle, created_at)
select contest, privy_did, profile_id, wallet, x_handle, created_at from public.contest_entries
on conflict do nothing;
