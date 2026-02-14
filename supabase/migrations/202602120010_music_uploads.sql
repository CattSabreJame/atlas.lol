insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-music',
  'profile-music',
  true,
  31457280,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'audio/aac',
    'audio/x-aac',
    'audio/flac',
    'audio/x-flac'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_music_public_read" on storage.objects;
create policy "profile_music_public_read"
on storage.objects
for select
using (bucket_id = 'profile-music');

drop policy if exists "profile_music_owner_insert" on storage.objects;
create policy "profile_music_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-music'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_music_owner_update" on storage.objects;
create policy "profile_music_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-music'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-music'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_music_owner_delete" on storage.objects;
create policy "profile_music_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'profile-music'
  and auth.uid()::text = (storage.foldername(name))[1]
);
