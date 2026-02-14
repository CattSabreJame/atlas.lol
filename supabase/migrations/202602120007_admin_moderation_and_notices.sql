alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_banned_reason_check'
  ) then
    alter table public.profiles
      add constraint profiles_banned_reason_check
      check (
        (is_banned and nullif(trim(both from coalesce(banned_reason, '')), '') is not null)
        or (not is_banned and banned_reason is null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_banned_public_check'
  ) then
    alter table public.profiles
      add constraint profiles_banned_public_check
      check (not is_banned or is_public = false);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_banned_comments_check'
  ) then
    alter table public.profiles
      add constraint profiles_banned_comments_check
      check (not is_banned or comments_enabled = false);
  end if;
end $$;

create table if not exists public.admin_action_notices (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references auth.users (id) on delete cascade,
  actor_user_id uuid not null references auth.users (id) on delete restrict,
  action_type text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_action_notices_action_type_check check (
    action_type in (
      'ban',
      'unban',
      'remove_avatar',
      'remove_background',
      'force_private',
      'force_public',
      'disable_comments',
      'enable_comments'
    )
  ),
  constraint admin_action_notices_reason_check check (
    char_length(trim(both from reason)) between 3 and 500
  )
);

create index if not exists admin_action_notices_target_created_idx
  on public.admin_action_notices (target_user_id, created_at desc);

alter table public.admin_action_notices enable row level security;

drop policy if exists "admin_action_notices_target_select" on public.admin_action_notices;
create policy "admin_action_notices_target_select"
on public.admin_action_notices
for select
using (auth.uid() = target_user_id);

drop function if exists public.admin_set_profile_badges(text, text[]);
drop function if exists public.admin_update_profile(text, text[], boolean, boolean);
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
  background_mode text,
  background_value text,
  is_banned boolean,
  banned_reason text,
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
    p.background_mode,
    p.background_value,
    p.is_banned,
    p.banned_reason,
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
  background_mode text,
  background_value text,
  is_banned boolean,
  banned_reason text,
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
    is_public = case when p.is_banned then false else p_is_public end,
    comments_enabled = case when p.is_banned then false else p_comments_enabled end
  where p.handle = lower(trim(both from p_handle))
  returning
    p.id,
    p.handle,
    p.display_name,
    p.badges,
    p.is_public,
    p.comments_enabled,
    p.avatar_url,
    p.background_mode,
    p.background_value,
    p.is_banned,
    p.banned_reason,
    p.created_at,
    p.updated_at,
    exists(select 1 from public.admin_users au where au.user_id = p.id) as is_admin;
end;
$$;

revoke all on function public.admin_update_profile(text, text[], boolean, boolean) from public;
grant execute on function public.admin_update_profile(text, text[], boolean, boolean) to authenticated;

create or replace function public.admin_set_profile_badges(p_handle text, p_badges text[])
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  comments_enabled boolean,
  avatar_url text,
  background_mode text,
  background_value text,
  is_banned boolean,
  banned_reason text,
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

drop function if exists public.admin_insert_action_notice(uuid, text, text, jsonb);
create or replace function public.admin_insert_action_notice(
  p_target_user_id uuid,
  p_action_type text,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_reason text;
begin
  normalized_reason := trim(both from coalesce(p_reason, ''));

  if char_length(normalized_reason) < 3 then
    raise exception 'Reason must be at least 3 characters.'
      using errcode = '22023';
  end if;

  if p_action_type not in (
    'ban',
    'unban',
    'remove_avatar',
    'remove_background',
    'force_private',
    'force_public',
    'disable_comments',
    'enable_comments'
  ) then
    raise exception 'Invalid moderation action.'
      using errcode = '22023';
  end if;

  insert into public.admin_action_notices (
    target_user_id,
    actor_user_id,
    action_type,
    reason,
    metadata
  )
  values (
    p_target_user_id,
    auth.uid(),
    p_action_type,
    normalized_reason,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.admin_insert_action_notice(uuid, text, text, jsonb) from public;

drop function if exists public.admin_apply_profile_action(text, text, text);
create or replace function public.admin_apply_profile_action(
  p_handle text,
  p_action text,
  p_reason text
)
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  comments_enabled boolean,
  avatar_url text,
  background_mode text,
  background_value text,
  is_banned boolean,
  banned_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  is_admin boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_handle text;
  normalized_action text;
  target_id uuid;
  self_id uuid;
  target_is_banned boolean;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  normalized_handle := lower(trim(both from p_handle));
  normalized_action := lower(trim(both from coalesce(p_action, '')));
  self_id := auth.uid();

  if char_length(trim(both from coalesce(p_reason, ''))) < 3 then
    raise exception 'Reason must be at least 3 characters.'
      using errcode = '22023';
  end if;

  if normalized_action not in (
    'ban',
    'unban',
    'remove_avatar',
    'remove_background',
    'force_private',
    'force_public',
    'disable_comments',
    'enable_comments'
  ) then
    raise exception 'Invalid moderation action.'
      using errcode = '22023';
  end if;

  select p.id, p.is_banned
  into target_id, target_is_banned
  from public.profiles p
  where p.handle = normalized_handle
  limit 1;

  if target_id is null then
    raise exception 'Profile not found.'
      using errcode = '22023';
  end if;

  if normalized_action = 'ban' then
    if target_id = self_id then
      raise exception 'You cannot ban your own account.'
        using errcode = '22023';
    end if;

    update public.profiles p
    set
      is_banned = true,
      banned_reason = trim(both from p_reason),
      is_public = false,
      comments_enabled = false
    where p.id = target_id;
  elsif normalized_action = 'unban' then
    update public.profiles p
    set
      is_banned = false,
      banned_reason = null
    where p.id = target_id;
  elsif normalized_action = 'remove_avatar' then
    update public.profiles p
    set avatar_url = null
    where p.id = target_id;
  elsif normalized_action = 'remove_background' then
    update public.profiles p
    set
      background_mode = 'theme',
      background_value = null
    where p.id = target_id;
  elsif normalized_action = 'force_private' then
    update public.profiles p
    set is_public = false
    where p.id = target_id;
  elsif normalized_action = 'force_public' then
    if target_is_banned then
      raise exception 'Cannot make a banned profile public.'
        using errcode = '22023';
    end if;

    update public.profiles p
    set is_public = true
    where p.id = target_id;
  elsif normalized_action = 'disable_comments' then
    update public.profiles p
    set comments_enabled = false
    where p.id = target_id;
  elsif normalized_action = 'enable_comments' then
    if target_is_banned then
      raise exception 'Cannot enable comments while a profile is banned.'
        using errcode = '22023';
    end if;

    update public.profiles p
    set comments_enabled = true
    where p.id = target_id;
  end if;

  perform public.admin_insert_action_notice(
    target_id,
    normalized_action,
    p_reason,
    jsonb_build_object('handle', normalized_handle)
  );

  return query
  select
    p.id,
    p.handle,
    p.display_name,
    p.badges,
    p.is_public,
    p.comments_enabled,
    p.avatar_url,
    p.background_mode,
    p.background_value,
    p.is_banned,
    p.banned_reason,
    p.created_at,
    p.updated_at,
    exists(select 1 from public.admin_users au where au.user_id = p.id) as is_admin
  from public.profiles p
  where p.id = target_id
  limit 1;
end;
$$;

revoke all on function public.admin_apply_profile_action(text, text, text) from public;
grant execute on function public.admin_apply_profile_action(text, text, text) to authenticated;