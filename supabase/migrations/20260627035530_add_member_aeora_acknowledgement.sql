alter table public.members
  add column if not exists aeora_membership_acknowledged boolean not null default false;

with latest_membership_form as (
  select distinct on (lower(payload ->> 'club-email'))
    lower(payload ->> 'club-email') as email,
    payload
  from public.registrations
  where form_type = 'club_membership'
    and coalesce(payload ->> 'club-email', '') <> ''
  order by lower(payload ->> 'club-email'), created_at desc
)
update public.members as member
set
  aeora_membership_acknowledged = coalesce(
    (latest_membership_form.payload ->> 'aeora-membership-acknowledgement')::boolean,
    member.aeora_membership_acknowledged
  ),
  updated_at = now()
from latest_membership_form
where member.email = latest_membership_form.email;

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

  insert into public.members (
    email,
    first_name,
    last_name,
    phone,
    riding_level,
    membership_type,
    birthday,
    address,
    horse_level,
    emergency_first_name,
    emergency_last_name,
    emergency_phone,
    email_notifications,
    aeora_membership_acknowledged
  )
  values (
    lower(new.payload->>'club-email'),
    new.payload->>'club-first-name',
    new.payload->>'club-last-name',
    new.payload->>'club-phone',
    new.payload->>'riding-level',
    member_type,
    nullif(new.payload->>'club-birthday', '')::date,
    nullif(new.payload->>'club-address', ''),
    nullif(new.payload->>'horse-level', ''),
    nullif(new.payload->>'emergency-first-name', ''),
    nullif(new.payload->>'emergency-last-name', ''),
    nullif(new.payload->>'emergency-phone', ''),
    coalesce((new.payload->>'email-notifications')::boolean, false),
    coalesce((new.payload->>'aeora-membership-acknowledgement')::boolean, false)
  )
  on conflict (email) do update
  set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    riding_level = excluded.riding_level,
    membership_type = excluded.membership_type,
    birthday = excluded.birthday,
    address = excluded.address,
    horse_level = excluded.horse_level,
    emergency_first_name = excluded.emergency_first_name,
    emergency_last_name = excluded.emergency_last_name,
    emergency_phone = excluded.emergency_phone,
    email_notifications = excluded.email_notifications,
    aeora_membership_acknowledged = excluded.aeora_membership_acknowledged,
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

notify pgrst, 'reload schema';
