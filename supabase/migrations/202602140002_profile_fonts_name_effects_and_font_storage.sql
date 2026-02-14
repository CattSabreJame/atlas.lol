alter table public.profiles
  add column if not exists profile_font_preset text not null default 'atlas_sans',
  add column if not exists profile_custom_font_url text,
  add column if not exists profile_custom_font_name text,
  add column if not exists name_effect text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_font_preset_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_font_preset_check
      check (profile_font_preset in ('atlas_sans', 'editorial_serif', 'mono_signal', 'humanist', 'geometric', 'custom'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_name_effect_check'
  ) then
    alter table public.profiles
      add constraint profiles_name_effect_check
      check (name_effect in ('none', 'gradient', 'glow', 'outline', 'shimmer'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_custom_font_url_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_custom_font_url_check
      check (
        profile_custom_font_url is null
        or profile_custom_font_url ~ '^https?://[^/]+/storage/v1/object/public/profile-fonts/'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_custom_font_name_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_custom_font_name_check
      check (
        profile_custom_font_name is null
        or char_length(trim(profile_custom_font_name)) between 1 and 80
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_custom_font_pair_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_custom_font_pair_check
      check (
        (profile_custom_font_url is null and profile_custom_font_name is null)
        or (profile_custom_font_url is not null and profile_custom_font_name is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_custom_font_owner_path_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_custom_font_owner_path_check
      check (
        profile_custom_font_url is null
        or position('/storage/v1/object/public/profile-fonts/' || id::text || '/' in profile_custom_font_url) > 0
      );
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-fonts',
  'profile-fonts',
  true,
  2097152,
  array[
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/font-sfnt',
    'application/x-font-ttf',
    'application/x-font-opentype'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_fonts_public_read" on storage.objects;
create policy "profile_fonts_public_read"
on storage.objects
for select
using (bucket_id = 'profile-fonts');

drop policy if exists "profile_fonts_owner_insert" on storage.objects;
create policy "profile_fonts_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_fonts_owner_update" on storage.objects;
create policy "profile_fonts_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_fonts_owner_delete" on storage.objects;
create policy "profile_fonts_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
);
