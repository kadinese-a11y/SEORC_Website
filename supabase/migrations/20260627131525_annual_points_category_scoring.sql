drop view if exists public.annual_points_leaderboard;
drop view if exists public.annual_points_entries;

create view public.annual_points_entries as
with eligible_results as (
  select
    result.id,
    result.event_id,
    coalesce(event.date, result.processed_at::date, result.created_at::date) as event_date,
    extract(year from coalesce(event.date, result.processed_at::date, result.created_at::date))::integer as calendar_year,
    result.class_name,
    result.participant_name,
    result.horse_name,
    result.riding_class,
    result.result_place,
    result.processed_at,
    result.published_at,
    case
      when member.membership_type = 'junior' then 'Junior'
      when lower(coalesce(member.riding_level, '')) = 'professional' then 'Professional'
      when lower(coalesce(member.riding_level, '')) = 'rookie' then 'Rookie'
      when lower(coalesce(member.riding_level, '')) = 'encouragement' then 'Encouragement'
      else 'Amateur'
    end as points_category
  from public.show_results as result
  left join public.events as event
    on event.id = result.event_id
  join public.members as member
    on lower(regexp_replace(btrim(result.participant_name), '\s+', ' ', 'g')) =
       lower(regexp_replace(btrim(concat_ws(' ', member.first_name, member.last_name)), '\s+', ' ', 'g'))
  join public.membership_renewals as renewal
    on renewal.member_id = member.id
   and renewal.financial_year = public.au_financial_year(coalesce(event.date, result.processed_at::date, result.created_at::date))
  where result.published_at is not null
    and result.processed_at is not null
    and coalesce(result.scratched, false) = false
    and result.result_place is not null
),
class_sizes as (
  select
    event_id,
    class_name,
    count(*)::integer as class_entry_count
  from public.show_results
  where published_at is not null
    and processed_at is not null
    and coalesce(scratched, false) = false
    and result_place is not null
  group by event_id, class_name
)
select
  eligible_results.id as result_id,
  eligible_results.event_id,
  eligible_results.event_date,
  eligible_results.calendar_year,
  eligible_results.class_name,
  eligible_results.participant_name,
  eligible_results.horse_name,
  eligible_results.riding_class,
  eligible_results.points_category,
  eligible_results.result_place,
  class_sizes.class_entry_count,
  case
    when class_sizes.class_entry_count > 3 then
      case
        when eligible_results.result_place = 1 then 5
        when eligible_results.result_place = 2 then 4
        when eligible_results.result_place = 3 then 3
        when eligible_results.result_place = 4 then 2
        when eligible_results.result_place > 4 then 1
        else 0
      end
    else
      case
        when eligible_results.result_place = 1 then 4
        when eligible_results.result_place = 2 then 3
        when eligible_results.result_place = 3 then 2
        else 0
      end
  end::integer as points,
  eligible_results.processed_at,
  eligible_results.published_at
from eligible_results
join class_sizes
  on class_sizes.event_id = eligible_results.event_id
 and class_sizes.class_name = eligible_results.class_name;

create view public.annual_points_leaderboard as
with combo_totals as (
  select
    calendar_year,
    points_category,
    participant_name,
    horse_name,
    sum(points)::integer as points,
    count(*)::integer as entries,
    count(distinct event_id)::integer as events
  from public.annual_points_entries
  group by calendar_year, points_category, participant_name, horse_name
),
ranked as (
  select
    *,
    rank() over (
      partition by calendar_year, points_category
      order by points desc, participant_name asc, horse_name asc
    )::integer as rank
  from combo_totals
)
select *
from ranked
where rank <= 5;

grant select on public.annual_points_entries to anon, authenticated;
grant select on public.annual_points_leaderboard to anon, authenticated;

notify pgrst, 'reload schema';
