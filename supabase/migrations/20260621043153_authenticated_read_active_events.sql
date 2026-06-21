drop policy if exists "Public reads active events" on public.events;
create policy "Public and authenticated users read active events"
on public.events for select to anon, authenticated
using (cancelled_at is null);
