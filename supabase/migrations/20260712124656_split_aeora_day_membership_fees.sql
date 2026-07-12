insert into public.club_settings (setting_key, membership_fee)
values
  (
    'aeora_day_membership_adult_fee',
    coalesce((select membership_fee from public.club_settings where setting_key = 'aeora_day_membership_fee'), 15.00)
  ),
  (
    'aeora_day_membership_young_rider_fee',
    coalesce((select membership_fee from public.club_settings where setting_key = 'aeora_day_membership_fee'), 15.00)
  )
on conflict (setting_key) do nothing;
