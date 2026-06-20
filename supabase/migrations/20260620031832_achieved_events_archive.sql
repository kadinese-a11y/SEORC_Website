create schema if not exists private;

create table if not exists public.achieved_events (
  event_id text primary key,
  event_date date not null,
  event_data jsonb not null,
  results jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

alter table public.achieved_events enable row level security;
create policy "Achieved events are public" on public.achieved_events for select to anon, authenticated using (true);

create or replace function private.archive_completed_events()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  insert into public.achieved_events (event_id, event_date, event_data, results)
  select
    e.id,
    e.date,
    jsonb_build_object('id', e.id, 'type', e.type, 'date', e.date, 'title', e.title, 'location', e.location, 'description', e.description, 'cancelled_at', e.cancelled_at),
    coalesce((select jsonb_agg(to_jsonb(r) order by r.class_name, r.result_place nulls last) from public.show_results r where r.event_id = e.id and r.published_at is not null), '[]'::jsonb)
  from public.events e
  where e.date < current_date
  on conflict (event_id) do update
    set event_data = excluded.event_data, results = excluded.results, archived_at = now();

  delete from public.events
  where date < (current_date - interval '12 months')::date;
end;
$$;

revoke all on function private.archive_completed_events() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule(
  'archive-and-expire-achieved-events',
  '5 0 * * *',
  'select private.archive_completed_events()'
);
