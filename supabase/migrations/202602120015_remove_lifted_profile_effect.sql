update public.profiles
set profile_effect = 'halo'
where profile_effect = 'lifted';

alter table public.profiles
  drop constraint if exists profiles_profile_effect_check;

alter table public.profiles
  add constraint profiles_profile_effect_check
  check (profile_effect in ('none', 'glow', 'grain', 'scanlines', 'halo', 'velvet', 'frost'));
