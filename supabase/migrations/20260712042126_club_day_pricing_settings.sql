insert into public.club_settings (setting_key, membership_fee)
values
  ('club_day_fee', 40.00),
  ('club_day_young_rider_fee', 35.00),
  ('aeora_day_membership_fee', 15.00)
on conflict (setting_key) do nothing;

grant insert on public.club_settings to authenticated;

create policy "Admins insert club pricing" on public.club_settings
  for insert to authenticated
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
