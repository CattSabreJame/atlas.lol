-- Restrict authenticated profile updates to an explicit safe column list.
-- This blocks forced payloads to sensitive columns (for example badges, discord_user_id, admin/moderation fields).
revoke update on table public.profiles from anon;
revoke update on table public.profiles from authenticated;

grant update (
  handle,
  display_name,
  bio,
  avatar_url,
  theme,
  is_public,
  avatar_float,
  layout,
  template,
  color_accent,
  rich_text,
  profile_animation,
  profile_effect,
  link_style,
  link_effect,
  link_icon_tint,
  avatar_shape,
  hero_align,
  background_mode,
  background_value,
  background_effect,
  comments_enabled,
  show_view_count,
  entry_gate_enabled,
  entry_gate_text,
  entry_gate_text_color,
  entry_gate_background_color,
  entry_gate_background_opacity,
  entry_gate_background_blur_px,
  entry_gate_font_size,
  entry_gate_font_weight,
  entry_gate_font_preset,
  entry_gate_custom_font_url,
  entry_gate_custom_font_name,
  profile_font_preset,
  profile_custom_font_url,
  profile_custom_font_name,
  name_effect,
  cursor_enabled,
  cursor_trails_enabled,
  cursor_mode,
  cursor_trail_mode,
  cursor_apply_in_app,
  active_cursor_id,
  discord_presence_enabled,
  discord_show_activity
) on table public.profiles to authenticated;

-- Keep service_role fully capable for secure backend-managed flows.
grant update on table public.profiles to service_role;
