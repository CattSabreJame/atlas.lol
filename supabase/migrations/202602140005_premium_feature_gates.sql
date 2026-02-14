update public.profiles p
set
  profile_effect = 'none',
  background_mode = case when p.background_mode = 'image' then 'theme' else p.background_mode end,
  background_value = case when p.background_mode = 'image' then null else p.background_value end,
  background_effect = 'none',
  link_effect = 'none',
  entry_gate_enabled = false,
  profile_font_preset = case when p.profile_font_preset = 'custom' then 'atlas_sans' else p.profile_font_preset end,
  profile_custom_font_url = null,
  profile_custom_font_name = null,
  name_effect = 'none',
  cursor_enabled = false,
  cursor_trails_enabled = false,
  active_cursor_id = null
where not ('pro' = any(coalesce(p.badges, '{}'::text[])))
  and (
    p.profile_effect <> 'none'
    or p.background_mode = 'image'
    or p.background_effect <> 'none'
    or p.link_effect <> 'none'
    or p.entry_gate_enabled
    or p.profile_font_preset = 'custom'
    or p.profile_custom_font_url is not null
    or p.profile_custom_font_name is not null
    or p.name_effect <> 'none'
    or p.cursor_enabled
    or p.cursor_trails_enabled
    or p.active_cursor_id is not null
  );

alter table public.profiles
  drop constraint if exists profiles_premium_visuals_check;

alter table public.profiles
  add constraint profiles_premium_visuals_check
  check (
    'pro' = any(coalesce(badges, '{}'::text[]))
    or (
      profile_effect = 'none'
      and background_mode <> 'image'
      and background_effect = 'none'
      and link_effect = 'none'
      and entry_gate_enabled = false
      and profile_font_preset <> 'custom'
      and profile_custom_font_url is null
      and profile_custom_font_name is null
      and name_effect = 'none'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_premium_cursor_check;

alter table public.profiles
  add constraint profiles_premium_cursor_check
  check (
    'pro' = any(coalesce(badges, '{}'::text[]))
    or (
      cursor_enabled = false
      and cursor_trails_enabled = false
      and active_cursor_id is null
    )
  );

drop policy if exists "user_cursors_owner_insert" on public.user_cursors;
create policy "user_cursors_owner_insert"
on public.user_cursors
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "user_cursors_owner_update" on public.user_cursors;
create policy "user_cursors_owner_update"
on public.user_cursors
for update
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "cursors_owner_insert" on storage.objects;
create policy "cursors_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "cursors_owner_update" on storage.objects;
create policy "cursors_owner_update"
on storage.objects
for update
using (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
)
with check (
  bucket_id = 'cursors'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "profile_backgrounds_owner_insert" on storage.objects;
create policy "profile_backgrounds_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "profile_backgrounds_owner_update" on storage.objects;
create policy "profile_backgrounds_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
)
with check (
  bucket_id = 'profile-backgrounds'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "profile_fonts_owner_insert" on storage.objects;
create policy "profile_fonts_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);

drop policy if exists "profile_fonts_owner_update" on storage.objects;
create policy "profile_fonts_owner_update"
on storage.objects
for update
using (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
)
with check (
  bucket_id = 'profile-fonts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and 'pro' = any(coalesce(p.badges, '{}'::text[]))
  )
);
