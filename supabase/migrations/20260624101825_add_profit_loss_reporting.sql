create table public.event_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  date_incurred date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.club_expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  date_incurred date not null default current_date,
  financial_year text not null,
  created_at timestamptz not null default now()
);

alter table public.event_expenses enable row level security;
alter table public.club_expenses enable row level security;

create policy "Admins manage event expenses" on public.event_expenses for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins manage club expenses" on public.club_expenses for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

create or replace function public.au_financial_year(d date)
returns text language sql immutable as $$
  select case when extract(month from d) >= 7
    then extract(year from d)::text || '-' || right((extract(year from d) + 1)::text, 2)
    else (extract(year from d) - 1)::text || '-' || right(extract(year from d)::text, 2) end
$$;

create or replace view public.event_income with (security_invoker = true) as
select coalesce(r.payload->>'show-date', r.payload->>'club-date', r.payload->>'clinic-date', r.payload->>'event-id') as event_id,
  sum(coalesce(nullif(r.payload->>'calculated-total', '')::numeric, 0)) as total_income
from public.registrations r
group by 1;

create or replace view public.event_expense_totals with (security_invoker = true) as
select event_id, sum(amount) as total_expenses from public.event_expenses group by event_id;

create or replace view public.event_pl with (security_invoker = true) as
select e.id as event_id, e.title, e.date as event_date, public.au_financial_year(e.date) as financial_year,
  coalesce(i.total_income, 0) as income, coalesce(x.total_expenses, 0) as expenses,
  coalesce(i.total_income, 0) - coalesce(x.total_expenses, 0) as profit
from public.events e
left join public.event_income i on i.event_id = e.id
left join public.event_expense_totals x on x.event_id = e.id;

create or replace view public.club_pl_summary with (security_invoker = true) as
select p.financial_year, sum(p.income) as event_income, sum(p.expenses) as event_expenses,
  coalesce(c.club_expenses, 0) as club_expenses,
  sum(p.income) - sum(p.expenses) - coalesce(c.club_expenses, 0) as net_profit
from public.event_pl p
left join (select financial_year, sum(amount) as club_expenses from public.club_expenses group by financial_year) c using (financial_year)
group by p.financial_year, c.club_expenses;
