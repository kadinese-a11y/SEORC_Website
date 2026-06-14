create extension if not exists "pgcrypto";

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  form_type text not null,
  page_path text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.registrations enable row level security;

drop policy if exists "Anyone can submit registrations" on public.registrations;

create policy "Anyone can submit registrations"
on public.registrations
for insert
to anon, authenticated
with check (true);
