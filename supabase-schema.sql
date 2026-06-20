create extension if not exists "pgcrypto";

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  form_type text not null,
  page_path text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.registrations add column if not exists confirmation_token uuid not null default gen_random_uuid();
alter table public.registrations add column if not exists confirmation_sent_at timestamptz;

create table if not exists public.show_results (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  class_name text not null,
  entry_id text not null,
  participant_name text not null,
  horse_name text not null,
  riding_class text,
  obstacle_scores jsonb not null default '{}'::jsonb,
  timing_seconds numeric,
  scratched boolean not null default false,
  result_place integer,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, class_name, entry_id)
);

create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.event_cancellations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_title text not null,
  message text,
  cancelled_by uuid not null references auth.users(id),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  notification_status text not null default 'pending' check (notification_status in ('pending', 'sending', 'sent', 'partially_sent', 'failed')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.show_results add column if not exists result_place integer;
alter table public.show_results add column if not exists processed_at timestamptz;

alter table public.registrations enable row level security;
alter table public.show_results enable row level security;
alter table public.admin_roles enable row level security;
alter table public.event_cancellations enable row level security;

drop policy if exists "Anyone can submit registrations" on public.registrations;
drop policy if exists "Signed in admins can view registrations" on public.registrations;
drop policy if exists "Temporary public read for development" on public.registrations;
drop policy if exists "Temporary public read show results for development" on public.show_results;
drop policy if exists "Temporary public write show results for development" on public.show_results;

create policy "Anyone can submit registrations"
on public.registrations
for insert
to anon, authenticated
with check (true);

create policy "Temporary public read for development"
on public.registrations
for select
to anon, authenticated
using (true);

create policy "Temporary public read show results for development"
on public.show_results
for select
to anon, authenticated
using (true);

create policy "Temporary public write show results for development"
on public.show_results
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Admins can view their own role" on public.admin_roles;
create policy "Admins can view their own role"
on public.admin_roles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view cancellations" on public.event_cancellations;
create policy "Admins can view cancellations"
on public.event_cancellations for select to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
