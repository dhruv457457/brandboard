-- Each patch's current leader with their brand name and logo, so a listing page needs one query
-- instead of patches -> leaders -> profiles.
create view public.patch_brands with (security_invoker = true) as
select
  x.chain_id,
  x.listing_id,
  x.patch_id,
  x.top_bidder,
  p.brand_name,
  p.brand_logo_url
from public.patches x
left join public.profiles p on p.wallet = x.top_bidder;
