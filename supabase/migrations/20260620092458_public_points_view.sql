drop policy if exists "Public reads published results" on public.show_results;

create or replace view public.annual_points_entries as
select
  event_id,
  participant_name,
  horse_name,
  riding_class,
  coalesce((select sum(value::numeric) from jsonb_each_text(obstacle_scores)), 0) as points,
  processed_at,
  result_place
from public.show_results
where published_at is not null and scratched is false and (processed_at is not null or result_place is not null);

grant select on public.annual_points_entries to anon, authenticated;
