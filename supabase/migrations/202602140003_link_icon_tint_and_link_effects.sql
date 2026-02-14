alter table public.profiles
  add column if not exists link_effect text not null default 'none',
  add column if not exists link_icon_tint text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_link_effect_check'
  ) then
    alter table public.profiles
      add constraint profiles_link_effect_check
      check (link_effect in ('none', 'glow', 'outline', 'lift', 'pulse'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_link_icon_tint_check'
  ) then
    alter table public.profiles
      add constraint profiles_link_icon_tint_check
      check (
        link_icon_tint is null
        or link_icon_tint ~ '^#([0-9A-Fa-f]{6})$'
      );
  end if;
end $$;
