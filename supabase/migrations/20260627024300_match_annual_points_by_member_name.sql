create or replace view public.annual_points_entries as
select
  result.event_id,
  result.participant_name,
  result.horse_name,
  result.riding_class,
  coalesce((select sum(value::numeric) from jsonb_each_text(result.obstacle_scores)), 0) as points,
  result.processed_at,
  result.result_place
from public.show_results as result
where result.published_at is not null
  and result.scratched is false
  and (result.processed_at is not null or result.result_place is not null)
  and exists (
    select 1
    from public.members as member
    join public.membership_renewals as renewal
      on renewal.member_id = member.id
    where lower(regexp_replace(btrim(result.participant_name), '\s+', ' ', 'g')) =
      lower(regexp_replace(btrim(concat_ws(' ', member.first_name, member.last_name)), '\s+', ' ', 'g'))
      and renewal.financial_year = public.au_financial_year(coalesce(
        (select event.date from public.events as event where event.id = result.event_id),
        result.processed_at::date,
        result.created_at::date
      ))
  );

grant select on public.annual_points_entries to anon, authenticated;
