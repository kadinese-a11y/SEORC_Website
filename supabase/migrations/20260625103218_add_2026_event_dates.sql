alter table public.events drop constraint if exists events_type_check;
alter table public.events
  add constraint events_type_check
  check (type in ('club', 'show', 'clinic', 'external-show', 'external-clinic'));

insert into public.events (id, type, date, title, location, description, event_settings)
values
  (
    'forbes-aeora-2-day-show-2026-07-04',
    'external-show',
    '2026-07-04',
    'Forbes AEORA 2 Day Show',
    'Forbes, New South Wales, Australia',
    'External AEORA show listed for members. Runs Saturday 4 July to Sunday 5 July 2026.',
    jsonb_build_object('provider_url', '', 'external_cost', 'See provider')
  ),
  (
    'shoalhaven-eorc-practice-day-2026-07-25',
    'club',
    '2026-07-25',
    'Shoalhaven EORC Practice Day',
    'Shoalhaven, New South Wales, Australia',
    'Club practice weekend. Runs Saturday 25 July to Sunday 26 July 2026.',
    jsonb_build_object('club_day_fee', 40)
  ),
  (
    'shoalhaven-eorc-1-day-show-2026-08-01',
    'show',
    '2026-08-01',
    'Shoalhaven EORC 1 Day Show',
    'Shoalhaven, New South Wales, Australia',
    'One day Shoalhaven EORC show.',
    '{}'::jsonb
  ),
  (
    'shoalhaven-eorc-practice-days-2026-08-22',
    'club',
    '2026-08-22',
    'Shoalhaven EORC Practice Days',
    'Shoalhaven, New South Wales, Australia',
    'Club practice days. Runs Saturday 22 August to Sunday 23 August 2026.',
    jsonb_build_object('club_day_fee', 40)
  ),
  (
    'shoalhaven-eorc-1-day-show-2026-09-12',
    'show',
    '2026-09-12',
    'Shoalhaven EORC 1 Day Show',
    'Worrigee Equestrian Common, Worrigee, New South Wales, Australia',
    'One day Shoalhaven EORC show at Worrigee Equestrian Common.',
    '{}'::jsonb
  ),
  (
    'shoalhaven-eorc-practice-day-2026-09-26',
    'club',
    '2026-09-26',
    'Shoalhaven EORC Practice Day',
    'Shoalhaven, New South Wales, Australia',
    'Club practice day.',
    jsonb_build_object('club_day_fee', 40)
  ),
  (
    'shoalhaven-eorc-2-day-show-2026-10-31',
    'show',
    '2026-10-31',
    'Shoalhaven EORC 2 Day Show',
    'Shoalhaven, New South Wales, Australia',
    'Two day Shoalhaven EORC show. Runs Saturday 31 October to Sunday 1 November 2026.',
    '{}'::jsonb
  ),
  (
    'forbes-championships-2026-11-28',
    'external-show',
    '2026-11-28',
    'Forbes Championships',
    'Forbes, New South Wales, Australia',
    'External Forbes Championships listed for members. Runs Saturday 28 November to Sunday 29 November 2026.',
    jsonb_build_object('provider_url', '', 'external_cost', 'See provider')
  ),
  (
    'shoalhaven-eorc-show-presentation-night-2026-12-05',
    'show',
    '2026-12-05',
    'Shoalhaven EORC Show & Presentation Night',
    'Shoalhaven, New South Wales, Australia',
    'Show, presentation night, dinner, and music.',
    '{}'::jsonb
  )
on conflict (id) do update
set
  type = excluded.type,
  date = excluded.date,
  title = excluded.title,
  location = excluded.location,
  description = excluded.description,
  event_settings = excluded.event_settings,
  cancelled_at = null,
  updated_at = now();
