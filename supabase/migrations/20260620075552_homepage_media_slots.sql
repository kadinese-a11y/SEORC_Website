alter table public.media_assets add column if not exists homepage_slot text;
create unique index if not exists media_assets_homepage_slot_unique on public.media_assets (homepage_slot) where homepage_slot is not null;
