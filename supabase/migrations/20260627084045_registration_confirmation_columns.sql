alter table public.registrations
  add column if not exists confirmation_token uuid,
  add column if not exists confirmation_sent_at timestamptz;

create index if not exists registrations_confirmation_token_idx
  on public.registrations (confirmation_token)
  where confirmation_token is not null;

notify pgrst, 'reload schema';
