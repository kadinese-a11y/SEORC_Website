alter table public.show_results
  add column if not exists entry_id text;

with registration_entries as (
  select
    registration.id::text as registration_id,
    registration.payload->>'show-date' as event_id,
    trim(concat_ws(
      ' ',
      nullif(registration.payload->>'participant-first-name', ''),
      nullif(registration.payload->>'participant-last-name', '')
    )) as participant_name,
    registration.payload->>concat('horse-', class_field.horse_number, '-name') as horse_name,
    initcap(replace(class_field.class_slug, '-', ' ')) as class_name,
    concat(
      registration.id::text,
      ':',
      class_field.horse_number,
      ':',
      initcap(replace(class_field.class_slug, '-', ' '))
    ) as entry_id
  from public.registrations as registration
  cross join lateral jsonb_each(registration.payload) as payload_field(key, value)
  cross join lateral regexp_matches(payload_field.key, '^horse-([0-9]+)-class-(.+)$') as class_field_match(matches)
  cross join lateral (
    select
      class_field_match.matches[1] as horse_number,
      class_field_match.matches[2] as class_slug
  ) as class_field
  where registration.form_type = 'show_registration'
    and payload_field.value = 'true'::jsonb
    and registration.payload ? 'show-date'
),
matched_results as (
  select
    result.id as result_id,
    registration_entries.entry_id,
    count(*) over (partition by result.id) as match_count
  from public.show_results as result
  join registration_entries
    on registration_entries.event_id = result.event_id
   and lower(registration_entries.class_name) = lower(result.class_name)
   and lower(registration_entries.participant_name) = lower(result.participant_name)
   and lower(coalesce(registration_entries.horse_name, '')) = lower(coalesce(result.horse_name, ''))
  where result.entry_id is null or btrim(result.entry_id) = ''
)
update public.show_results as result
set entry_id = matched_results.entry_id
from matched_results
where result.id = matched_results.result_id
  and matched_results.match_count = 1;

update public.show_results
set entry_id = lower(regexp_replace(
  concat_ws(
    ':',
    coalesce(nullif(participant_name, ''), 'participant'),
    coalesce(nullif(horse_name, ''), 'horse'),
    coalesce(nullif(riding_class, ''), 'class'),
    id::text
  ),
  '[^a-zA-Z0-9:]+',
  '-',
  'g'
))
where entry_id is null or btrim(entry_id) = '';

alter table public.show_results
  alter column entry_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'show_results_event_id_class_name_entry_id_key'
      and conrelid = 'public.show_results'::regclass
  ) then
    alter table public.show_results
      add constraint show_results_event_id_class_name_entry_id_key
      unique (event_id, class_name, entry_id);
  end if;
end $$;

with ranked_results as (
  select
    id,
    row_number() over (
      partition by event_id, class_name
      order by
        coalesce((
          select sum(score.value::numeric)
          from jsonb_each_text(obstacle_scores) as score(key, value)
          where score.value ~ '^-?[0-9]+([.][0-9]+)?$'
        ), 0) desc,
        timing_seconds asc nulls last,
        participant_name asc,
        horse_name asc,
        id asc
    ) as new_result_place
  from public.show_results
  where coalesce(scratched, false) = false
    and (
      processed_at is not null
      or published_at is not null
      or result_place is not null
    )
)
update public.show_results as result
set
  result_place = ranked_results.new_result_place,
  updated_at = now()
from ranked_results
where result.id = ranked_results.id
  and result.result_place is distinct from ranked_results.new_result_place;

update public.show_results
set
  result_place = null,
  updated_at = now()
where coalesce(scratched, false) = true
  and result_place is not null;

notify pgrst, 'reload schema';
