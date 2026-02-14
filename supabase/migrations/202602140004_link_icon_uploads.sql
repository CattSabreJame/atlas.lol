insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'link-icons',
  'link-icons',
  true,
  524288,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "link_icons_public_read" on storage.objects;
create policy "link_icons_public_read"
on storage.objects
for select
using (bucket_id = 'link-icons');

drop policy if exists "link_icons_owner_insert" on storage.objects;
create policy "link_icons_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'link-icons'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "link_icons_owner_update" on storage.objects;
create policy "link_icons_owner_update"
on storage.objects
for update
using (
  bucket_id = 'link-icons'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'link-icons'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "link_icons_owner_delete" on storage.objects;
create policy "link_icons_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'link-icons'
  and auth.uid()::text = (storage.foldername(name))[1]
);
