create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  bio text,
  avatar_url text,
  theme text not null default 'slate' check (theme in ('slate', 'emerald', 'amber', 'rose')),
  is_public boolean not null default true,
  avatar_float boolean not null default false,
  handle_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https?://'),
  description text,
  icon text,
  sort_order int not null,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists links_user_id_idx on public.links (user_id);
create index if not exists links_user_sort_idx on public.links (user_id, sort_order);

create table if not exists public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  profile_views int not null default 0,
  unique (user_id, day)
);

create index if not exists analytics_daily_user_day_idx on public.analytics_daily (user_id, day desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_name text;
  base_handle text;
begin
  email_name := split_part(coalesce(new.email, ''), '@', 1);
  base_handle := lower(regexp_replace(coalesce(email_name, 'user'), '[^a-z0-9_]', '', 'g'));

  if length(base_handle) < 3 then
    base_handle := 'user';
  end if;

  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    left(base_handle, 14) || '_' || substr(replace(new.id::text, '-', ''), 1, 5),
    coalesce(new.raw_user_meta_data ->> 'display_name', email_name)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.links enable row level security;
alter table public.analytics_daily enable row level security;

create policy "profiles_public_or_owner_select"
on public.profiles
for select
using (is_public = true or auth.uid() = id);

create policy "profiles_owner_insert"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_owner_update"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "links_public_or_owner_select"
on public.links
for select
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.is_public = true
  )
);

create policy "links_owner_insert"
on public.links
for insert
with check (auth.uid() = user_id);

create policy "links_owner_update"
on public.links
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "links_owner_delete"
on public.links
for delete
using (auth.uid() = user_id);

create policy "analytics_owner_select"
on public.analytics_daily
for select
using (auth.uid() = user_id);

create or replace function public.increment_profile_view(p_handle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select id into owner_id
  from public.profiles
  where handle = lower(p_handle)
    and is_public = true
  limit 1;

  if owner_id is null then
    return;
  end if;

  insert into public.analytics_daily (user_id, day, profile_views)
  values (owner_id, current_date, 1)
  on conflict (user_id, day)
  do update
    set profile_views = public.analytics_daily.profile_views + 1;
end;
$$;

create or replace function public.increment_link_click(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.links l
  set clicks = clicks + 1
  where l.id = p_link_id
    and exists (
      select 1
      from public.profiles p
      where p.id = l.user_id
        and p.is_public = true
    );
end;
$$;

revoke all on function public.increment_profile_view(text) from public;
revoke all on function public.increment_link_click(uuid) from public;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read"
on storage.objects
for select
using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
on storage.objects
for insert
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "avatars_owner_update"
on storage.objects
for update
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "avatars_owner_delete"
on storage.objects
for delete
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);
