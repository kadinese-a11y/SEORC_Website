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
join public.registrations as registration
  on registration.id::text = split_part(result.entry_id, ':', 1)
join public.members as member
  on member.email = lower(btrim(coalesce(
    nullif(registration.payload ->> 'membership-email', ''),
    nullif(registration.payload ->> 'participant-email', '')
  )))
  and (
    nullif(btrim(registration.payload ->> 'membership-number'), '') is null
    or member.membership_number = btrim(registration.payload ->> 'membership-number')
  )
join public.membership_renewals as renewal
  on renewal.member_id = member.id
  and renewal.paid_at is not null
  and renewal.financial_year = public.au_financial_year(coalesce(
    (select event.date from public.events as event where event.id = result.event_id),
    result.processed_at::date,
    result.created_at::date
  ))
where result.published_at is not null
  and result.scratched is false
  and (result.processed_at is not null or result.result_place is not null);

grant select on public.annual_points_entries to anon, authenticated;
