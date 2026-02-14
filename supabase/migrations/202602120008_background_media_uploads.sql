insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-backgrounds',
  'profile-backgrounds',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_backgrounds_public_read" on storage.objects;
create policy "profile_backgrounds_public_read"
on storage.objects
for select
using (bucket_id = 'profile-backgrounds');

drop policy if exists "profile_backgrounds_owner_insert" on storage.objects;
create policy "profile_backgrounds_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_backgrounds_owner_update" on storage.objects;
create policy "profile_backgrounds_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_backgrounds_owner_delete" on storage.objects;
create policy "profile_backgrounds_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
);