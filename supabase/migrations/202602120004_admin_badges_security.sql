create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "admin_users_self_select" on public.admin_users;
create policy "admin_users_self_select"
on public.admin_users
for select
using (auth.uid() = user_id);

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = coalesce(p_user_id, auth.uid())
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.prevent_badge_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.badges is distinct from old.badges then
    if current_user = 'postgres' or coalesce(auth.role(), '') = 'service_role' then
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

create or replace function public.admin_get_profile_for_badges(p_handle text)
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  updated_at timestamptz
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
    p.updated_at
  from public.profiles p
  where p.handle = lower(trim(both from p_handle))
  limit 1;
end;
$$;

revoke all on function public.admin_get_profile_for_badges(text) from public;
grant execute on function public.admin_get_profile_for_badges(text) to authenticated;

create or replace function public.admin_set_profile_badges(p_handle text, p_badges text[])
returns table (
  id uuid,
  handle text,
  display_name text,
  badges text[],
  is_public boolean,
  updated_at timestamptz
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
  set badges = normalized_badges
  where p.handle = lower(trim(both from p_handle))
  returning
    p.id,
    p.handle,
    p.display_name,
    p.badges,
    p.is_public,
    p.updated_at;
end;
$$;

revoke all on function public.admin_set_profile_badges(text, text[]) from public;
grant execute on function public.admin_set_profile_badges(text, text[]) to authenticated;
