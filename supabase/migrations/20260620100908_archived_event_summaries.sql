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
    to_jsonb(e) || jsonb_build_object(
      'archive_summary',
      jsonb_build_object(
        'participants', coalesce(summary.participants, 0),
        'horses', coalesce(summary.horses, 0),
        'campers', coalesce(summary.campers, 0),
        'day_memberships', coalesce(summary.day_memberships, 0),
        'dinner_tickets', coalesce(summary.dinner_tickets, 0),
        'revenue', coalesce(summary.revenue, 0)
      )
    ),
    coalesce((select jsonb_agg(to_jsonb(r) order by r.class_name, r.result_place nulls last) from public.show_results r where r.event_id = e.id and r.published_at is not null), '[]'::jsonb)
  from public.events e
  left join lateral (
    select
      count(*)::integer as participants,
      sum((select count(*) from jsonb_each(coalesce(reg.payload, '{}'::jsonb)) item(key, value) where item.key ~ '^horse-[0-9]+-name$' and item.value <> '""'::jsonb))::integer as horses,
      count(*) filter (where reg.payload->>'camping-with-power' = 'true' or reg.payload->>'camping-without-power' = 'true')::integer as campers,
      count(*) filter (where reg.payload->>'aeora-day-membership' = 'true' or reg.payload->>'aeora-membership' = 'day')::integer as day_memberships,
      sum(coalesce(nullif(reg.payload->>'dinner-count', '')::integer, 0))::integer as dinner_tickets,
      sum(case when coalesce(nullif(reg.payload->>'calculated-total', '')::numeric, 0) > 0 then (reg.payload->>'calculated-total')::numeric when reg.payload->>'aeora-day-membership' = 'true' or reg.payload->>'aeora-membership' = 'day' then 20 else 0 end) as revenue
    from public.registrations reg
    where coalesce(reg.payload->>'show-date', reg.payload->>'club-date', reg.payload->>'event-id') = e.id
  ) summary on true
  where e.date < current_date
  on conflict (event_id) do update
    set event_data = excluded.event_data, results = excluded.results, archived_at = now();

  delete from public.events
  where date < (current_date - interval '12 months')::date;
end;
$$;
