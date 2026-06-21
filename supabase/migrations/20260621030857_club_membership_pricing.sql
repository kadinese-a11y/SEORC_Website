create table if not exists public.club_settings (
  setting_key text primary key,
  membership_fee numeric(10,2) not null check (membership_fee >= 0),
  updated_at timestamptz not null default now()
);

insert into public.club_settings (setting_key, membership_fee)
values ('annual_membership_fee', 20.00)
on conflict (setting_key) do nothing;

alter table public.club_settings enable row level security;

grant select on public.club_settings to anon, authenticated;
grant update on public.club_settings to authenticated;

create policy "Public can read club pricing" on public.club_settings
  for select to anon, authenticated using (true);

create policy "Admins update club pricing" on public.club_settings
  for update to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
