alter table public.profiles
  add column if not exists link_style text not null default 'soft',
  add column if not exists avatar_shape text not null default 'circle',
  add column if not exists hero_align text not null default 'center';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_link_style_check'
  ) then
    alter table public.profiles
      add constraint profiles_link_style_check
      check (link_style in ('soft', 'glass', 'outline'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_shape_check'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_shape_check
      check (avatar_shape in ('circle', 'rounded', 'square'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_hero_align_check'
  ) then
    alter table public.profiles
      add constraint profiles_hero_align_check
      check (hero_align in ('center', 'left'));
  end if;
end $$;
