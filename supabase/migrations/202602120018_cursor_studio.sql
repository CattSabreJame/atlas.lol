create table if not exists public.user_cursors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  file_url text not null,
  hotspot_x int not null default 0,
  hotspot_y int not null default 0,
  created_at timestamptz not null default now(),
  constraint user_cursors_name_check check (char_length(trim(name)) between 1 and 60),
  constraint user_cursors_file_url_check check (
    file_url ~ '^https?://[^/]+/storage/v1/object/public/cursors/'
  ),
  constraint user_cursors_hotspot_x_check check (hotspot_x between 0 and 127),
  constraint user_cursors_hotspot_y_check check (hotspot_y between 0 and 127)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_cursors_owner_path_check'
  ) then
    alter table public.user_cursors
      add constraint user_cursors_owner_path_check
      check (
        position('/storage/v1/object/public/cursors/' || user_id::text || '/' in file_url) > 0
      );
  end if;
end $$;

create index if not exists user_cursors_user_created_idx
on public.user_cursors (user_id, created_at desc);

alter table public.user_cursors enable row level security;

drop policy if exists "user_cursors_owner_select" on public.user_cursors;
create policy "user_cursors_owner_select"
on public.user_cursors
for select
using (auth.uid() = user_id);

drop policy if exists "user_cursors_owner_insert" on public.user_cursors;
create policy "user_cursors_owner_insert"
on public.user_cursors
for insert
with check (auth.uid() = user_id);

drop policy if exists "user_cursors_owner_update" on public.user_cursors;
create policy "user_cursors_owner_update"
on public.user_cursors
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_cursors_owner_delete" on public.user_cursors;
create policy "user_cursors_owner_delete"
on public.user_cursors
for delete
using (auth.uid() = user_id);

create or replace function public.ensure_user_cursor_asset_exists()
returns trigger
language plpgsql
as $$
declare
  marker constant text := '/storage/v1/object/public/cursors/';
  marker_pos int;
  object_path text;
begin
  marker_pos := strpos(new.file_url, marker);
  if marker_pos = 0 then
    raise exception 'file_url must reference the public cursors bucket path';
  end if;

  object_path := substring(new.file_url from marker_pos + char_length(marker));
  object_path := split_part(object_path, '?', 1);
  object_path := split_part(object_path, '#', 1);

  if object_path is null or object_path = '' then
    raise exception 'file_url object path is missing';
  end if;

  if position(new.user_id::text || '/' in object_path) <> 1 then
    raise exception 'cursor object path must start with user folder';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id = 'cursors'
      and name = object_path
  ) then
    raise exception 'cursor object does not exist in storage';
  end if;

  return new;
end;
$$;

drop trigger if exists user_cursors_storage_guard on public.user_cursors;
create trigger user_cursors_storage_guard
before insert or update of file_url, user_id on public.user_cursors
for each row
execute procedure public.ensure_user_cursor_asset_exists();

alter table public.profiles
  add column if not exists cursor_enabled boolean not null default false,
  add column if not exists cursor_trails_enabled boolean not null default false,
  add column if not exists cursor_mode text not null default 'glow',
  add column if not exists cursor_trail_mode text not null default 'velocity',
  add column if not exists cursor_apply_in_app boolean not null default false,
  add column if not exists active_cursor_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cursor_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_cursor_mode_check
      check (cursor_mode in ('glow', 'crosshair', 'morph'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cursor_trail_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_cursor_trail_mode_check
      check (cursor_trail_mode in ('velocity', 'dots', 'pixel'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_active_cursor_fk'
  ) then
    alter table public.profiles
      add constraint profiles_active_cursor_fk
      foreign key (active_cursor_id)
      references public.user_cursors (id)
      on delete set null;
  end if;
end $$;

create or replace function public.ensure_profile_cursor_ownership()
returns trigger
language plpgsql
as $$
declare
  cursor_owner_id uuid;
begin
  if new.active_cursor_id is null then
    return new;
  end if;

  select user_id into cursor_owner_id
  from public.user_cursors
  where id = new.active_cursor_id
  limit 1;

  if cursor_owner_id is null or cursor_owner_id <> new.id then
    raise exception 'active_cursor_id must belong to the profile owner';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_cursor_ownership_guard on public.profiles;
create trigger profiles_cursor_ownership_guard
before insert or update of active_cursor_id on public.profiles
for each row
execute procedure public.ensure_profile_cursor_ownership();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cursors',
  'cursors',
  true,
  204800,
  array['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cursors_public_read" on storage.objects;
create policy "cursors_public_read"
on storage.objects
for select
using (bucket_id = 'cursors');

drop policy if exists "cursors_owner_insert" on storage.objects;
create policy "cursors_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "cursors_owner_update" on storage.objects;
create policy "cursors_owner_update"
on storage.objects
for update
using (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "cursors_owner_delete" on storage.objects;
create policy "cursors_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
);
