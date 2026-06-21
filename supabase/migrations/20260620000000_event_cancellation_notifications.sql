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

alter table public.admin_roles enable row level security;
alter table public.event_cancellations enable row level security;

drop policy if exists "Admins can view their own role" on public.admin_roles;
create policy "Admins can view their own role"
on public.admin_roles for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view cancellations" on public.event_cancellations;
create policy "Admins can view cancellations"
on public.event_cancellations for select to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
