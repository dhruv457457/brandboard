-- The campaign's Privy aggregation: the running total of the bids its wallet has signed. The campaign's bid rule
-- references it, so Privy refuses any bid that would take the campaign past its budget. Null for campaigns started
-- before this existed (their bids are sent, not signed, and only the wallet balance caps them).
alter table public.brand_campaigns add column if not exists aggregation_id text;
