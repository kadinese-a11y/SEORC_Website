create sequence if not exists public.shop_order_reference_seq;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_reference text not null unique default ('SHOP-' || lpad(nextval('public.shop_order_reference_seq')::text, 5, '0')),
  item_id uuid references public.shop_items(id) on delete set null,
  item_name text not null,
  item_price numeric(10,2) not null check (item_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  total_amount numeric(10,2) not null check (total_amount >= 0),
  customer_name text not null,
  customer_email text not null,
  customer_address text not null,
  comments text not null default '',
  sent_out boolean not null default false,
  sent_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_orders enable row level security;

grant usage on sequence public.shop_order_reference_seq to authenticated;
grant select, update on public.shop_orders to authenticated;

drop policy if exists "Admins read shop orders" on public.shop_orders;
create policy "Admins read shop orders"
on public.shop_orders for select
to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Admins update shop orders" on public.shop_orders;
create policy "Admins update shop orders"
on public.shop_orders for update
to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));
