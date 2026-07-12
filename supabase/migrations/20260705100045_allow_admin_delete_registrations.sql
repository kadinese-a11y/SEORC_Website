drop policy if exists "Admins delete registrations" on public.registrations;

create policy "Admins delete registrations"
on public.registrations
for delete
to authenticated
using (
  exists (
    select 1
    from public.admin_roles
    where admin_roles.user_id = (select auth.uid())
  )
);
