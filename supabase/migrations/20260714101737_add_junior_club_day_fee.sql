insert into public.club_settings (setting_key, membership_fee)
values (
  'club_day_junior_fee',
  coalesce((
    select membership_fee
    from public.club_settings
    where setting_key = 'club_day_young_rider_fee'
  ), 35.00)
)
on conflict (setting_key) do update
set
  membership_fee = excluded.membership_fee,
  updated_at = now();

update public.events
set event_settings = jsonb_set(
  coalesce(event_settings, '{}'::jsonb),
  '{club_day_junior_fee}',
  to_jsonb(coalesce(
    nullif(event_settings->>'club_day_junior_fee', '')::numeric,
    nullif(event_settings->>'club_day_young_rider_fee', '')::numeric,
    (select membership_fee from public.club_settings where setting_key = 'club_day_junior_fee'),
    35.00
  )),
  true
)
where type = 'club';
