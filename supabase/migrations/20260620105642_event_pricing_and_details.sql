alter table public.events add column if not exists event_settings jsonb not null default '{}'::jsonb;
