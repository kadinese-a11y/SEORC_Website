-- A single policy per action keeps the permission model predictable.
drop policy if exists "Public can view active events" on public.events;
drop policy if exists "Admins manage events" on public.events;
create policy "Public reads active events" on public.events for select to anon using (cancelled_at is null);
create policy "Admins manage events" on public.events for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Published media is public" on public.media_assets;
drop policy if exists "Admins manage media" on public.media_assets;
create policy "Public reads published media" on public.media_assets for select to anon using (published_at is not null);
create policy "Admins manage media" on public.media_assets for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Admins read registrations" on public.registrations;
drop policy if exists "Assigned judges read show entries" on public.registrations;
create policy "Admins and judges read permitted registrations" on public.registrations for select to authenticated
using (
  exists (select 1 from public.admin_roles where user_id = (select auth.uid()))
  or (form_type = 'show_registration' and exists (select 1 from public.judge_assignments where user_id = (select auth.uid()) and event_id = payload->>'show-date'))
);

drop policy if exists "Admins manage judge assignments" on public.judge_assignments;
drop policy if exists "Judges read own assignments" on public.judge_assignments;
create policy "Admins and judges read assignments" on public.judge_assignments for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins change judge assignments" on public.judge_assignments for insert to authenticated
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins update judge assignments" on public.judge_assignments for update to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
create policy "Admins delete judge assignments" on public.judge_assignments for delete to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Published results are public" on public.show_results;
drop policy if exists "Admins manage all results" on public.show_results;
drop policy if exists "Judges manage assigned show results" on public.show_results;
create policy "Public reads published results" on public.show_results for select to anon using (published_at is not null);
create policy "Admins and judges read results" on public.show_results for select to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())) or exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())));
create policy "Admins and judges create results" on public.show_results for insert to authenticated
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())) or exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())));
create policy "Admins and judges update results" on public.show_results for update to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())) or exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())) or exists (select 1 from public.judge_assignments where event_id = show_results.event_id and user_id = (select auth.uid())));
create policy "Admins delete results" on public.show_results for delete to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
