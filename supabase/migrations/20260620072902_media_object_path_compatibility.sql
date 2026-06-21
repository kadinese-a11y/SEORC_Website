alter table public.media_assets add column if not exists object_path text;

update public.media_assets
set object_path = storage_path
where object_path is null and storage_path is not null;

update public.media_assets
set storage_path = object_path
where storage_path is null and object_path is not null;
