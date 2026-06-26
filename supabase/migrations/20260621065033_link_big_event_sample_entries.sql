-- The Big Show was recreated in the admin UI, which gave it a new event ID.
-- Relink only the deterministic sample registrations added for this event.
update public.registrations
set payload = jsonb_set(payload, '{show-date}', to_jsonb('admin-1781936246594'::text))
where id between '10000000-0000-0000-0000-000000000001'::uuid
  and '10000000-0000-0000-0000-000000000023'::uuid
  and form_type = 'show_registration'
  and payload->>'show-date' = 'admin-1781953278805';
