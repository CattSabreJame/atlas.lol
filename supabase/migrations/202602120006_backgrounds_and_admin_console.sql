alter table public.profiles
  add column if not exists background_mode text not null default 'theme',
  add column if not exists background_value text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_background_mode_check'
  ) then
    alter table public.profiles
      add constraint profiles_background_mode_check
      check (background_mode in ('theme', 'gradient', 'image'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_background_value_check'
  ) then
    alter table public.profiles
      add constraint profiles_background_value_check
      check (
        (background_mode = 'theme' and background_value is null)
        or (background_mode = 'gradient' and background_value in ('aurora', 'sunset', 'midnight', 'ocean'))
        or (background_mode = 'image' and background_value ~* '^https?://')
      );
  end if;
end $$;

drop function if exists public.admin_get_profile_for_badges(text);
create or replace function public.admin_get_profile_for_badges(p_handle text)
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  comments_enabled boolean,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.handle,
    p.display_name,
    p.badges,
    p.is_public,
    p.comments_enabled,
    p.avatar_url,
    p.created_at,
    p.updated_at,
    exists(select 1 from public.admin_users au where au.user_id = p.id) as is_admin
  from public.profiles p
  where p.handle = lower(trim(both from p_handle))
  limit 1;
end;
$$;

revoke all on function public.admin_get_profile_for_badges(text) from public;
grant execute on function public.admin_get_profile_for_badges(text) to authenticated;

drop function if exists public.admin_update_profile(text, text[], boolean, boolean);
create or replace function public.admin_update_profile(
  p_handle text,
  p_badges text[],
  p_is_public boolean,
  p_comments_enabled boolean
)
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  comments_enabled boolean,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_badges text[];
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select coalesce(
    array_agg(distinct lower(trim(both from badge))),
    '{}'::text[]
  )
  into normalized_badges
  from unnest(coalesce(p_badges, '{}'::text[])) as badge
  where trim(both from badge) <> '';

  if not (
    normalized_badges <@ array['owner', 'admin', 'staff', 'verified', 'pro', 'founder']::text[]
  ) then
    raise exception 'Invalid badge selection.'
      using errcode = '22023';
  end if;

  return query
  update public.profiles p
  set
    badges = normalized_badges,
    is_public = p_is_public,
    comments_enabled = p_comments_enabled
  where p.handle = lower(trim(both from p_handle))
  returning
    p.id,
    p.handle,
    p.display_name,
    p.badges,
    p.is_public,
    p.comments_enabled,
    p.avatar_url,
    p.created_at,
    p.updated_at,
    exists(select 1 from public.admin_users au where au.user_id = p.id) as is_admin;
end;
$$;

revoke all on function public.admin_update_profile(text, text[], boolean, boolean) from public;
grant execute on function public.admin_update_profile(text, text[], boolean, boolean) to authenticated;

drop function if exists public.admin_set_profile_badges(text, text[]);
create or replace function public.admin_set_profile_badges(p_handle text, p_badges text[])
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  comments_enabled boolean,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_public boolean;
  current_comments boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select p.is_public, p.comments_enabled
  into current_public, current_comments
  from public.profiles p
  where p.handle = lower(trim(both from p_handle))
  limit 1;

  if current_public is null then
    return;
  end if;

  return query
  select * from public.admin_update_profile(
    p_handle,
    p_badges,
    current_public,
    current_comments
  );
end;
$$;

revoke all on function public.admin_set_profile_badges(text, text[]) from public;
grant execute on function public.admin_set_profile_badges(text, text[]) to authenticated;

drop function if exists public.admin_list_admin_users();
create or replace function public.admin_list_admin_users()
returns table (
  user_id uuid,
  handle text,
  display_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    au.user_id,
    p.handle,
    p.display_name,
    au.created_at
  from public.admin_users au
  left join public.profiles p
    on p.id = au.user_id
  order by au.created_at asc;
end;
$$;

revoke all on function public.admin_list_admin_users() from public;
grant execute on function public.admin_list_admin_users() to authenticated;

drop function if exists public.admin_set_user_admin(text, boolean);
create or replace function public.admin_set_user_admin(p_handle text, p_make_admin boolean)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  created_at timestamptz,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  self_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  self_id := auth.uid();

  select p.id
  into target_id
  from public.profiles p
  where p.handle = lower(trim(both from p_handle))
  limit 1;

  if target_id is null then
    raise exception 'Profile not found.'
      using errcode = '22023';
  end if;

  if p_make_admin then
    insert into public.admin_users (user_id)
    values (target_id)
    on conflict (user_id) do nothing;
  else
    if target_id = self_id then
      raise exception 'You cannot remove your own admin access.'
        using errcode = '22023';
    end if;

    delete from public.admin_users au
    where au.user_id = target_id;
  end if;

  return query
  select
    p.id as user_id,
    p.handle,
    p.display_name,
    au.created_at,
    au.user_id is not null as is_admin
  from public.profiles p
  left join public.admin_users au
    on au.user_id = p.id
  where p.id = target_id
  limit 1;
end;
$$;

revoke all on function public.admin_set_user_admin(text, boolean) from public;
grant execute on function public.admin_set_user_admin(text, boolean) to authenticated;
