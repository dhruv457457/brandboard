-- What a creator's linked X account says about them: their follower count, refreshed at most once a day when they
-- use Patched. Name and profile picture already have columns (display_name, avatar_url) and are filled from X too.
alter table public.profiles
  add column if not exists x_followers  integer,
  add column if not exists x_synced_at  timestamptz;
