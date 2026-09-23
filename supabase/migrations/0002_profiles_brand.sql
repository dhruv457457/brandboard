-- Brand identity lives on the profile: shown on every patch the wallet leads and on its receipts.
alter table public.profiles
  add column if not exists brand_name text check (char_length(brand_name) <= 31),
  add column if not exists brand_logo_url text,
  add column if not exists brand_website text;

create index if not exists profiles_wallet on public.profiles (wallet);
