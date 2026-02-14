alter table public.profiles
  drop constraint if exists profiles_premium_visuals_check;

-- Allow all authenticated owners to upload/update background media again.
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

-- Allow all authenticated owners to upload/update profile fonts again.
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

alter table public.profiles
  add column if not exists entry_gate_font_preset text not null default 'inter',
  add column if not exists entry_gate_custom_font_url text,
  add column if not exists entry_gate_custom_font_name text;

-- Drop legacy profile font constraint before remapping values to new presets.
alter table public.profiles
  drop constraint if exists profiles_profile_font_preset_check;

-- Map legacy profile font presets into the new catalog.
update public.profiles
set profile_font_preset = case profile_font_preset
  when 'atlas_sans' then 'inter'
  when 'geometric' then 'satoshi'
  when 'humanist' then 'manrope'
  when 'editorial_serif' then 'neue_montreal'
  when 'mono_signal' then 'ibm_plex_sans'
  else profile_font_preset
end
where profile_font_preset in ('atlas_sans', 'geometric', 'humanist', 'editorial_serif', 'mono_signal');

-- Guard against any unexpected historical preset values.
update public.profiles
set profile_font_preset = 'inter'
where profile_font_preset not in (
  'inter',
  'manrope',
  'general_sans',
  'satoshi',
  'neue_montreal',
  'ibm_plex_sans',
  'space_grotesk',
  'jetbrains_mono',
  'clash_display',
  'outfit',
  'plus_jakarta_sans',
  'custom'
);

update public.profiles
set entry_gate_font_preset = case entry_gate_font_preset
  when 'atlas_sans' then 'inter'
  when 'geometric' then 'satoshi'
  when 'humanist' then 'manrope'
  when 'editorial_serif' then 'neue_montreal'
  when 'mono_signal' then 'ibm_plex_sans'
  else entry_gate_font_preset
end
where entry_gate_font_preset in ('atlas_sans', 'geometric', 'humanist', 'editorial_serif', 'mono_signal');

update public.profiles
set entry_gate_font_preset = 'inter'
where entry_gate_font_preset not in (
  'inter',
  'manrope',
  'general_sans',
  'satoshi',
  'neue_montreal',
  'ibm_plex_sans',
  'space_grotesk',
  'jetbrains_mono',
  'clash_display',
  'outfit',
  'plus_jakarta_sans',
  'custom'
);

alter table public.profiles
  alter column profile_font_preset set default 'inter';

alter table public.profiles
  add constraint profiles_profile_font_preset_check
  check (
    profile_font_preset in (
      'inter',
      'manrope',
      'general_sans',
      'satoshi',
      'neue_montreal',
      'ibm_plex_sans',
      'space_grotesk',
      'jetbrains_mono',
      'clash_display',
      'outfit',
      'plus_jakarta_sans',
      'custom'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_name_effect_check;

alter table public.profiles
  add constraint profiles_name_effect_check
  check (
    name_effect in (
      'none',
      'gradient',
      'glow',
      'outline',
      'shimmer',
      'underline_accent',
      'shadow_depth',
      'micro_badge'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_font_preset_check;

alter table public.profiles
  add constraint profiles_entry_gate_font_preset_check
  check (
    entry_gate_font_preset in (
      'inter',
      'manrope',
      'general_sans',
      'satoshi',
      'neue_montreal',
      'ibm_plex_sans',
      'space_grotesk',
      'jetbrains_mono',
      'clash_display',
      'outfit',
      'plus_jakarta_sans',
      'custom'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_font_url_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_font_url_check
  check (
    entry_gate_custom_font_url is null
    or entry_gate_custom_font_url ~ '^https?://[^/]+/storage/v1/object/public/profile-fonts/'
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_font_name_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_font_name_check
  check (
    entry_gate_custom_font_name is null
    or char_length(trim(entry_gate_custom_font_name)) between 1 and 80
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_font_pair_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_font_pair_check
  check (
    (entry_gate_custom_font_url is null and entry_gate_custom_font_name is null)
    or (entry_gate_custom_font_url is not null and entry_gate_custom_font_name is not null)
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_font_owner_path_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_font_owner_path_check
  check (
    entry_gate_custom_font_url is null
    or position('/storage/v1/object/public/profile-fonts/' || id::text || '/' in entry_gate_custom_font_url) > 0
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_font_requires_custom_preset_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_font_requires_custom_preset_check
  check (
    entry_gate_font_preset = 'custom'
    or (entry_gate_custom_font_url is null and entry_gate_custom_font_name is null)
  );

alter table public.profiles
  drop constraint if exists profiles_entry_gate_custom_preset_requires_font_check;

alter table public.profiles
  add constraint profiles_entry_gate_custom_preset_requires_font_check
  check (
    entry_gate_font_preset <> 'custom'
    or (entry_gate_custom_font_url is not null and entry_gate_custom_font_name is not null)
  );
