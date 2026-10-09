-- Reactions on listings too (the Home feed's "listed spots" posts), not only on spotted photos.
-- A listing's target_id is "<chainId>:<listingId>", so the two chains never mix.
alter table public.reactions drop constraint if exists reactions_target_kind_check;
alter table public.reactions add constraint reactions_target_kind_check check (target_kind in ('post', 'listing'));
