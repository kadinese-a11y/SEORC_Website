insert into public.registrations (id, form_type, page_path, payload, created_at)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Mia",
      "participant-last-name": "Hart",
      "participant-date-of-birth": "1991-04-18",
      "participant-phone": "0400 111 201",
      "participant-email": "mia.hart@example.com",
      "riding-class": "Amateur",
      "horse-1-name": "Riverbend Scout",
      "horse-1-class-open": true,
      "horse-1-class-limited-open": false,
      "horse-1-class-amateur": true,
      "horse-1-class-masters": false,
      "horse-1-class-encouragement": false,
      "horse-1-class-rookie": false,
      "horse-1-class-junior": false,
      "horse-1-class-young-rider": false,
      "horse-1-class-green-horse": true,
      "camping-with-power": true,
      "camping-without-power": false,
      "yard-count": "1",
      "dinner-count": "2",
      "aeora-annual-membership": true,
      "aeora-day-membership": false,
      "calculated-total": "155"
    }$json$::jsonb,
    '2026-06-15 09:10:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Noah",
      "participant-last-name": "Bennett",
      "participant-date-of-birth": "1984-11-02",
      "participant-phone": "0400 111 202",
      "participant-email": "noah.bennett@example.com",
      "riding-class": "Professional",
      "horse-1-name": "Ironbark Echo",
      "horse-1-class-open": true,
      "horse-1-class-limited-open": true,
      "horse-1-class-amateur": false,
      "horse-1-class-masters": true,
      "horse-1-class-encouragement": false,
      "horse-1-class-rookie": false,
      "horse-1-class-junior": false,
      "horse-1-class-young-rider": false,
      "horse-1-class-green-horse": false,
      "camping-with-power": false,
      "camping-without-power": true,
      "yard-count": "2",
      "dinner-count": "1",
      "aeora-annual-membership": true,
      "aeora-day-membership": false,
      "calculated-total": "150"
    }$json$::jsonb,
    '2026-06-15 09:16:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Ava",
      "participant-last-name": "Collins",
      "participant-date-of-birth": "2009-07-29",
      "participant-phone": "0400 111 203",
      "participant-email": "ava.collins@example.com",
      "riding-class": "Junior",
      "horse-1-name": "Silver Fern",
      "horse-1-class-junior": true,
      "horse-1-class-young-rider": true,
      "horse-1-class-green-horse": false,
      "horse-2-name": "Sunny Ridge",
      "horse-2-class-encouragement": true,
      "horse-2-class-rookie": true,
      "horse-2-class-green-horse": true,
      "camping-with-power": false,
      "camping-without-power": false,
      "yard-count": "2",
      "dinner-count": "0",
      "aeora-annual-membership": false,
      "aeora-day-membership": true,
      "calculated-total": "155"
    }$json$::jsonb,
    '2026-06-15 09:23:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Grace",
      "participant-last-name": "McKenzie",
      "participant-date-of-birth": "1978-02-14",
      "participant-phone": "0400 111 204",
      "participant-email": "grace.mckenzie@example.com",
      "riding-class": "Encouragement",
      "horse-1-name": "Willow Creek",
      "horse-1-class-encouragement": true,
      "horse-1-class-rookie": false,
      "horse-1-class-green-horse": true,
      "camping-with-power": true,
      "camping-without-power": false,
      "yard-count": "1",
      "dinner-count": "1",
      "aeora-annual-membership": false,
      "aeora-day-membership": true,
      "calculated-total": "145"
    }$json$::jsonb,
    '2026-06-15 09:31:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Jack",
      "participant-last-name": "Taylor",
      "participant-date-of-birth": "1996-09-06",
      "participant-phone": "0400 111 205",
      "participant-email": "jack.taylor@example.com",
      "riding-class": "Rookie",
      "horse-1-name": "Cedar Moon",
      "horse-1-class-rookie": true,
      "horse-1-class-green-horse": true,
      "camping-with-power": false,
      "camping-without-power": true,
      "yard-count": "1",
      "dinner-count": "2",
      "aeora-annual-membership": true,
      "aeora-day-membership": false,
      "calculated-total": "135"
    }$json$::jsonb,
    '2026-06-15 09:37:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000006',
    'show_registration',
    '/show-registration.html',
    $json${
      "show-date": "default-show-2026-09-12",
      "participant-first-name": "Lily",
      "participant-last-name": "Nguyen",
      "participant-date-of-birth": "1989-12-11",
      "participant-phone": "0400 111 206",
      "participant-email": "lily.nguyen@example.com",
      "riding-class": "Amateur",
      "horse-1-name": "Blue Gum Star",
      "horse-1-class-amateur": true,
      "horse-1-class-masters": false,
      "horse-1-class-green-horse": true,
      "camping-with-power": false,
      "camping-without-power": false,
      "yard-count": "1",
      "dinner-count": "1",
      "aeora-annual-membership": true,
      "aeora-day-membership": false,
      "calculated-total": "90"
    }$json$::jsonb,
    '2026-06-15 09:44:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Emily","club-day-last-name":"Watson","club-day-horse-name":"Maple","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:01:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Sophie","club-day-last-name":"Reed","club-day-horse-name":"Dusty","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:03:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Chloe","club-day-last-name":"Morgan","club-day-horse-name":"Poppy","club-day-paid":true,"club-day-aeora-member":false}'::jsonb,
    '2026-06-15 10:05:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Ruby","club-day-last-name":"Foster","club-day-horse-name":"Banjo","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:07:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Isla","club-day-last-name":"Parker","club-day-horse-name":"Tilly","club-day-paid":false,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:09:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000106',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Ella","club-day-last-name":"Brooks","club-day-horse-name":"Jasper","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:11:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000107',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Harper","club-day-last-name":"King","club-day-horse-name":"Scout","club-day-paid":true,"club-day-aeora-member":false}'::jsonb,
    '2026-06-15 10:13:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000108',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Zoe","club-day-last-name":"Hughes","club-day-horse-name":"Misty","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:15:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000109',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Olivia","club-day-last-name":"Ryan","club-day-horse-name":"Pepper","club-day-paid":false,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:17:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000110',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-07-11","club-day-first-name":"Lucy","club-day-last-name":"Bell","club-day-horse-name":"Oakley","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 10:19:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Amelia","club-day-last-name":"Scott","club-day-horse-name":"Finn","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:01:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Maddison","club-day-last-name":"Ward","club-day-horse-name":"Sage","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:03:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Charlotte","club-day-last-name":"Evans","club-day-horse-name":"Charlie","club-day-paid":true,"club-day-aeora-member":false}'::jsonb,
    '2026-06-15 11:05:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000204',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Matilda","club-day-last-name":"Carter","club-day-horse-name":"Indie","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:07:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000205',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Georgia","club-day-last-name":"Murphy","club-day-horse-name":"Biscuit","club-day-paid":false,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:09:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000206',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Hannah","club-day-last-name":"Cooper","club-day-horse-name":"Ranger","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:11:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000207',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Sarah","club-day-last-name":"Bailey","club-day-horse-name":"Luna","club-day-paid":true,"club-day-aeora-member":false}'::jsonb,
    '2026-06-15 11:13:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000208',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Paige","club-day-last-name":"Morris","club-day-horse-name":"Diesel","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:15:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000209',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Erin","club-day-last-name":"James","club-day-horse-name":"Rosie","club-day-paid":false,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:17:00+10'
  ),
  (
    '00000000-0000-0000-0000-000000000210',
    'club_day_registration',
    '/club-day-registration.html',
    '{"club-date":"default-club-2026-10-10","club-day-first-name":"Tahlia","club-day-last-name":"Price","club-day-horse-name":"Storm","club-day-paid":true,"club-day-aeora-member":true}'::jsonb,
    '2026-06-15 11:19:00+10'
  )
on conflict (id) do update
set
  form_type = excluded.form_type,
  page_path = excluded.page_path,
  payload = excluded.payload,
  created_at = excluded.created_at;
