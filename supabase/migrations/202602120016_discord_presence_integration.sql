alter table public.profiles
  add column if not exists discord_presence_enabled boolean not null default false,
  add column if not exists discord_user_id text,
  add column if not exists discord_show_activity boolean not null default true;

update public.profiles
set discord_user_id = null
where discord_user_id is not null
  and discord_user_id !~ '^[0-9]{17,20}$';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_discord_user_id_check'
  ) then
    alter table public.profiles
      add constraint profiles_discord_user_id_check
      check (discord_user_id is null or discord_user_id ~ '^[0-9]{17,20}$');
  end if;
end $$;
