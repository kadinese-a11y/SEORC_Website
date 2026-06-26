create or replace view public.event_income with (security_invoker = true) as
select e.id as event_id,
  coalesce(sum(case
    when r.form_type = 'club_day_registration' and r.payload->>'club-day-paid' = 'true'
      then coalesce(nullif(e.event_settings->>'club_day_fee', '')::numeric, 40)
    when r.form_type in ('show_registration', 'clinic_registration')
      then coalesce(nullif(r.payload->>'calculated-total', '')::numeric, 0)
    else 0 end), 0) as total_income
from public.events e
left join public.registrations r
  on coalesce(r.payload->>'show-date', r.payload->>'club-date', r.payload->>'clinic-date', r.payload->>'event-id') = e.id
group by e.id;
