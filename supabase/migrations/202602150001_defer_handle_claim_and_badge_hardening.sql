create or replace function public.signup_availability(p_handle text, p_email text)
returns table (
  handle_available boolean,
  email_available boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_handle text;
  normalized_email text;
  handle_valid boolean;
begin
  normalized_handle := regexp_replace(
    lower(trim(both from coalesce(p_handle, ''))),
    '^@+',
    ''
  );
  normalized_email := lower(trim(both from coalesce(p_email, '')));

  handle_valid := normalized_handle ~ '^[a-z0-9_]{3,20}$';

  return query
  select
    handle_valid
      and not exists (
        select 1
        from public.profiles p
        left join auth.users u on u.id = p.id
        where p.handle = normalized_handle
          and coalesce(u.email_confirmed_at is not null, true)
      ) as handle_available,
    normalized_email <> ''
      and not exists (
        select 1
        from auth.users u
        where lower(coalesce(u.email, '')) = normalized_email
      ) as email_available;
end;
$$;

revoke all on function public.signup_availability(text, text) from public;
grant execute on function public.signup_availability(text, text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  email_name text;
  provisional_handle text;
begin
  email_name := split_part(coalesce(new.email, ''), '@', 1);
  provisional_handle := 'pending_' || substr(replace(new.id::text, '-', ''), 1, 12);

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    provisional_handle,
    coalesce(
      nullif(trim(both from new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(email_name, ''),
      'Creator'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Release legacy reserved handles from unverified users.
update public.profiles p
set handle = 'pending_' || substr(replace(p.id::text, '-', ''), 1, 12)
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is null
  and p.handle <> 'pending_' || substr(replace(p.id::text, '-', ''), 1, 12);

create or replace function public.prevent_badge_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
  if new.badges is distinct from old.badges then
    if current_user = 'postgres' or request_role = 'service_role' then
      return new;
    end if;

    if not public.is_admin(auth.uid()) then
      raise exception 'Only administrators can modify badges.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_badge_tampering on public.profiles;
create trigger profiles_prevent_badge_tampering
before update on public.profiles
for each row
execute procedure public.prevent_badge_tampering();
