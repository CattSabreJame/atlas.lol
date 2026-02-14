alter table public.profiles
  add column if not exists entry_gate_background_opacity smallint not null default 90,
  add column if not exists entry_gate_background_blur_px smallint not null default 12;

update public.profiles
set
  entry_gate_background_opacity = greatest(35, least(coalesce(entry_gate_background_opacity, 90), 100)),
  entry_gate_background_blur_px = greatest(0, least(coalesce(entry_gate_background_blur_px, 12), 32));

alter table public.profiles
  drop constraint if exists profiles_entry_gate_background_opacity_check;

alter table public.profiles
  add constraint profiles_entry_gate_background_opacity_check
  check (entry_gate_background_opacity between 35 and 100);

alter table public.profiles
  drop constraint if exists profiles_entry_gate_background_blur_px_check;

alter table public.profiles
  add constraint profiles_entry_gate_background_blur_px_check
  check (entry_gate_background_blur_px between 0 and 32);
