create sequence public.membership_number_seq start 1000;
create table public.members (
  id uuid primary key default gen_random_uuid(),
  membership_number text not null unique default ('SEORC-' || nextval('public.membership_number_seq')),
  email text not null unique,
  first_name text not null,
  last_name text not null,
  phone text,
  riding_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.membership_renewals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  financial_year text not null,
  amount numeric(10,2) not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, financial_year)
);
alter table public.members enable row level security;
alter table public.membership_renewals enable row level security;
create policy "Admins manage members" on public.members for all to authenticated using (exists (select 1 from public.admin_roles where user_id=(select auth.uid()))) with check (exists (select 1 from public.admin_roles where user_id=(select auth.uid())));
create policy "Admins manage membership renewals" on public.membership_renewals for all to authenticated using (exists (select 1 from public.admin_roles where user_id=(select auth.uid()))) with check (exists (select 1 from public.admin_roles where user_id=(select auth.uid())));

create or replace function private.sync_membership_registration()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare member_row public.members; fy text := public.au_financial_year(current_date); fee numeric := coalesce((select membership_fee from public.club_settings where setting_key='annual_membership_fee'),20);
begin
  if new.form_type <> 'club_membership' then return new; end if;
  insert into public.members (email,first_name,last_name,phone,riding_level)
  values (lower(new.payload->>'club-email'),new.payload->>'club-first-name',new.payload->>'club-last-name',new.payload->>'club-phone',new.payload->>'riding-level')
  on conflict (email) do update set first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,riding_level=excluded.riding_level,updated_at=now()
  returning * into member_row;
  insert into public.membership_renewals (member_id,registration_id,financial_year,amount)
  values (member_row.id,new.id,fy,fee) on conflict (member_id,financial_year) do nothing;
  update public.registrations set payload=jsonb_set(new.payload,'{membership-number}',to_jsonb(member_row.membership_number)) where id=new.id;
  return new;
end $$;
create trigger sync_membership_registration after insert on public.registrations for each row execute function private.sync_membership_registration();

create or replace function public.lookup_member_for_event(member_number text, member_email text)
returns table(membership_number text, first_name text, last_name text, phone text, email text, riding_level text)
language sql security definer set search_path=pg_catalog,public as $$
 select membership_number,first_name,last_name,phone,email,riding_level from public.members where membership_number=$1 and email=lower($2)
$$;
grant execute on function public.lookup_member_for_event(text,text) to anon, authenticated;
