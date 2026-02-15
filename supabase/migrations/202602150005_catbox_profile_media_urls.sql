-- Restrict profile media URLs to Catbox.
-- This blocks arbitrary third-party CDN hosts for avatar/background media fields.

-- Clean up rows that would violate the new constraints.
update public.profiles
set avatar_url = null
where avatar_url is not null
  and avatar_url !~* '^https://([a-z0-9-]+\.)*catbox\.moe(/|$)';

update public.profiles
set
  background_mode = 'theme',
  background_value = null
where background_mode = 'image'
  and (
    background_value is null
    or background_value !~* '^https://([a-z0-9-]+\.)*catbox\.moe(/|$)'
  );

alter table public.profiles
  drop constraint if exists profiles_avatar_url_catbox_check;

alter table public.profiles
  add constraint profiles_avatar_url_catbox_check
  check (
    avatar_url is null
    or avatar_url ~* '^https://([a-z0-9-]+\.)*catbox\.moe(/|$)'
  );

alter table public.profiles
  drop constraint if exists profiles_background_value_check;

alter table public.profiles
  add constraint profiles_background_value_check
  check (
    (background_mode = 'theme' and background_value is null)
    or (background_mode = 'gradient' and background_value in ('aurora', 'sunset', 'midnight', 'ocean'))
    or (background_mode = 'image' and background_value ~* '^https://([a-z0-9-]+\.)*catbox\.moe(/|$)')
  );
