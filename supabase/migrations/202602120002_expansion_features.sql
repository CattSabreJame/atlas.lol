alter table public.profiles
  add column if not exists layout text not null default 'stack',
  add column if not exists template text not null default 'signature',
  add column if not exists color_accent text,
  add column if not exists rich_text text not null default '',
  add column if not exists comments_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_layout_check'
  ) then
    alter table public.profiles
      add constraint profiles_layout_check
      check (layout in ('stack', 'grid', 'split'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_template_check'
  ) then
    alter table public.profiles
      add constraint profiles_template_check
      check (template in ('signature', 'mono', 'spotlight', 'editorial'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_color_accent_check'
  ) then
    alter table public.profiles
      add constraint profiles_color_accent_check
      check (
        color_accent is null
        or color_accent ~ '^#([0-9a-fA-F]{6})$'
      );
  end if;
end $$;

create table if not exists public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  embed_url text not null check (embed_url ~* '^https?://'),
  sort_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists music_tracks_user_sort_idx on public.music_tracks (user_id, sort_order);

create table if not exists public.widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  widget_type text not null check (widget_type in ('clock', 'stat', 'quote', 'embed')),
  title text not null,
  value text,
  source_url text,
  sort_order int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists widgets_user_sort_idx on public.widgets (user_id, sort_order);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null,
  author_website text,
  body text not null,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists comments_user_created_idx on public.comments (user_id, created_at desc);

alter table public.music_tracks enable row level security;
alter table public.widgets enable row level security;
alter table public.comments enable row level security;

drop policy if exists "music_public_or_owner_select" on public.music_tracks;
create policy "music_public_or_owner_select"
on public.music_tracks
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

drop policy if exists "music_owner_insert" on public.music_tracks;
create policy "music_owner_insert"
on public.music_tracks
for insert
with check (auth.uid() = user_id);

drop policy if exists "music_owner_update" on public.music_tracks;
create policy "music_owner_update"
on public.music_tracks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "music_owner_delete" on public.music_tracks;
create policy "music_owner_delete"
on public.music_tracks
for delete
using (auth.uid() = user_id);

drop policy if exists "widgets_public_or_owner_select" on public.widgets;
create policy "widgets_public_or_owner_select"
on public.widgets
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

drop policy if exists "widgets_owner_insert" on public.widgets;
create policy "widgets_owner_insert"
on public.widgets
for insert
with check (auth.uid() = user_id);

drop policy if exists "widgets_owner_update" on public.widgets;
create policy "widgets_owner_update"
on public.widgets
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "widgets_owner_delete" on public.widgets;
create policy "widgets_owner_delete"
on public.widgets
for delete
using (auth.uid() = user_id);

drop policy if exists "comments_public_or_owner_select" on public.comments;
create policy "comments_public_or_owner_select"
on public.comments
for select
using (
  auth.uid() = user_id
  or (
    status = 'published'
    and exists (
      select 1
      from public.profiles p
      where p.id = user_id
        and p.is_public = true
    )
  )
);

drop policy if exists "comments_public_insert" on public.comments;
create policy "comments_public_insert"
on public.comments
for insert
with check (
  status = 'published'
  and exists (
    select 1
    from public.profiles p
    where p.id = user_id
      and p.is_public = true
      and p.comments_enabled = true
  )
);

drop policy if exists "comments_owner_update" on public.comments;
create policy "comments_owner_update"
on public.comments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "comments_owner_delete" on public.comments;
create policy "comments_owner_delete"
on public.comments
for delete
using (auth.uid() = user_id);
