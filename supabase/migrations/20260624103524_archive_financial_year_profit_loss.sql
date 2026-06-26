create table public.financial_year_pl_archives (
  financial_year text primary key,
  report jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.financial_year_pl_archives enable row level security;
create policy "Admins read financial year P&L archives" on public.financial_year_pl_archives for select to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

create or replace function private.archive_previous_financial_year_pl()
returns void language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare fy text := public.au_financial_year((current_date - interval '1 day')::date);
begin
  insert into public.financial_year_pl_archives (financial_year, report)
  select fy, jsonb_build_object(
    'events', coalesce((select jsonb_agg(to_jsonb(p) order by p.event_date) from public.event_pl p where p.financial_year = fy), '[]'::jsonb),
    'event_income', coalesce((select sum(income) from public.event_pl where financial_year = fy), 0),
    'event_expenses', coalesce((select sum(expenses) from public.event_pl where financial_year = fy), 0),
    'club_expenses', coalesce((select sum(amount) from public.club_expenses where financial_year = fy), 0)
  ) on conflict (financial_year) do update set report = excluded.report, created_at = now();
end;
$$;
revoke all on function private.archive_previous_financial_year_pl() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'archive-previous-financial-year-pl';
select cron.schedule('archive-previous-financial-year-pl', '10 0 1 7 *', 'select private.archive_previous_financial_year_pl()');
