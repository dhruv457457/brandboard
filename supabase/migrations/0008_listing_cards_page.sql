-- The sponsor page needs the creator's bio and the event's dates and city. New columns are appended so the
-- view can be replaced in place.
create or replace view public.listing_cards with (security_invoker = true) as
select
  l.*,
  m.metadata,
  p.handle        as creator_handle,
  p.display_name  as creator_name,
  p.avatar_url    as creator_avatar,
  p.x_verified    as creator_verified,
  e.name          as event_name,
  e.slug          as event_slug,
  (select count(*) from public.patches x where x.chain_id = l.chain_id and x.listing_id = l.listing_id and x.top_bidder is not null) as patches_with_bids,
  (select coalesce(sum(x.top_bid), 0) from public.patches x where x.chain_id = l.chain_id and x.listing_id = l.listing_id) as top_bids_total,
  p.bio           as creator_bio,
  e.starts_at     as event_starts_at,
  e.ends_at       as event_ends_at,
  e.city          as event_city
from public.listings l
left join public.listing_metadata m on m.metadata_hash = l.metadata_hash
left join public.profiles p on p.wallet = l.creator
left join public.patched_events e on e.chain_id = l.chain_id and e.event_id = l.event_id;
