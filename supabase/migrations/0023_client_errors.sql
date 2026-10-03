-- Crashes the app's error screens catch in people's browsers, so an "Application error" that can't be reproduced can still
-- be read afterwards. Written through /api/client-error with the service key; no public access.
create table if not exists public.client_errors (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  message    text not null,
  stack      text,
  digest     text,
  path       text,
  user_agent text,
  stale_build boolean not null default false
);
create index if not exists client_errors_recent on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
