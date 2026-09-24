-- patch_brands carries every patch column too, so listing cards need one query for patches + brands.
drop view if exists public.patch_brands;
create view public.patch_brands with (security_invoker = true) as
select
  x.*,
  p.brand_name,
  p.brand_logo_url
from public.patches x
left join public.profiles p on p.wallet = x.top_bidder;
