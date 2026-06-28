create or replace view public.event_income with (security_invoker = true) as
select
  e.id as event_id,
  coalesce(sum(case
    when r.form_type = 'club_day_registration' and r.payload->>'club-day-paid' = 'true'
      then coalesce(nullif(e.event_settings->>'club_day_fee', '')::numeric, 40)
    when r.form_type = 'show_registration'
      then greatest(
        coalesce(nullif(r.payload->>'calculated-total', '')::numeric, 0)
        - case
            when r.payload->>'aeora-membership' = 'day' or r.payload->>'aeora-day-membership' = 'true'
              then 25
            else 0
          end
        - (
            coalesce(nullif(r.payload->>'dinner-count', '')::numeric, 0)
            * coalesce(nullif(e.event_settings->>'dinner_price', '')::numeric, 30)
          )
        - (
            (
              case when r.payload->>'camping-with-power' = 'true'
                then coalesce(nullif(e.event_settings->>'powered_camping_price', '')::numeric, 30)
                else 0
              end
              + case when r.payload->>'camping-without-power' = 'true'
                then coalesce(nullif(e.event_settings->>'unpowered_camping_price', '')::numeric, 20)
                else 0
              end
            )
            * coalesce(nullif(r.payload->>'camping-night-count', '')::numeric, 0)
          )
        - (
            coalesce(nullif(r.payload->>'yard-count', '')::numeric, 0)
            * coalesce(nullif(e.event_settings->>'yard_price', '')::numeric, 5)
          ),
        0
      )
    when r.form_type = 'clinic_registration'
      then coalesce(nullif(r.payload->>'calculated-total', '')::numeric, 0)
    else 0
  end), 0) as total_income
from public.events e
left join public.registrations r
  on coalesce(r.payload->>'show-date', r.payload->>'club-date', r.payload->>'clinic-date', r.payload->>'event-id') = e.id
group by e.id;

notify pgrst, 'reload schema';
