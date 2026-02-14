export type ThemeName = "slate" | "emerald" | "amber" | "rose";
export type LayoutName = "stack" | "grid" | "split";
export type TemplateName = "signature" | "mono" | "spotlight" | "editorial";
export type WidgetType = "clock" | "stat" | "quote" | "embed";
export type BadgeType = "owner" | "admin" | "staff" | "verified" | "pro" | "founder";
export type ProfileAnimation = "none" | "subtle" | "lift" | "pulse";
export type ProfileEffect = "none" | "glow" | "grain" | "scanlines" | "halo" | "velvet" | "frost";
export type BackgroundEffect = "none" | "vignette" | "noise" | "mesh" | "spotlight" | "snow" | "rain" | "embers";
export type LinkStyle = "soft" | "glass" | "outline";
export type LinkEffect = "none" | "glow" | "outline" | "lift" | "pulse";
export type AvatarShape = "circle" | "rounded" | "square";
export type HeroAlign = "center" | "left";
export type BackgroundMode = "theme" | "gradient" | "image";
export type BackgroundGradient = "aurora" | "sunset" | "midnight" | "ocean";
export type EntryGateFontSize = "sm" | "md" | "lg";
export type EntryGateFontWeight = "medium" | "semibold" | "bold";
export type ProfileFontPreset =
  | "inter"
  | "manrope"
  | "general_sans"
  | "satoshi"
  | "neue_montreal"
  | "ibm_plex_sans"
  | "space_grotesk"
  | "jetbrains_mono"
  | "clash_display"
  | "outfit"
  | "plus_jakarta_sans"
  | "custom";
export type EntryGateFontPreset = ProfileFontPreset;
export type NameEffect =
  | "none"
  | "gradient"
  | "glow"
  | "outline"
  | "shimmer"
  | "underline_accent"
  | "shadow_depth"
  | "micro_badge";
export type CursorMode =
  | "glow"
  | "crosshair"
  | "morph"
  | "split"
  | "hollow_square"
  | "target_lock"
  | "invert"
  | "elastic"
  | "outline_morph"
  | "shadow_echo";
export type CursorTrailMode =
  | "velocity"
  | "dots"
  | "pixel"
  | "motion_blur"
  | "neon_thread"
  | "smoke"
  | "gravity"
  | "ripple_wake"
  | "data_stream"
  | "dual_layer"
  | "pulse_droplets";
export type AdminModerationAction =
  | "ban"
  | "unban"
  | "remove_avatar"
  | "remove_background"
  | "reset_visuals"
  | "clear_bio"
  | "wipe_links"
  | "purge_comments"
  | "force_private"
  | "force_public"
  | "disable_comments"
  | "enable_comments";

export interface ProfileRow {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: ThemeName;
  layout: LayoutName;
  template: TemplateName;
  color_accent: string | null;
  rich_text: string;
  badges: BadgeType[] | null;
  profile_animation: ProfileAnimation;
  profile_effect: ProfileEffect;
  link_style: LinkStyle;
  link_effect: LinkEffect;
  link_icon_tint: string | null;
  avatar_shape: AvatarShape;
  hero_align: HeroAlign;
  background_mode: BackgroundMode;
  background_value: string | null;
  background_effect: BackgroundEffect;
  discord_presence_enabled: boolean;
  discord_user_id: string | null;
  discord_show_activity: boolean;
  entry_gate_enabled: boolean;
  entry_gate_text: string;
  entry_gate_text_color: string;
  entry_gate_background_color: string;
  entry_gate_background_opacity: number;
  entry_gate_background_blur_px: number;
  entry_gate_font_size: EntryGateFontSize;
  entry_gate_font_weight: EntryGateFontWeight;
  entry_gate_font_preset: EntryGateFontPreset;
  entry_gate_custom_font_url: string | null;
  entry_gate_custom_font_name: string | null;
  profile_font_preset: ProfileFontPreset;
  profile_custom_font_url: string | null;
  profile_custom_font_name: string | null;
  name_effect: NameEffect;
  is_banned: boolean;
  banned_reason: string | null;
  comments_enabled: boolean;
  is_public: boolean;
  show_view_count: boolean;
  cursor_enabled: boolean;
  cursor_trails_enabled: boolean;
  cursor_mode: CursorMode;
  cursor_trail_mode: CursorTrailMode;
  cursor_apply_in_app: boolean;
  active_cursor_id: string | null;
  avatar_float: boolean;
  handle_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface UserCursorRow {
  id: string;
  user_id: string;
  name: string;
  file_url: string;
  hotspot_x: number;
  hotspot_y: number;
  created_at: string;
}

export interface LinkRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  clicks: number;
  created_at: string;
}

export interface AnalyticsDailyRow {
  id: string;
  user_id: string;
  day: string;
  profile_views: number;
}

export interface MusicTrackRow {
  id: string;
  user_id: string;
  title: string;
  embed_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface WidgetRow {
  id: string;
  user_id: string;
  widget_type: WidgetType;
  title: string;
  value: string | null;
  source_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface CommentRow {
  id: string;
  user_id: string;
  author_name: string;
  author_website: string | null;
  body: string;
  status: "published" | "hidden";
  created_at: string;
}

export interface AdminActionNoticeRow {
  id: string;
  target_user_id: string;
  actor_user_id: string;
  action_type: AdminModerationAction;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
