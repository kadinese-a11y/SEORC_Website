with latest_membership_form as (
  select distinct on (lower(btrim(payload ->> 'club-email')))
    payload,
    lower(btrim(payload ->> 'club-email')) as email
  from public.registrations
  where form_type = 'club_membership'
    and nullif(btrim(payload ->> 'club-email'), '') is not null
  order by lower(btrim(payload ->> 'club-email')), created_at desc
)
insert into public.members (email, first_name, last_name, phone, riding_level)
select
  email,
  coalesce(nullif(btrim(payload ->> 'club-first-name'), ''), 'Member'),
  coalesce(nullif(btrim(payload ->> 'club-last-name'), ''), 'Record'),
  nullif(btrim(payload ->> 'club-phone'), ''),
  nullif(btrim(payload ->> 'riding-level'), '')
from latest_membership_form
on conflict (email) do update set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  phone = excluded.phone,
  riding_level = excluded.riding_level,
  updated_at = now();

update public.registrations as registration
set payload = jsonb_set(registration.payload, '{membership-number}', to_jsonb(member.membership_number), true)
from public.members as member
where registration.form_type = 'club_membership'
  and lower(btrim(registration.payload ->> 'club-email')) = member.email;

with membership_forms as (
  select distinct on (lower(btrim(payload ->> 'club-email')), public.au_financial_year(created_at::date))
    id,
    lower(btrim(payload ->> 'club-email')) as email,
    public.au_financial_year(created_at::date) as financial_year
  from public.registrations
  where form_type = 'club_membership'
    and nullif(btrim(payload ->> 'club-email'), '') is not null
  order by lower(btrim(payload ->> 'club-email')), public.au_financial_year(created_at::date), created_at desc
)
insert into public.membership_renewals (member_id, registration_id, financial_year, amount)
select
  member.id,
  membership_forms.id,
  membership_forms.financial_year,
  coalesce((select membership_fee from public.club_settings where setting_key = 'annual_membership_fee'), 20)
from membership_forms
join public.members as member on member.email = membership_forms.email
on conflict do nothing;
