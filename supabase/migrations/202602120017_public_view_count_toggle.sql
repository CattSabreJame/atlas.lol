alter table public.profiles
  add column if not exists show_view_count boolean not null default true;
