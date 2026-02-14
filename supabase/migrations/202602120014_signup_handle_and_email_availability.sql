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
        where p.handle = normalized_handle
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
  base_handle text;
  requested_handle text;
  final_handle text;
begin
  email_name := split_part(coalesce(new.email, ''), '@', 1);
  requested_handle := regexp_replace(
    lower(trim(both from coalesce(new.raw_user_meta_data ->> 'handle', ''))),
    '^@+',
    ''
  );

  if requested_handle ~ '^[a-z0-9_]{3,20}$' then
    final_handle := requested_handle;
  else
    base_handle := lower(regexp_replace(coalesce(email_name, 'user'), '[^a-z0-9_]', '', 'g'));

    if length(base_handle) < 3 then
      base_handle := 'user';
    end if;

    final_handle := left(base_handle, 14) || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    final_handle,
    coalesce(
      nullif(trim(both from new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(email_name, ''),
      'Creator'
    )
  )
  on conflict (id) do nothing;

  return new;
exception
  when unique_violation then
    raise exception 'That handle is already taken.'
      using errcode = '23505';
end;
$$;
