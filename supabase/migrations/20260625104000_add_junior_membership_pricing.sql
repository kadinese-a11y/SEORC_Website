insert into public.club_settings (setting_key, membership_fee)
values ('junior_membership_fee', 15.00)
on conflict (setting_key) do nothing;

alter table public.members
  add column if not exists membership_type text not null default 'adult'
  check (membership_type in ('adult', 'junior'));

alter table public.membership_renewals
  add column if not exists membership_type text not null default 'adult'
  check (membership_type in ('adult', 'junior'));

update public.registrations
set payload = jsonb_set(payload, '{club-membership-type}', '"adult"'::jsonb, true)
where form_type = 'club_membership'
  and not (payload ? 'club-membership-type');

create or replace function private.sync_membership_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  member_row public.members;
  fy text := public.au_financial_year(current_date);
  member_type text := case when lower(coalesce(new.payload->>'club-membership-type', 'adult')) = 'junior' then 'junior' else 'adult' end;
  fee numeric := coalesce((
    select membership_fee
    from public.club_settings
    where setting_key = case when member_type = 'junior' then 'junior_membership_fee' else 'annual_membership_fee' end
  ), case when member_type = 'junior' then 15 else 20 end);
begin
  if new.form_type <> 'club_membership' then
    return new;
  end if;

  insert into public.members (email, first_name, last_name, phone, riding_level, membership_type)
  values (
    lower(new.payload->>'club-email'),
    new.payload->>'club-first-name',
    new.payload->>'club-last-name',
    new.payload->>'club-phone',
    new.payload->>'riding-level',
    member_type
  )
  on conflict (email) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    riding_level = excluded.riding_level,
    membership_type = excluded.membership_type,
    updated_at = now()
  returning * into member_row;

  insert into public.membership_renewals (member_id, registration_id, financial_year, amount, membership_type)
  values (member_row.id, new.id, fy, fee, member_type)
  on conflict (member_id, financial_year) do nothing;

  update public.registrations
  set payload = jsonb_set(
    jsonb_set(new.payload, '{membership-number}', to_jsonb(member_row.membership_number), true),
    '{calculated-total}',
    to_jsonb(fee::text),
    true
  )
  where id = new.id;

  return new;
end;
$$;
