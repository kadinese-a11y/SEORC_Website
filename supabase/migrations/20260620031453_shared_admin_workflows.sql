-- Shared club workflows. Add administrators by inserting their auth.users id into
-- public.admin_roles from the Supabase dashboard/service role.
create table if not exists public.events (
  id text primary key,
  type text not null check (type in ('club', 'show', 'clinic')),
  date date not null,
  title text not null,
  location text not null,
  description text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.judge_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.attendee_transfers (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  from_event_id text not null,
  to_event_id text not null references public.events(id),
  transferred_by uuid not null default auth.uid() references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  alt_text text not null,
  caption text,
  event_id text references public.events(id) on delete set null,
  published_at timestamptz,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- The table may already exist from an earlier manual setup.
alter table public.media_assets add column if not exists published_at timestamptz;
alter table public.media_assets add column if not exists caption text;
alter table public.media_assets add column if not exists event_id text references public.events(id) on delete set null;
alter table public.media_assets add column if not exists storage_path text;
alter table public.media_assets add column if not exists alt_text text not null default '';
alter table public.media_assets add column if not exists uploaded_by uuid references auth.users(id);

alter table public.events enable row level security;
alter table public.judge_assignments enable row level security;
alter table public.attendee_transfers enable row level security;
alter table public.media_assets enable row level security;
alter table public.show_results add column if not exists published_at timestamptz;

-- Existing development policies are deliberately replaced: registrations and
-- unfinished score sheets must never be readable with the public key.
drop policy if exists "Temporary public read for development" on public.registrations;
drop policy if exists "Temporary public read show results for development" on public.show_results;
drop policy if exists "Temporary public write show results for development" on public.show_results;

drop policy if exists "Public can view active events" on public.events;
drop policy if exists "Admins manage events" on public.events;
create policy "Public can view active events" on public.events for select to anon, authenticated using (cancelled_at is null);
create policy "Admins manage events" on public.events for all to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Admins read registrations" on public.registrations;
drop policy if exists "Admins update registrations" on public.registrations;
drop policy if exists "Assigned judges read show entries" on public.registrations;
create policy "Admins read registrations" on public.registrations for select to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins update registrations" on public.registrations for update to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Assigned judges read show entries" on public.registrations for select to authenticated
  using (form_type = 'show_registration' and exists (
    select 1 from public.judge_assignments
    where user_id = (select auth.uid()) and event_id = payload->>'show-date'
  ));

drop policy if exists "Admins manage judge assignments" on public.judge_assignments;
drop policy if exists "Judges read own assignments" on public.judge_assignments;
create policy "Admins manage judge assignments" on public.judge_assignments for all to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Judges read own assignments" on public.judge_assignments for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Admins manage transfers" on public.attendee_transfers;
create policy "Admins manage transfers" on public.attendee_transfers for all to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Published results are public" on public.show_results;
drop policy if exists "Admins manage all results" on public.show_results;
drop policy if exists "Judges manage assigned show results" on public.show_results;
create policy "Published results are public" on public.show_results for select to anon, authenticated using (published_at is not null);
create policy "Admins manage all results" on public.show_results for all to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Judges manage assigned show results" on public.show_results for all to authenticated
  using (exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())))
  with check (exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())));

drop policy if exists "Published media is public" on public.media_assets;
drop policy if exists "Admins manage media" on public.media_assets;
create policy "Published media is public" on public.media_assets for select to anon, authenticated using (published_at is not null);
create policy "Admins manage media" on public.media_assets for all to authenticated
  using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public) values ('club-media', 'club-media', false)
on conflict (id) do update set public = false;
drop policy if exists "Published club media is readable" on storage.objects;
drop policy if exists "Admins upload club media" on storage.objects;
drop policy if exists "Admins update club media" on storage.objects;
drop policy if exists "Admins delete club media" on storage.objects;
create policy "Published club media is readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'club-media' and exists (select 1 from public.media_assets where storage_path = name and published_at is not null));
create policy "Admins upload club media" on storage.objects for insert to authenticated
  with check (bucket_id = 'club-media' and exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins update club media" on storage.objects for update to authenticated
  using (bucket_id = 'club-media' and exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
  with check (bucket_id = 'club-media' and exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins delete club media" on storage.objects for delete to authenticated
  using (bucket_id = 'club-media' and exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
