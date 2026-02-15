-- Normalize existing rows before adding stricter constraints.
update public.profiles
set display_name = nullif(left(trim(both from display_name), 50), '')
where display_name is not null;

update public.profiles
set bio = nullif(left(trim(both from bio), 240), '')
where bio is not null;

update public.profiles
set rich_text = left(coalesce(rich_text, ''), 3200);

update public.profiles
set entry_gate_text = case
  when char_length(trim(both from coalesce(entry_gate_text, ''))) = 0 then 'Click'
  else left(trim(both from entry_gate_text), 32)
end;

alter table public.profiles
  drop constraint if exists profiles_display_name_check;

alter table public.profiles
  add constraint profiles_display_name_check
  check (
    display_name is null
    or char_length(trim(display_name)) between 1 and 50
  );

alter table public.profiles
  drop constraint if exists profiles_bio_check;

alter table public.profiles
  add constraint profiles_bio_check
  check (
    bio is null
    or char_length(trim(bio)) <= 240
  );

alter table public.profiles
  drop constraint if exists profiles_rich_text_length_check;

alter table public.profiles
  add constraint profiles_rich_text_length_check
  check (char_length(coalesce(rich_text, '')) <= 3200);

alter table public.profiles
  drop constraint if exists profiles_entry_gate_text_check;

alter table public.profiles
  add constraint profiles_entry_gate_text_check
  check (char_length(trim(entry_gate_text)) between 1 and 32);

create or replace function public.enforce_handle_change_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
begin
  if new.handle is distinct from old.handle then
    new.handle := lower(trim(both from new.handle));

    if current_user <> 'postgres'
      and request_role <> 'service_role'
      and old.handle !~ '^pending_[a-f0-9]{12}$'
      and old.handle_changed_at > now() - interval '14 days'
    then
      raise exception 'Handle can be changed every 14 days.'
        using errcode = '42501';
    end if;

    new.handle_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_handle_change_guard on public.profiles;
create trigger profiles_handle_change_guard
before update on public.profiles
for each row
execute procedure public.enforce_handle_change_window();
