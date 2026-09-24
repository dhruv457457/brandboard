-- Auto-bid rules mirror PatchAutoBidder.AutoBidSet events, which are public on-chain anyway.
create policy "public read" on public.auto_bid_rules for select using (true);
create index if not exists auto_bid_rules_active on public.auto_bid_rules (chain_id, listing_id, patch_id) where active;
