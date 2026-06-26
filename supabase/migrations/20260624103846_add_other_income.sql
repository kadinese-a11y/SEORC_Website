create table public.other_income (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  date_received date not null default current_date,
  financial_year text not null,
  created_at timestamptz not null default now()
);
alter table public.other_income enable row level security;
create policy "Admins manage other income" on public.other_income for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
