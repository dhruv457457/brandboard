-- A campaign transaction is logged once. Two keeper runs can tick the same campaign at the same moment; Privy's
-- idempotency key gives both the same transaction, and this keeps the second log row out (and the spend total right).
create unique index if not exists brand_campaign_actions_once
  on public.brand_campaign_actions (campaign_id, tx_hash) where tx_hash is not null;
