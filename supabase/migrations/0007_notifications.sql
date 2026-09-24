-- Notifications are written by the indexer from chain events. chain_id + tx_hash + log_index + wallet + kind
-- make replays idempotent. They only describe public on-chain activity, so reads are public; marking them
-- read goes through /api/notifications (service role).
delete from public.notifications;
alter table public.notifications
  add column if not exists chain_id int not null,
  add column if not exists tx_hash text not null,
  add column if not exists log_index int not null;
create unique index if not exists notifications_once
  on public.notifications (chain_id, tx_hash, log_index, wallet, kind);
drop index if exists notifications_wallet;
create index notifications_wallet on public.notifications (chain_id, wallet, created_at desc);

create policy "public read" on public.notifications for select using (true);
alter publication supabase_realtime add table public.notifications;
