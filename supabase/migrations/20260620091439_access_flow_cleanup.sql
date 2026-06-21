-- Remove superseded policies left by the earlier schema versions.
drop policy if exists "Public can read active events" on public.events;
drop policy if exists "Public can view media" on public.media_assets;
drop policy if exists "Public can read published results" on public.show_results;
drop policy if exists "Admins view registrations" on public.registrations;

-- Archived event records are administration-only, matching the route flow.
drop policy if exists "Achieved events are public" on public.achieved_events;
drop policy if exists "Admins manage achieved events" on public.achieved_events;
create policy "Admins manage achieved events"
on public.achieved_events for all to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
