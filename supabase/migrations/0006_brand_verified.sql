-- A brand is verified when the signed-in user has a Privy-verified email on the same domain as brand_website.
alter table public.profiles add column if not exists brand_verified_domain text;

drop view if exists public.patch_brands;
create view public.patch_brands with (security_invoker = true) as
select
  x.*,
  p.brand_name,
  p.brand_logo_url,
  p.brand_verified_domain
from public.patches x
left join public.profiles p on p.wallet = x.top_bidder;
