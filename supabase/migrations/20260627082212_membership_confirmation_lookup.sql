create or replace function public.lookup_membership_confirmation(registration_id uuid, member_email text)
returns table(membership_number text, first_name text, last_name text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select
    r.payload->>'membership-number' as membership_number,
    r.payload->>'club-first-name' as first_name,
    r.payload->>'club-last-name' as last_name
  from public.registrations as r
  where r.id = registration_id
    and r.form_type = 'club_membership'
    and lower(r.payload->>'club-email') = lower(member_email)
    and coalesce(r.payload->>'membership-number', '') <> ''
  limit 1
$$;

grant execute on function public.lookup_membership_confirmation(uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
