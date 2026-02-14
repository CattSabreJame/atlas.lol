alter table public.profiles
  add column if not exists background_effect text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_profile_effect_check;

alter table public.profiles
  add constraint profiles_profile_effect_check
  check (profile_effect in ('none', 'glow', 'grain', 'scanlines', 'halo', 'velvet', 'frost'));

alter table public.profiles
  drop constraint if exists profiles_background_effect_check;

alter table public.profiles
  add constraint profiles_background_effect_check
  check (background_effect in ('none', 'vignette', 'noise', 'mesh', 'spotlight', 'snow', 'rain', 'embers'));
