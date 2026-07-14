create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  order_url text,
  stock_status text not null default 'available' check (stock_status in ('available', 'preorder', 'sold_out')),
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;

grant select on public.shop_items to anon, authenticated;
grant insert, update, delete on public.shop_items to authenticated;

drop policy if exists "Public can view published shop items" on public.shop_items;
create policy "Public can view published shop items"
on public.shop_items for select
to anon, authenticated
using (published = true);

drop policy if exists "Admins can view all shop items" on public.shop_items;
create policy "Admins can view all shop items"
on public.shop_items for select
to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

drop policy if exists "Admins manage shop items" on public.shop_items;
create policy "Admins manage shop items"
on public.shop_items for all
to authenticated
using (exists (select 1 from public.admin_roles where user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_roles where user_id = (select auth.uid())));

insert into public.shop_items (name, description, price, image_url, stock_status, published, sort_order)
select 'Club Jacket', 'Lightweight softshell club jacket with SEORC back logo. Water repellent and wind resistant finish, side zip pockets, fleeced chin guard, and shaped back tail. Sizes 8 to 22.', 80.00, 'assets/shop-club-jacket.png', 'preorder', true, 10
where not exists (select 1 from public.shop_items where name = 'Club Jacket');

insert into public.shop_items (name, description, price, image_url, stock_status, published, sort_order)
select 'Club Vest', 'Outdoor club vest with SEORC logo. 100% polyester mechanic stretch fabric bonded with microfleece, 3 layer softshell fabric, waterproof rating 10,000mm, breathable rating 800mm. Sizes 2XS to 5XL.', 75.00, 'assets/shop-club-vest.png', 'preorder', true, 20
where not exists (select 1 from public.shop_items where name = 'Club Vest');

insert into public.shop_items (name, description, price, image_url, stock_status, published, sort_order)
select 'Club Shirt', 'Lightweight 98% yarn-treated polyester Cool Dry shirt with 2% spandex, classic collar, clean pocket-free style, and SEORC logo artwork. Sizes 8 to 26.', 65.00, 'assets/shop-club-shirt.png', 'preorder', true, 30
where not exists (select 1 from public.shop_items where name = 'Club Shirt');

insert into public.shop_items (name, description, price, image_url, stock_status, published, sort_order)
select 'Obstacle Training Voucher', 'A club voucher that can be used toward a SEORC training day.', 40.00, 'assets/training-platform-rider.jpg', 'available', true, 40
where not exists (select 1 from public.shop_items where name = 'Obstacle Training Voucher');
