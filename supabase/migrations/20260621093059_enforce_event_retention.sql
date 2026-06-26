-- Only current, non-cancelled events are public. Show days are retained through
-- the achieved-events archive; other event records are removed after 12 months.
drop policy if exists "Public and authenticated users read active events" on public.events;
create policy "Public and authenticated users read current events"
on public.events for select to anon, authenticated
using (cancelled_at is null and date >= current_date);

create or replace function private.expire_non_show_event_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  delete from public.attendee_transfers
  where from_event_id in (select id from public.events where type <> 'show' and date < current_date - interval '12 months')
     or to_event_id in (select id from public.events where type <> 'show' and date < current_date - interval '12 months');

  delete from public.registrations
  where coalesce(payload->>'show-date', payload->>'club-date', payload->>'clinic-date', payload->>'event-id')
    in (select id from public.events where type <> 'show' and date < current_date - interval '12 months');

  delete from public.events
  where type <> 'show' and date < current_date - interval '12 months';
end;
$$;

revoke all on function private.expire_non_show_event_data() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'expire-non-show-event-data-after-12-months';
select cron.schedule('expire-non-show-event-data-after-12-months', '10 0 * * *', 'select private.expire_non_show_event_data()');
