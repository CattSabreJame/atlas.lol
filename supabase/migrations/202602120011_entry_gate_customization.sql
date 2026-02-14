alter table public.profiles
  add column if not exists entry_gate_enabled boolean not null default false,
  add column if not exists entry_gate_text text not null default 'Click',
  add column if not exists entry_gate_text_color text not null default '#F2F1EE',
  add column if not exists entry_gate_background_color text not null default '#080809',
  add column if not exists entry_gate_font_size text not null default 'md',
  add column if not exists entry_gate_font_weight text not null default 'semibold';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_entry_gate_text_color_check'
  ) then
    alter table public.profiles
      add constraint profiles_entry_gate_text_color_check
      check (entry_gate_text_color ~* '^#([0-9a-f]{6})$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_entry_gate_background_color_check'
  ) then
    alter table public.profiles
      add constraint profiles_entry_gate_background_color_check
      check (entry_gate_background_color ~* '^#([0-9a-f]{6})$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_entry_gate_font_size_check'
  ) then
    alter table public.profiles
      add constraint profiles_entry_gate_font_size_check
      check (entry_gate_font_size in ('sm', 'md', 'lg'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_entry_gate_font_weight_check'
  ) then
    alter table public.profiles
      add constraint profiles_entry_gate_font_weight_check
      check (entry_gate_font_weight in ('medium', 'semibold', 'bold'));
  end if;
end $$;
