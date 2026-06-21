insert into public.events (id, type, date, title, location, description)
values
  ('default-club-2026-07-11', 'club', '2026-07-11', 'Winter Obstacle Muster', 'Nowra Showground', 'Green-horse confidence course, open practice lanes, and club barbecue from 3:30pm.'),
  ('default-clinic-2026-08-08', 'clinic', '2026-08-08', 'Groundwork to Ridden Obstacles Clinic', 'Berry Riding Club grounds', 'Morning groundwork groups followed by ridden problem-solving sessions.'),
  ('default-show-2026-09-12', 'show', '2026-09-12', 'Spring Timed Challenge', 'Milton Showground', 'Novice, intermediate, and open divisions across two timed patterns.'),
  ('default-club-2026-10-10', 'club', '2026-10-10', 'Trail Obstacles and Water Day', 'Private Shoalhaven venue', 'Water crossings, gate control, narrow bridge work, and steady pace practice.'),
  ('default-show-2026-11-14', 'show', '2026-11-14', 'SEORC Club Championship', 'Nowra Showground', 'End-of-season patterns, volunteer awards, and presentation afternoon.')
on conflict (id) do update set type = excluded.type, date = excluded.date, title = excluded.title, location = excluded.location, description = excluded.description;
