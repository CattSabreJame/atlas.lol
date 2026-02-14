alter table public.profiles
  add column if not exists badges text[] not null default '{}',
  add column if not exists profile_animation text not null default 'subtle';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_profile_animation_check'
  ) then
    alter table public.profiles
      add constraint profiles_profile_animation_check
      check (profile_animation in ('none', 'subtle', 'lift', 'pulse'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_badges_check'
  ) then
    alter table public.profiles
      add constraint profiles_badges_check
      check (badges <@ array['owner','admin','staff','verified','pro','founder']::text[]);
  end if;
end $$;
