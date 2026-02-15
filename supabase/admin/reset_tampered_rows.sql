-- Admin-only remediation script for previously tampered profile rows.
-- Run manually in Supabase SQL Editor as the `postgres` role.
-- This is intentionally NOT a migration (one-off cleanup).

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'This remediation script must be run as postgres. Current role: %', current_user;
  end if;
end $$;

begin;

-- 1) Normalize free-text fields to current product limits.
update public.profiles
set display_name = nullif(left(trim(both from display_name), 50), '')
where display_name is not null
  and (display_name <> left(trim(both from display_name), 50) or trim(both from display_name) = '');

update public.profiles
set bio = nullif(left(trim(both from bio), 240), '')
where bio is not null
  and (bio <> left(trim(both from bio), 240) or trim(both from bio) = '');

update public.profiles
set rich_text = left(coalesce(rich_text, ''), 3200)
where char_length(coalesce(rich_text, '')) > 3200;

update public.profiles
set entry_gate_text = case
  when char_length(trim(both from coalesce(entry_gate_text, ''))) = 0 then 'Click'
  else left(trim(both from entry_gate_text), 32)
end
where entry_gate_text is null
  or char_length(trim(both from coalesce(entry_gate_text, ''))) = 0
  or char_length(trim(both from coalesce(entry_gate_text, ''))) > 32;

-- 2) Remove unknown badges, then enforce platform-only elevated badges.
update public.profiles p
set badges = coalesce(
  (
    select array_agg(distinct b order by b)
    from unnest(coalesce(p.badges, '{}'::text[])) as b
    where b = any(array['owner', 'admin', 'staff', 'verified', 'pro', 'founder']::text[])
  ),
  '{}'::text[]
);

-- Remove owner/admin/staff from users who are not in admin_users.
update public.profiles p
set badges = coalesce(
  (
    select array_agg(distinct b order by b)
    from unnest(coalesce(p.badges, '{}'::text[])) as b
    where b <> all(array['owner', 'admin', 'staff']::text[])
  ),
  '{}'::text[]
)
where coalesce(p.badges, '{}'::text[]) && array['owner', 'admin', 'staff']::text[]
  and not exists (
    select 1
    from public.admin_users au
    where au.user_id = p.id
  );

-- 3) Sync verified badge with email verification state.
update public.profiles p
set badges = array_remove(coalesce(p.badges, '{}'::text[]), 'verified')
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is null
  and 'verified' = any(coalesce(p.badges, '{}'::text[]));

update public.profiles p
set badges = coalesce(
  (
    select array_agg(distinct b order by b)
    from unnest(coalesce(p.badges, '{}'::text[]) || array['verified']::text[]) as b
  ),
  array['verified']::text[]
)
from auth.users u
where u.id = p.id
  and u.email_confirmed_at is not null
  and not ('verified' = any(coalesce(p.badges, '{}'::text[])));

-- 4) Reset Discord link fields unless they match a real linked Discord identity.
update public.profiles
set discord_user_id = null,
    discord_presence_enabled = false
where discord_user_id is not null
  and discord_user_id !~ '^[0-9]{17,20}$';

with linked_discord as (
  select
    i.user_id,
    coalesce(
      nullif(trim(both from i.provider_id), ''),
      nullif(trim(both from i.identity_data ->> 'sub'), ''),
      nullif(trim(both from i.identity_data ->> 'id'), ''),
      nullif(trim(both from i.identity_data ->> 'user_id'), ''),
      nullif(trim(both from i.identity_data ->> 'discord_id'), '')
    ) as discord_id
  from auth.identities i
  where i.provider = 'discord'
)
update public.profiles p
set discord_user_id = null,
    discord_presence_enabled = false
where p.discord_user_id is not null
  and not exists (
    select 1
    from linked_discord ld
    where ld.user_id = p.id
      and ld.discord_id = p.discord_user_id
  );

update public.profiles
set discord_presence_enabled = false
where discord_user_id is null
  and discord_presence_enabled = true;

commit;

-- Post-run summary
select
  count(*) as total_profiles,
  count(*) filter (where discord_user_id is not null) as linked_discord_profiles,
  count(*) filter (where discord_presence_enabled) as discord_presence_enabled_profiles,
  count(*) filter (where 'verified' = any(coalesce(badges, '{}'::text[]))) as verified_badge_profiles,
  count(*) filter (where coalesce(badges, '{}'::text[]) && array['owner', 'admin', 'staff']::text[]) as elevated_staff_badge_profiles
from public.profiles;
