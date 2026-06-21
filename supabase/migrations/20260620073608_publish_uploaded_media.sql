update storage.buckets set public = true where id = 'club-media';

update public.media_assets
set published_at = coalesce(published_at, now())
where coalesce(storage_path, object_path) is not null;
