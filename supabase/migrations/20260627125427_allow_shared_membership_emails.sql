alter table public.members
  drop constraint if exists members_email_key;

drop index if exists public.members_email_key;

create unique index if not exists members_email_name_key
  on public.members (
    lower(btrim(email)),
    lower(btrim(first_name)),
    lower(btrim(last_name))
  );

create or replace function private.sync_membership_registration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  member_row public.members;
  fy text := public.au_financial_year(current_date);
  member_email text := lower(btrim(new.payload->>'club-email'));
  member_first_name text := btrim(coalesce(new.payload->>'club-first-name', ''));
  member_last_name text := btrim(coalesce(new.payload->>'club-last-name', ''));
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

  select *
  into member_row
  from public.members
  where lower(btrim(email)) = member_email
    and lower(btrim(first_name)) = lower(member_first_name)
    and lower(btrim(last_name)) = lower(member_last_name)
  limit 1;

  if member_row.id is null then
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
      member_email,
      member_first_name,
      member_last_name,
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
    returning * into member_row;
  else
    update public.members
    set
      email = member_email,
      first_name = member_first_name,
      last_name = member_last_name,
      phone = new.payload->>'club-phone',
      riding_level = new.payload->>'riding-level',
      membership_type = member_type,
      birthday = nullif(new.payload->>'club-birthday', '')::date,
      address = nullif(new.payload->>'club-address', ''),
      horse_level = nullif(new.payload->>'horse-level', ''),
      emergency_first_name = nullif(new.payload->>'emergency-first-name', ''),
      emergency_last_name = nullif(new.payload->>'emergency-last-name', ''),
      emergency_phone = nullif(new.payload->>'emergency-phone', ''),
      email_notifications = coalesce((new.payload->>'email-notifications')::boolean, false),
      aeora_membership_acknowledged = coalesce((new.payload->>'aeora-membership-acknowledgement')::boolean, false),
      updated_at = now()
    where id = member_row.id
    returning * into member_row;
  end if;

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

do $$
declare
  registration_row public.registrations;
  member_row public.members;
  member_email text;
  member_first_name text;
  member_last_name text;
  member_type text;
  renewal_fy text;
  renewal_fee numeric;
begin
  for registration_row in
    select *
    from public.registrations
    where form_type = 'club_membership'
      and nullif(btrim(payload->>'club-email'), '') is not null
      and nullif(btrim(payload->>'club-first-name'), '') is not null
      and nullif(btrim(payload->>'club-last-name'), '') is not null
    order by created_at asc
  loop
    member_email := lower(btrim(registration_row.payload->>'club-email'));
    member_first_name := btrim(registration_row.payload->>'club-first-name');
    member_last_name := btrim(registration_row.payload->>'club-last-name');
    member_type := case when lower(coalesce(registration_row.payload->>'club-membership-type', 'adult')) = 'junior' then 'junior' else 'adult' end;
    renewal_fy := public.au_financial_year(registration_row.created_at::date);
    renewal_fee := coalesce((
      select membership_fee
      from public.club_settings
      where setting_key = case when member_type = 'junior' then 'junior_membership_fee' else 'annual_membership_fee' end
    ), case when member_type = 'junior' then 15 else 20 end);

    select *
    into member_row
    from public.members
    where lower(btrim(email)) = member_email
      and lower(btrim(first_name)) = lower(member_first_name)
      and lower(btrim(last_name)) = lower(member_last_name)
    limit 1;

    if member_row.id is null then
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
        member_email,
        member_first_name,
        member_last_name,
        registration_row.payload->>'club-phone',
        registration_row.payload->>'riding-level',
        member_type,
        nullif(registration_row.payload->>'club-birthday', '')::date,
        nullif(registration_row.payload->>'club-address', ''),
        nullif(registration_row.payload->>'horse-level', ''),
        nullif(registration_row.payload->>'emergency-first-name', ''),
        nullif(registration_row.payload->>'emergency-last-name', ''),
        nullif(registration_row.payload->>'emergency-phone', ''),
        coalesce((registration_row.payload->>'email-notifications')::boolean, false),
        coalesce((registration_row.payload->>'aeora-membership-acknowledgement')::boolean, false)
      )
      returning * into member_row;
    else
      update public.members
      set
        email = member_email,
        first_name = member_first_name,
        last_name = member_last_name,
        phone = registration_row.payload->>'club-phone',
        riding_level = registration_row.payload->>'riding-level',
        membership_type = member_type,
        birthday = nullif(registration_row.payload->>'club-birthday', '')::date,
        address = nullif(registration_row.payload->>'club-address', ''),
        horse_level = nullif(registration_row.payload->>'horse-level', ''),
        emergency_first_name = nullif(registration_row.payload->>'emergency-first-name', ''),
        emergency_last_name = nullif(registration_row.payload->>'emergency-last-name', ''),
        emergency_phone = nullif(registration_row.payload->>'emergency-phone', ''),
        email_notifications = coalesce((registration_row.payload->>'email-notifications')::boolean, false),
        aeora_membership_acknowledged = coalesce((registration_row.payload->>'aeora-membership-acknowledgement')::boolean, false),
        updated_at = now()
      where id = member_row.id
      returning * into member_row;
    end if;

    insert into public.membership_renewals (member_id, registration_id, financial_year, amount, membership_type)
    values (member_row.id, registration_row.id, renewal_fy, renewal_fee, member_type)
    on conflict (member_id, financial_year) do nothing;

    update public.registrations
    set payload = jsonb_set(
      jsonb_set(registration_row.payload, '{membership-number}', to_jsonb(member_row.membership_number), true),
      '{calculated-total}',
      to_jsonb(renewal_fee::text),
      true
    )
    where id = registration_row.id;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
