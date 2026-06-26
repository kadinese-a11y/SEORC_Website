create or replace function private.archive_previous_financial_year_pl()
returns void language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare fy text := public.au_financial_year((current_date - interval '1 day')::date);
begin
  insert into public.financial_year_pl_archives (financial_year, report)
  select fy, jsonb_build_object(
    'events', coalesce((select jsonb_agg(to_jsonb(p) order by p.event_date) from public.event_pl p where p.financial_year = fy), '[]'::jsonb),
    'event_income', coalesce((select sum(income) from public.event_pl where financial_year = fy), 0),
    'membership_income', coalesce((select sum(amount) from public.membership_renewals where financial_year = fy and paid_at is not null), 0),
    'other_income', coalesce((select sum(amount) from public.other_income where financial_year = fy), 0),
    'event_expenses', coalesce((select sum(expenses) from public.event_pl where financial_year = fy), 0),
    'club_expenses', coalesce((select sum(amount) from public.club_expenses where financial_year = fy), 0)
  ) on conflict (financial_year) do update set report = excluded.report, created_at = now();
end;
$$;

revoke all on function private.archive_previous_financial_year_pl() from public, anon, authenticated;
