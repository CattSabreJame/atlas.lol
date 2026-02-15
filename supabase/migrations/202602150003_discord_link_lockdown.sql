-- Ensure presence cannot be enabled without a linked Discord identity.
update public.profiles
set discord_presence_enabled = false
where discord_user_id is null
  and discord_presence_enabled = true;

alter table public.profiles
  drop constraint if exists profiles_discord_presence_requires_link_check;

alter table public.profiles
  add constraint profiles_discord_presence_requires_link_check
  check (
    not discord_presence_enabled
    or discord_user_id is not null
  );

create or replace function public.prevent_discord_user_id_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
  if new.discord_user_id is distinct from old.discord_user_id then
    if current_user <> 'postgres' and request_role <> 'service_role' then
      raise exception 'Discord identity can only be changed through secure OAuth linking.'
        using errcode = '42501';
    end if;
  end if;

  if new.discord_user_id is null then
    new.discord_presence_enabled := false;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_discord_user_id_guard on public.profiles;
create trigger profiles_discord_user_id_guard
before update on public.profiles
for each row
execute procedure public.prevent_discord_user_id_tampering();
