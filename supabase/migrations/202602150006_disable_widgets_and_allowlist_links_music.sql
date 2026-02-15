-- Disable widgets and lock link/music URLs to a basic trusted provider set.

-- Remove existing widget content and disable public writes.
delete from public.widgets;

revoke insert, update, delete on table public.widgets from anon;
revoke insert, update, delete on table public.widgets from authenticated;
grant all on table public.widgets to service_role;

drop policy if exists "widgets_owner_insert" on public.widgets;
drop policy if exists "widgets_owner_update" on public.widgets;
drop policy if exists "widgets_owner_delete" on public.widgets;

-- Remove links outside approved basic platforms.
delete from public.links
where url !~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|soundcloud\.com|snd\.sc|spotify\.com|discord\.gg|discord\.com)(/|$)';

alter table public.links
  drop constraint if exists links_url_check;

alter table public.links
  add constraint links_url_check
  check (
    url ~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|soundcloud\.com|snd\.sc|spotify\.com|discord\.gg|discord\.com)(/|$)'
  );

-- Remove music rows outside allowed providers/storage.
delete from public.music_tracks
where not (
  embed_url ~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|soundcloud\.com|snd\.sc|spotify\.com|discord\.gg|discord\.com|music\.apple\.com|itunes\.apple\.com|audio-ssl\.itunes\.apple\.com|catbox\.moe)(/|$)'
  or embed_url ~* '^https?://([a-z0-9-]+\.)*supabase\.co/storage/v1/object/public/profile-music/'
);

alter table public.music_tracks
  drop constraint if exists music_tracks_embed_url_check;

alter table public.music_tracks
  add constraint music_tracks_embed_url_check
  check (
    embed_url ~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|soundcloud\.com|snd\.sc|spotify\.com|discord\.gg|discord\.com|music\.apple\.com|itunes\.apple\.com|audio-ssl\.itunes\.apple\.com|catbox\.moe)(/|$)'
    or embed_url ~* '^https?://([a-z0-9-]+\.)*supabase\.co/storage/v1/object/public/profile-music/'
  );
