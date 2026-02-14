"use client";

import Link from "next/link";
import {
  AnimatePresence,
  LayoutGroup,
  Reorder,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Crown,
  GripVertical,
  Loader2,
  Monitor,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  X,
  WandSparkles,
  Wrench,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { LivePreview } from "@/components/editor/live-preview";
import { SiteLinkIcon } from "@/components/links/site-link-icon";
import { BadgeChip } from "@/components/ui/badge-chip";
import { LINK_EFFECT_OPTIONS } from "@/lib/link-appearance";
import { getSiteFaviconUrl, resolveLinkIconValue, withProtocol } from "@/lib/link-icons";
import { getMusicProviderSearchLinks, resolveMusicEmbedUrl } from "@/lib/music-embeds";
import {
  NAME_EFFECT_OPTIONS,
  normalizeProfileFontPreset,
  PROFILE_FONT_OPTIONS,
} from "@/lib/profile-appearance";
import {
  BADGE_OPTIONS,
  normalizeBadges,
  PROFILE_ANIMATION_OPTIONS,
  PROFILE_EFFECT_OPTIONS,
} from "@/lib/profile-features";
import { hasPremiumBadge } from "@/lib/premium";
import { createClient } from "@/lib/supabase/client";
import {
  BACKGROUND_EFFECT_OPTIONS,
  BACKGROUND_GRADIENT_PRESETS,
  TEMPLATE_PRESETS,
  THEME_OPTIONS,
} from "@/lib/theme";
import {
  aiBioGenerateSchema,
  aiBioPolishSchema,
  aiLinkLabelSchema,
  linkInputSchema,
  musicTrackInputSchema,
  profileUpdateSchema,
  widgetInputSchema,
} from "@/lib/validations";
import {
  AdminActionNoticeRow,
  BackgroundMode,
  BackgroundEffect,
  BadgeType,
  AvatarShape,
  CommentRow,
  HeroAlign,
  LinkRow,
  LinkEffect,
  LinkStyle,
  MusicTrackRow,
  NameEffect,
  ProfileFontPreset,
  ProfileAnimation,
  ProfileEffect,
  ProfileRow,
  TemplateName,
  ThemeName,
  WidgetRow,
  EntryGateFontSize,
  EntryGateFontPreset,
  EntryGateFontWeight,
} from "@/types/db";

type EditorTab = "profile" | "links" | "appearance" | "motion" | "integrations" | "ai";
type PreviewDevice = "phone" | "tablet" | "desktop";
type ProfileSection = "identity" | "bio" | "rich-text" | "badges";
type AppearanceSection = "theme" | "entry" | "style" | "background" | "visibility";
type ToastKind = "success" | "error" | "info";
type AIAction = "bio-generate" | "link-label" | "bio-polish";

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface LinkDraft {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
}

interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  trackViewUrl: string | null;
  artworkUrl: string | null;
}

interface EditorClientProps {
  userId: string;
  profile: ProfileRow;
  initialLinks: LinkRow[];
  initialTracks: MusicTrackRow[];
  initialWidgets: WidgetRow[];
  recentComments: CommentRow[];
  adminNotices: AdminActionNoticeRow[];
  premiumTicketUrl: string;
}

const TAB_ITEMS: Array<{ id: EditorTab; label: string; proOnly?: boolean }> = [
  { id: "profile", label: "Profile" },
  { id: "links", label: "Links" },
  { id: "appearance", label: "Appearance" },
  { id: "motion", label: "Motion" },
  { id: "integrations", label: "Integrations" },
  { id: "ai", label: "AI Assist", proOnly: true },
];

const PREVIEW_DEVICE_OPTIONS: Array<{
  value: PreviewDevice;
  label: string;
  icon: typeof Smartphone;
}> = [
  { value: "phone", label: "Phone", icon: Smartphone },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "desktop", label: "Desktop", icon: Monitor },
];

const LINK_STYLE_OPTIONS: Array<{ value: LinkStyle; label: string; description: string }> = [
  { value: "soft", label: "Soft", description: "Solid cards with subtle depth." },
  { value: "glass", label: "Glass", description: "Translucent cards with blur and glow." },
  { value: "outline", label: "Outline", description: "Lightweight outline style." },
];

const AVATAR_SHAPE_OPTIONS: Array<{ value: AvatarShape; label: string; description: string }> = [
  { value: "circle", label: "Circle", description: "Classic circular avatar frame." },
  { value: "rounded", label: "Rounded", description: "Rounded-square avatar frame." },
  { value: "square", label: "Square", description: "Tight, sharp-cornered avatar frame." },
];

const HERO_ALIGN_OPTIONS: Array<{ value: HeroAlign; label: string; description: string }> = [
  { value: "center", label: "Center", description: "Centered hero and intro text." },
  { value: "left", label: "Left", description: "Left-aligned hero and intro text." },
];

const BACKGROUND_MODE_OPTIONS: Array<{ value: BackgroundMode; label: string; description: string }> = [
  { value: "theme", label: "Theme", description: "Use your selected theme background." },
  { value: "gradient", label: "Gradient", description: "Apply a curated full-page gradient backdrop." },
  { value: "image", label: "Media", description: "Use a custom image or MP4 URL as your page background." },
];

const ENTRY_GATE_FONT_SIZE_OPTIONS: Array<{ value: EntryGateFontSize; label: string }> = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

const ENTRY_GATE_FONT_WEIGHT_OPTIONS: Array<{ value: EntryGateFontWeight; label: string }> = [
  { value: "medium", label: "Medium" },
  { value: "semibold", label: "Semibold" },
  { value: "bold", label: "Bold" },
];

const ENTRY_GATE_BACKGROUND_OPACITY_MIN = 35;
const ENTRY_GATE_BACKGROUND_OPACITY_MAX = 100;
const ENTRY_GATE_BACKGROUND_OPACITY_DEFAULT = 90;
const ENTRY_GATE_BACKGROUND_BLUR_MIN = 0;
const ENTRY_GATE_BACKGROUND_BLUR_MAX = 32;
const ENTRY_GATE_BACKGROUND_BLUR_DEFAULT = 12;

const BACKGROUND_MEDIA_BUCKET = "profile-backgrounds";
const BACKGROUND_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const BACKGROUND_MEDIA_ACCEPT = "image/*,video/mp4";
const ALLOWED_BACKGROUND_MEDIA_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
]);

const MUSIC_FILE_BUCKET = "profile-music";
const MUSIC_FILE_MAX_BYTES = 30 * 1024 * 1024;
const MUSIC_FILE_ACCEPT =
  ".mp3,.m4a,.wav,.ogg,.aac,.flac,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/aac,audio/flac";
const ALLOWED_MUSIC_FILE_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/ogg",
  "audio/aac",
  "audio/x-aac",
  "audio/flac",
  "audio/x-flac",
]);

const PROFILE_FONT_BUCKET = "profile-fonts";
const PROFILE_FONT_MAX_BYTES = 2 * 1024 * 1024;
const PROFILE_FONT_ACCEPT =
  ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf,application/font-woff,application/font-sfnt,application/x-font-ttf,application/x-font-opentype";
const ALLOWED_PROFILE_FONT_MIME_TYPES = new Set([
  "font/woff2",
  "font/woff",
  "font/ttf",
  "font/otf",
  "application/font-woff",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-opentype",
]);

const LINK_ICON_BUCKET = "link-icons";
const LINK_ICON_MAX_BYTES = 512 * 1024;
const LINK_ICON_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.svg,.ico,image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon";
const ALLOWED_LINK_ICON_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

const badgeIcon: Record<BadgeType, ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5" />,
  admin: <ShieldCheck className="h-3.5 w-3.5" />,
  staff: <Wrench className="h-3.5 w-3.5" />,
  verified: <ShieldCheck className="h-3.5 w-3.5" />,
  pro: <Sparkles className="h-3.5 w-3.5" />,
  founder: <Crown className="h-3.5 w-3.5" />,
};

function normalizeSortOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item, index) => ({
      ...item,
      sort_order: index,
    }));
}

function emptyLink(userId: string, sortOrder: number): LinkRow {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    title: "New Link",
    url: "https://",
    description: null,
    icon: null,
    sort_order: sortOrder,
    clicks: 0,
    created_at: new Date().toISOString(),
  };
}

function emptyTrack(userId: string, sortOrder: number): MusicTrackRow {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    title: "New Track",
    embed_url: "https://",
    sort_order: sortOrder,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

function emptyWidget(userId: string, sortOrder: number): WidgetRow {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    widget_type: "clock",
    title: "Widget",
    value: null,
    source_url: null,
    sort_order: sortOrder,
    is_active: true,
    created_at: new Date().toISOString(),
  };
}

function asSafeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeEntryGateBackgroundOpacity(value: number | null | undefined): number {
  return clampNumber(
    Math.round(value ?? ENTRY_GATE_BACKGROUND_OPACITY_DEFAULT),
    ENTRY_GATE_BACKGROUND_OPACITY_MIN,
    ENTRY_GATE_BACKGROUND_OPACITY_MAX,
  );
}

function sanitizeEntryGateBackgroundBlur(value: number | null | undefined): number {
  return clampNumber(
    Math.round(value ?? ENTRY_GATE_BACKGROUND_BLUR_DEFAULT),
    ENTRY_GATE_BACKGROUND_BLUR_MIN,
    ENTRY_GATE_BACKGROUND_BLUR_MAX,
  );
}

function resolveBackgroundFileExtension(file: File): string {
  const extFromName = (file.name.split(".").pop() || "").trim().toLowerCase();

  if (extFromName) {
    return extFromName;
  }

  if (file.type === "video/mp4") {
    return "mp4";
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/gif") {
    return "gif";
  }

  return "jpg";
}

function resolveBackgroundMimeType(extension: string): string | null {
  const normalized = extension.trim().toLowerCase();

  if (normalized === "mp4") {
    return "video/mp4";
  }

  if (normalized === "png") {
    return "image/png";
  }

  if (normalized === "webp") {
    return "image/webp";
  }

  if (normalized === "gif") {
    return "image/gif";
  }

  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }

  return null;
}

function resolveMusicFileExtension(file: File): string {
  const extFromName = (file.name.split(".").pop() || "").trim().toLowerCase();

  if (extFromName) {
    return extFromName;
  }

  if (file.type === "audio/mp4" || file.type === "audio/x-m4a") {
    return "m4a";
  }

  if (file.type === "audio/wav" || file.type === "audio/x-wav" || file.type === "audio/wave") {
    return "wav";
  }

  if (file.type === "audio/ogg") {
    return "ogg";
  }

  if (file.type === "audio/aac" || file.type === "audio/x-aac") {
    return "aac";
  }

  if (file.type === "audio/flac" || file.type === "audio/x-flac") {
    return "flac";
  }

  return "mp3";
}

function resolveMusicMimeType(extension: string): string | null {
  const normalized = extension.trim().toLowerCase();

  if (normalized === "mp3") {
    return "audio/mpeg";
  }

  if (normalized === "m4a") {
    return "audio/mp4";
  }

  if (normalized === "wav") {
    return "audio/wav";
  }

  if (normalized === "ogg") {
    return "audio/ogg";
  }

  if (normalized === "aac") {
    return "audio/aac";
  }

  if (normalized === "flac") {
    return "audio/flac";
  }

  return null;
}

function resolveProfileFontExtension(file: File): string {
  const extFromName = (file.name.split(".").pop() || "").trim().toLowerCase();

  if (extFromName) {
    return extFromName;
  }

  if (file.type === "font/woff2") {
    return "woff2";
  }

  if (file.type === "font/woff" || file.type === "application/font-woff") {
    return "woff";
  }

  if (file.type === "font/ttf" || file.type === "application/x-font-ttf") {
    return "ttf";
  }

  return "otf";
}

function resolveProfileFontMimeType(extension: string): string | null {
  const normalized = extension.trim().toLowerCase();

  if (normalized === "woff2") {
    return "font/woff2";
  }

  if (normalized === "woff") {
    return "font/woff";
  }

  if (normalized === "ttf") {
    return "font/ttf";
  }

  if (normalized === "otf") {
    return "font/otf";
  }

  return null;
}

function resolveLinkIconExtension(file: File): string {
  const extFromName = (file.name.split(".").pop() || "").trim().toLowerCase();

  if (extFromName) {
    return extFromName;
  }

  if (file.type === "image/jpeg") {
    return "jpg";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  if (file.type === "image/gif") {
    return "gif";
  }

  if (file.type === "image/svg+xml") {
    return "svg";
  }

  if (file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon") {
    return "ico";
  }

  return "png";
}

function resolveLinkIconMimeType(extension: string): string | null {
  const normalized = extension.trim().toLowerCase();

  if (normalized === "png") {
    return "image/png";
  }

  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }

  if (normalized === "webp") {
    return "image/webp";
  }

  if (normalized === "gif") {
    return "image/gif";
  }

  if (normalized === "svg") {
    return "image/svg+xml";
  }

  if (normalized === "ico") {
    return "image/x-icon";
  }

  return null;
}

function getStoragePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index < 0) {
      return null;
    }

    const encodedPath = parsed.pathname.slice(index + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

function formatLastUpdated(updatedAt: string): string {
  const parsed = new Date(updatedAt);

  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  const diffMs = Date.now() - parsed.getTime();

  if (diffMs < 60_000) {
    return "Just now";
  }

  if (diffMs < 3_600_000) {
    return `${Math.max(1, Math.floor(diffMs / 60_000))}m ago`;
  }

  if (diffMs < 86_400_000) {
    return `${Math.max(1, Math.floor(diffMs / 3_600_000))}h ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function tabTransition(reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: 0.24, ease: "easeOut" as const },
  };
}

function getEditorThemeName(theme: ThemeName): string {
  if (theme === "amber") {
    return "Charcoal";
  }

  if (theme === "emerald") {
    return "Olive";
  }

  if (theme === "rose") {
    return "Rose";
  }

  return "Slate";
}

function formatModerationAction(action: AdminActionNoticeRow["action_type"]): string {
  if (action === "ban") {
    return "Account banned";
  }

  if (action === "unban") {
    return "Account unbanned";
  }

  if (action === "remove_avatar") {
    return "Profile photo removed";
  }

  if (action === "remove_background") {
    return "Profile background removed";
  }

  if (action === "reset_visuals") {
    return "Profile visuals reset";
  }

  if (action === "clear_bio") {
    return "Bio content removed";
  }

  if (action === "wipe_links") {
    return "All links deleted";
  }

  if (action === "purge_comments") {
    return "All comments purged";
  }

  if (action === "force_private") {
    return "Profile set to private";
  }

  if (action === "force_public") {
    return "Profile set to public";
  }

  if (action === "disable_comments") {
    return "Comments disabled";
  }

  return "Comments enabled";
}

function buildEditorSnapshot(input: {
  profile: {
    displayName: string;
    handle: string;
    bio: string;
    richText: string;
    theme: ThemeName;
    layout: ProfileRow["layout"];
    template: TemplateName;
    colorAccent: string;
    profileAnimation: ProfileAnimation;
    profileEffect: ProfileEffect;
    linkStyle: LinkStyle;
    linkEffect: LinkEffect;
    linkIconTint: string;
    avatarShape: AvatarShape;
    heroAlign: HeroAlign;
    backgroundMode: BackgroundMode;
    backgroundValue: string;
    backgroundEffect: BackgroundEffect;
    avatarFloat: boolean;
    commentsEnabled: boolean;
    isPublic: boolean;
    showViewCount: boolean;
    discordPresenceEnabled: boolean;
    discordUserId: string;
    discordShowActivity: boolean;
    entryGateEnabled: boolean;
    entryGateText: string;
    entryGateTextColor: string;
    entryGateBackgroundColor: string;
    entryGateBackgroundOpacity: number;
    entryGateBackgroundBlurPx: number;
    entryGateFontSize: EntryGateFontSize;
    entryGateFontWeight: EntryGateFontWeight;
    entryGateFontPreset: EntryGateFontPreset;
    entryGateCustomFontUrl: string;
    entryGateCustomFontName: string;
    profileFontPreset: ProfileFontPreset;
    profileCustomFontUrl: string;
    profileCustomFontName: string;
    nameEffect: NameEffect;
  };
  links: Array<Pick<LinkRow, "id" | "title" | "url" | "description" | "icon" | "sort_order">>;
  tracks: Array<Pick<MusicTrackRow, "id" | "title" | "embed_url" | "is_active" | "sort_order">>;
  widgets: Array<
    Pick<WidgetRow, "id" | "widget_type" | "title" | "value" | "source_url" | "is_active" | "sort_order">
  >;
}): string {
  return JSON.stringify({
    profile: {
      displayName: input.profile.displayName,
      handle: input.profile.handle,
      bio: input.profile.bio,
      richText: input.profile.richText,
      theme: input.profile.theme,
      layout: input.profile.layout,
      template: input.profile.template,
      colorAccent: input.profile.colorAccent,
      profileAnimation: input.profile.profileAnimation,
      profileEffect: input.profile.profileEffect,
      linkStyle: input.profile.linkStyle,
      linkEffect: input.profile.linkEffect,
      linkIconTint: input.profile.linkIconTint,
      avatarShape: input.profile.avatarShape,
      heroAlign: input.profile.heroAlign,
      backgroundMode: input.profile.backgroundMode,
      backgroundValue: input.profile.backgroundValue,
      backgroundEffect: input.profile.backgroundEffect,
      avatarFloat: input.profile.avatarFloat,
      commentsEnabled: input.profile.commentsEnabled,
      isPublic: input.profile.isPublic,
      showViewCount: input.profile.showViewCount,
      discordPresenceEnabled: input.profile.discordPresenceEnabled,
      discordUserId: input.profile.discordUserId,
      discordShowActivity: input.profile.discordShowActivity,
      entryGateEnabled: input.profile.entryGateEnabled,
      entryGateText: input.profile.entryGateText,
      entryGateTextColor: input.profile.entryGateTextColor,
      entryGateBackgroundColor: input.profile.entryGateBackgroundColor,
      entryGateBackgroundOpacity: input.profile.entryGateBackgroundOpacity,
      entryGateBackgroundBlurPx: input.profile.entryGateBackgroundBlurPx,
      entryGateFontSize: input.profile.entryGateFontSize,
      entryGateFontWeight: input.profile.entryGateFontWeight,
      entryGateFontPreset: input.profile.entryGateFontPreset,
      entryGateCustomFontUrl: input.profile.entryGateCustomFontUrl,
      entryGateCustomFontName: input.profile.entryGateCustomFontName,
      profileFontPreset: input.profile.profileFontPreset,
      profileCustomFontUrl: input.profile.profileCustomFontUrl,
      profileCustomFontName: input.profile.profileCustomFontName,
      nameEffect: input.profile.nameEffect,
    },
    links: input.links.map((link) => ({
      id: link.id,
      title: link.title,
      url: link.url,
      description: link.description,
      icon: link.icon,
      sort: link.sort_order,
    })),
    tracks: input.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      embedUrl: track.embed_url,
      active: track.is_active,
      sort: track.sort_order,
    })),
    widgets: input.widgets.map((widget) => ({
      id: widget.id,
      type: widget.widget_type,
      title: widget.title,
      value: widget.value,
      source: widget.source_url,
      active: widget.is_active,
      sort: widget.sort_order,
    })),
  });
}

export function EditorClient({
  userId,
  profile,
  initialLinks,
  initialTracks,
  initialWidgets,
  recentComments,
  adminNotices,
  premiumTicketUrl,
}: EditorClientProps) {
  const reduceMotion = useReducedMotion();
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [richText, setRichText] = useState(profile.rich_text ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  const [theme, setTheme] = useState<ThemeName>(profile.theme ?? "slate");
  const [layout, setLayout] = useState(profile.layout ?? "stack");
  const [template, setTemplate] = useState<TemplateName>(profile.template ?? "signature");
  const [colorAccent, setColorAccent] = useState(profile.color_accent ?? "");
  const [linkStyle, setLinkStyle] = useState<LinkStyle>(profile.link_style ?? "soft");
  const [linkEffect, setLinkEffect] = useState<LinkEffect>(profile.link_effect ?? "none");
  const [linkIconTint, setLinkIconTint] = useState(profile.link_icon_tint ?? "");
  const [avatarShape, setAvatarShape] = useState<AvatarShape>(profile.avatar_shape ?? "circle");
  const [heroAlign, setHeroAlign] = useState<HeroAlign>(profile.hero_align ?? "center");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(profile.background_mode ?? "theme");
  const [backgroundValue, setBackgroundValue] = useState(profile.background_value ?? "");
  const [backgroundEffect, setBackgroundEffect] = useState<BackgroundEffect>(profile.background_effect ?? "none");

  const [profileAnimation, setProfileAnimation] = useState<ProfileAnimation>(
    profile.profile_animation ?? "subtle",
  );
  const [profileEffect, setProfileEffect] = useState<ProfileEffect>(profile.profile_effect ?? "none");
  const [avatarFloat, setAvatarFloat] = useState(profile.avatar_float ?? false);
  const [commentsEnabled, setCommentsEnabled] = useState(profile.comments_enabled ?? true);
  const [isPublic, setIsPublic] = useState(profile.is_public ?? true);
  const [showViewCount, setShowViewCount] = useState(profile.show_view_count ?? true);
  const [entryGateEnabled, setEntryGateEnabled] = useState(profile.entry_gate_enabled ?? false);
  const [entryGateText, setEntryGateText] = useState(profile.entry_gate_text ?? "Click");
  const [entryGateTextColor, setEntryGateTextColor] = useState(
    profile.entry_gate_text_color ?? "#F2F1EE",
  );
  const [entryGateBackgroundColor, setEntryGateBackgroundColor] = useState(
    profile.entry_gate_background_color ?? "#080809",
  );
  const [entryGateBackgroundOpacity, setEntryGateBackgroundOpacity] = useState(
    sanitizeEntryGateBackgroundOpacity(profile.entry_gate_background_opacity),
  );
  const [entryGateBackgroundBlurPx, setEntryGateBackgroundBlurPx] = useState(
    sanitizeEntryGateBackgroundBlur(profile.entry_gate_background_blur_px),
  );
  const [entryGateFontSize, setEntryGateFontSize] = useState<EntryGateFontSize>(
    profile.entry_gate_font_size ?? "md",
  );
  const [entryGateFontWeight, setEntryGateFontWeight] = useState<EntryGateFontWeight>(
    profile.entry_gate_font_weight ?? "semibold",
  );
  const [entryGateFontPreset, setEntryGateFontPreset] = useState<EntryGateFontPreset>(
    normalizeProfileFontPreset(profile.entry_gate_font_preset),
  );
  const [entryGateCustomFontUrl, setEntryGateCustomFontUrl] = useState(
    profile.entry_gate_custom_font_url ?? "",
  );
  const [entryGateCustomFontName, setEntryGateCustomFontName] = useState(
    profile.entry_gate_custom_font_name ?? "",
  );
  const [profileFontPreset, setProfileFontPreset] = useState<ProfileFontPreset>(
    normalizeProfileFontPreset(profile.profile_font_preset),
  );
  const [profileCustomFontUrl, setProfileCustomFontUrl] = useState(
    profile.profile_custom_font_url ?? "",
  );
  const [profileCustomFontName, setProfileCustomFontName] = useState(
    profile.profile_custom_font_name ?? "",
  );
  const [nameEffect, setNameEffect] = useState<NameEffect>(profile.name_effect ?? "none");
  const [discordPresenceEnabled, setDiscordPresenceEnabled] = useState(
    profile.discord_presence_enabled ?? false,
  );
  const [discordUserId, setDiscordUserId] = useState(profile.discord_user_id ?? "");
  const [discordShowActivity, setDiscordShowActivity] = useState(
    profile.discord_show_activity ?? true,
  );
  const [discordLinking, setDiscordLinking] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);

  const [links, setLinks] = useState<LinkRow[]>(normalizeSortOrder(initialLinks));
  const [tracks, setTracks] = useState<MusicTrackRow[]>(normalizeSortOrder(initialTracks));
  const [widgets, setWidgets] = useState<WidgetRow[]>(normalizeSortOrder(initialWidgets));

  const [comments, setComments] = useState<CommentRow[]>(recentComments);
  const [activeTab, setActiveTab] = useState<EditorTab>("profile");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("phone");
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [activeProfileSection, setActiveProfileSection] = useState<ProfileSection>("identity");
  const [activeAppearanceSection, setActiveAppearanceSection] = useState<AppearanceSection>("theme");
  const [showMusicSection, setShowMusicSection] = useState(false);
  const [showWidgetSection, setShowWidgetSection] = useState(false);
  const [showCommentSection, setShowCommentSection] = useState(false);
  const [transitionsEnabled, setTransitionsEnabled] = useState(
    (profile.profile_animation ?? "subtle") !== "none",
  );

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBackgroundMedia, setUploadingBackgroundMedia] = useState(false);
  const [uploadingEntryGateFont, setUploadingEntryGateFont] = useState(false);
  const [uploadingProfileFont, setUploadingProfileFont] = useState(false);
  const [uploadingLinkIcon, setUploadingLinkIcon] = useState(false);
  const [uploadingMusicFile, setUploadingMusicFile] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(true);

  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [linkDraftError, setLinkDraftError] = useState("");

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [aiVibe, setAiVibe] = useState<"clean/professional" | "creative" | "minimal" | "confident">(
    "minimal",
  );
  const [aiBioInterests, setAiBioInterests] = useState("");
  const [aiBioLength, setAiBioLength] = useState<"short" | "medium" | "long">("short");
  const [aiBioOptions, setAiBioOptions] = useState<string[]>([]);

  const [aiLinkUrl, setAiLinkUrl] = useState("");
  const [aiLinkTargetId, setAiLinkTargetId] = useState("");
  const [aiLinkTitle, setAiLinkTitle] = useState("");
  const [aiLinkDescription, setAiLinkDescription] = useState("");

  const [aiPolishInput, setAiPolishInput] = useState("");
  const [aiPolishMinimal, setAiPolishMinimal] = useState("");
  const [aiPolishExpressive, setAiPolishExpressive] = useState("");

  const [aiLoading, setAiLoading] = useState<AIAction | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState("");

  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>([]);

  const [musicQuery, setMusicQuery] = useState("");
  const [musicResults, setMusicResults] = useState<MusicSearchResult[]>([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [musicSearchError, setMusicSearchError] = useState("");

  const savedLinkIdsRef = useRef(new Set(initialLinks.map((item) => item.id)));
  const savedTrackIdsRef = useRef(new Set(initialTracks.map((item) => item.id)));
  const savedWidgetIdsRef = useRef(new Set(initialWidgets.map((item) => item.id)));

  const profileBadges = useMemo(() => normalizeBadges(profile.badges), [profile.badges]);
  const hasPremium = useMemo(() => hasPremiumBadge(profileBadges), [profileBadges]);

  useEffect(() => {
    setTransitionsEnabled(profileAnimation !== "none");
  }, [profileAnimation]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewLoading(false), 450);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const discordState = params.get("discord");

    if (!discordState) {
      return;
    }

    const messageMap: Record<string, { kind: ToastKind; message: string }> = {
      connected: { kind: "success", message: "Discord connected." },
      join_failed: {
        kind: "error",
        message: "Unknown Error Connecting To Discord.",
      },
      oauth_missing: {
        kind: "error",
        message: "Unknown Error Connecting To Discord.",
      },
      token_error: { kind: "error", message: "Unknown Error Connecting To Discord." },
      identity_error: { kind: "error", message: "Unknown Error Connecting To Discord." },
      scope_missing: {
        kind: "error",
        message: "Unknown Error Connecting To Discord.",
      },
      state_error: { kind: "error", message: "Unknown Error Connecting To Discord." },
      state_user_mismatch: { kind: "error", message: "Unknown Error Connecting To Discord." },
      auth_required: { kind: "error", message: "Unknown Error Connecting To Discord." },
      profile_update_error: { kind: "error", message: "Unknown Error Connecting To Discord." },
      unknown_error: { kind: "error", message: "Unknown Error Connecting To Discord." },
    };

    const mapped =
      messageMap[discordState]
      ?? (discordState === "connected"
        ? null
        : { kind: "error", message: "Unknown Error Connecting To Discord." });

    if (mapped) {
      pushToast(mapped.kind, mapped.message);
    }

    params.delete("discord");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (!discordUserId.trim()) {
      setDiscordPresenceEnabled(false);
    }
  }, [discordUserId]);

  useEffect(() => {
    if (!aiLinkTargetId && links.length > 0) {
      setAiLinkTargetId(links[0].id);
      return;
    }

    if (aiLinkTargetId && !links.some((link) => link.id === aiLinkTargetId)) {
      setAiLinkTargetId(links[0]?.id ?? "");
    }
  }, [aiLinkTargetId, links]);

  const currentSnapshot = useMemo(
    () =>
      buildEditorSnapshot({
        profile: {
          displayName,
          handle: profile.handle,
          bio,
          richText,
          theme,
          layout,
          template,
          colorAccent,
          profileAnimation,
          profileEffect,
          linkStyle,
          linkEffect,
          linkIconTint,
          avatarShape,
          heroAlign,
          backgroundMode,
          backgroundValue,
          backgroundEffect,
          avatarFloat,
          commentsEnabled,
          isPublic,
          showViewCount,
          discordPresenceEnabled,
          discordUserId,
          discordShowActivity,
          entryGateEnabled,
          entryGateText,
          entryGateTextColor,
          entryGateBackgroundColor,
          entryGateBackgroundOpacity,
          entryGateBackgroundBlurPx,
          entryGateFontSize,
          entryGateFontWeight,
          entryGateFontPreset,
          entryGateCustomFontUrl,
          entryGateCustomFontName,
          profileFontPreset,
          profileCustomFontUrl,
          profileCustomFontName,
          nameEffect,
        },
        links,
        tracks,
        widgets,
      }),
    [
      avatarFloat,
      bio,
      backgroundMode,
      backgroundEffect,
      backgroundValue,
      colorAccent,
      commentsEnabled,
      discordPresenceEnabled,
      discordShowActivity,
      discordUserId,
      displayName,
      entryGateBackgroundColor,
      entryGateBackgroundOpacity,
      entryGateBackgroundBlurPx,
      entryGateCustomFontName,
      entryGateCustomFontUrl,
      entryGateEnabled,
      entryGateFontSize,
      entryGateFontPreset,
      entryGateFontWeight,
      entryGateText,
      entryGateTextColor,
      nameEffect,
      heroAlign,
      isPublic,
      layout,
      linkEffect,
      linkIconTint,
      linkStyle,
      links,
      profileCustomFontName,
      profileCustomFontUrl,
      profileFontPreset,
      showViewCount,
      profile.handle,
      profileAnimation,
      profileEffect,
      richText,
      template,
      theme,
      tracks,
      avatarShape,
      widgets,
    ],
  );

  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(currentSnapshot);
  const [lastSavedAt, setLastSavedAt] = useState(profile.updated_at);
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshot;
  const hasDiscordConnection = discordUserId.trim().length > 0;
  const maskedDiscordUserId = hasDiscordConnection
    ? `${discordUserId.trim().slice(0, 4)}...${discordUserId.trim().slice(-4)}`
    : "";

  const visibleAdminNotices = useMemo(
    () => adminNotices.filter((notice) => !dismissedNoticeIds.includes(notice.id)),
    [adminNotices, dismissedNoticeIds],
  );

  const statusSummary = useMemo(
    () =>
      `${saving ? "Saving" : hasUnsavedChanges ? "Unsaved" : "Saved"} \u00b7 ${isPublic ? "Public" : "Private"} \u00b7 Links ${links.length}`,
    [hasUnsavedChanges, isPublic, links.length, saving],
  );

  const profileSectionTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { duration: 0.2, ease: "easeOut" as const },
    [reduceMotion],
  );

  const tabIndicatorTransition = useMemo(
    () =>
      reduceMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 520, damping: 40, mass: 0.45 },
    [reduceMotion],
  );

  function pushToast(kind: ToastKind, message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function openLinkDraft(link: LinkRow) {
    setLinkDraftError("");
    setLinkDraft({
      id: link.id,
      title: link.title,
      url: link.url,
      description: link.description ?? "",
      icon: link.icon ?? "",
    });
  }

  function closeLinkDraft() {
    setLinkDraft(null);
    setLinkDraftError("");
  }

  async function handleLinkIconInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !linkDraft) {
      return;
    }

    const extension = resolveLinkIconExtension(file);
    const inferredMimeType = resolveLinkIconMimeType(extension);
    const mimeType = (file.type.trim().toLowerCase() || inferredMimeType || "").toLowerCase();

    if (!mimeType || !ALLOWED_LINK_ICON_MIME_TYPES.has(mimeType)) {
      pushToast("error", "Unsupported icon type. Use PNG, JPG, WEBP, GIF, SVG, or ICO.");
      return;
    }

    if (file.size > LINK_ICON_MAX_BYTES) {
      pushToast("error", "Icon file must be 512KB or smaller.");
      return;
    }

    setUploadingLinkIcon(true);

    try {
      const previousIcon = linkDraft.icon.trim();
      const path = `${userId}/${linkDraft.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(LINK_ICON_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(LINK_ICON_BUCKET).getPublicUrl(path);

      const previousStoragePath = getStoragePathFromPublicUrl(previousIcon, LINK_ICON_BUCKET);
      if (previousStoragePath) {
        await supabase.storage.from(LINK_ICON_BUCKET).remove([previousStoragePath]);
      }

      setLinkDraft((prev) => (prev ? { ...prev, icon: publicUrl } : prev));
      pushToast("success", "Icon uploaded.");
    } catch (error) {
      const message = asSafeError(error, "Could not upload icon.");

      if (/bucket.*not found/i.test(message) || /not found/i.test(message)) {
        pushToast(
          "error",
          "Link icon uploads are not ready yet. Run the latest Supabase migrations and try again.",
        );
      } else {
        pushToast("error", message);
      }
    } finally {
      setUploadingLinkIcon(false);
    }
  }

  async function clearCustomLinkIcon() {
    if (!linkDraft) {
      return;
    }

    setUploadingLinkIcon(true);

    try {
      const existingPath = getStoragePathFromPublicUrl(linkDraft.icon.trim(), LINK_ICON_BUCKET);
      if (existingPath) {
        await supabase.storage.from(LINK_ICON_BUCKET).remove([existingPath]);
      }

      setLinkDraft((prev) => (prev ? { ...prev, icon: "" } : prev));
      pushToast("success", "Custom icon removed.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not clear icon."));
    } finally {
      setUploadingLinkIcon(false);
    }
  }

  function commitLinkDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!linkDraft) {
      return;
    }

    const parsed = linkInputSchema.safeParse({
      id: linkDraft.id,
      title: linkDraft.title,
      url: withProtocol(linkDraft.url),
      description: linkDraft.description || null,
      icon: linkDraft.icon || null,
      sortOrder: 0,
    });

    if (!parsed.success) {
      setLinkDraftError(parsed.error.issues[0]?.message ?? "Please check this link.");
      return;
    }

    const resolvedIcon = resolveLinkIconValue(parsed.data.url, parsed.data.icon || null);

    setLinks((prev) =>
      prev.map((link) =>
        link.id === linkDraft.id
          ? {
              ...link,
              title: parsed.data.title,
              url: parsed.data.url,
              description: parsed.data.description || null,
              icon: resolvedIcon,
            }
          : link,
      ),
    );

    closeLinkDraft();
  }

  function addLink() {
    const link = emptyLink(userId, links.length);
    setLinks((prev) => [...prev, link]);
    openLinkDraft(link);
  }

  function removeLink(linkId: string) {
    setLinks((prev) => normalizeSortOrder(prev.filter((link) => link.id !== linkId)));

    if (linkDraft?.id === linkId) {
      closeLinkDraft();
    }
  }

  function reorderLinks(nextItems: LinkRow[]) {
    setLinks(normalizeSortOrder(nextItems));
  }

  function sortLinksAlphabetically() {
    setLinks((prev) =>
      normalizeSortOrder(
        prev.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" })),
      ),
    );
    pushToast("info", "Links sorted A-Z.");
  }

  function reverseLinksOrder() {
    setLinks((prev) => normalizeSortOrder(prev.slice().reverse()));
    pushToast("info", "Link order reversed.");
  }

  function addTrack() {
    setTracks((prev) => [...prev, emptyTrack(userId, prev.length)]);
  }

  async function handleMusicFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = resolveMusicFileExtension(file);
    const inferredMimeType = resolveMusicMimeType(extension);
    const mimeType = (file.type.trim().toLowerCase() || inferredMimeType || "").toLowerCase();

    if (!mimeType || !ALLOWED_MUSIC_FILE_MIME_TYPES.has(mimeType)) {
      pushToast("error", "Unsupported audio type. Use MP3, M4A, WAV, OGG, AAC, or FLAC.");
      event.target.value = "";
      return;
    }

    if (file.size > MUSIC_FILE_MAX_BYTES) {
      pushToast("error", "Audio file must be 30MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadingMusicFile(true);

    try {
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(MUSIC_FILE_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(MUSIC_FILE_BUCKET).getPublicUrl(path);

      const fileTitle = file.name.replace(/\.[^/.]+$/, "").trim();
      const title = (fileTitle || "Uploaded track").slice(0, 80);

      setTracks((prev) => [
        ...prev,
        {
          ...emptyTrack(userId, prev.length),
          title,
          embed_url: publicUrl,
          is_active: true,
        },
      ]);

      pushToast("success", `Uploaded: ${title}. Save changes to publish.`);
    } catch (error) {
      const message = asSafeError(error, "Could not upload music file.");

      if (/bucket.*not found/i.test(message) || /not found/i.test(message)) {
        pushToast(
          "error",
          "Music uploads are not ready yet. Run the latest Supabase migrations and try again.",
        );
      } else {
        pushToast("error", message);
      }
    } finally {
      setUploadingMusicFile(false);
      event.target.value = "";
    }
  }

  async function searchMusicCatalog() {
    const query = musicQuery.trim();

    if (query.length < 2) {
      setMusicSearchError("Enter at least 2 characters.");
      setMusicResults([]);
      return;
    }

    setMusicSearching(true);
    setMusicSearchError("");

    try {
      const response = await fetch(`/api/music/search?q=${encodeURIComponent(query)}&limit=8`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as { results?: MusicSearchResult[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Music search failed.");
      }

      setMusicResults(payload.results ?? []);
    } catch (error) {
      setMusicResults([]);
      setMusicSearchError(asSafeError(error, "Music search failed."));
    } finally {
      setMusicSearching(false);
    }
  }

  function addTrackFromSearch(result: MusicSearchResult) {
    const composedTitle = `${result.title} - ${result.artist}`.slice(0, 80);
    const nextTrack: MusicTrackRow = {
      ...emptyTrack(userId, tracks.length),
      title: composedTitle,
      embed_url: result.previewUrl,
      is_active: true,
    };

    setTracks((prev) => [...prev, nextTrack]);
    pushToast("success", `Added track: ${result.title}.`);
  }

  function checkTrackUrl(trackId: string) {
    const track = tracks.find((item) => item.id === trackId);

    if (!track) {
      return;
    }

    const normalizedUrl = withProtocol(track.embed_url);
    const resolved = resolveMusicEmbedUrl(normalizedUrl);
    updateTrack(trackId, { embed_url: normalizedUrl });

    if (resolved.provider === "audio") {
      pushToast("success", "Track URL is playable in the custom player.");
      return;
    }

    if (resolved.provider === "unknown") {
      pushToast("info", resolved.hint);
      return;
    }

    pushToast("info", resolved.hint);
  }

  function updateTrack(trackId: string, patch: Partial<MusicTrackRow>) {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? { ...track, ...patch } : track)));
  }

  function removeTrack(trackId: string) {
    setTracks((prev) => normalizeSortOrder(prev.filter((track) => track.id !== trackId)));
  }

  function addWidget() {
    setWidgets((prev) => [...prev, emptyWidget(userId, prev.length)]);
  }

  function updateWidget(widgetId: string, patch: Partial<WidgetRow>) {
    setWidgets((prev) => prev.map((widget) => (widget.id === widgetId ? { ...widget, ...patch } : widget)));
  }

  function removeWidget(widgetId: string) {
    setWidgets((prev) => normalizeSortOrder(prev.filter((widget) => widget.id !== widgetId)));
  }

  async function persistAvatarUrl(nextUrl: string | null) {
    const normalizedUrl = nextUrl?.trim() || null;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: normalizedUrl })
      .eq("id", userId);

    if (error) {
      throw error;
    }

    setAvatarUrl(normalizedUrl ?? "");
  }

  async function handleAvatarInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingAvatar(true);

    try {
      const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      await persistAvatarUrl(publicUrl);
      pushToast("success", "Avatar uploaded and saved.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not upload avatar."));
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function clearAvatar() {
    setUploadingAvatar(true);

    try {
      await persistAvatarUrl(null);
      pushToast("success", "Avatar removed.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not remove avatar."));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBackgroundMediaInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = resolveBackgroundFileExtension(file);
    const inferredMimeType = resolveBackgroundMimeType(extension);
    const mimeType = (file.type.trim().toLowerCase() || inferredMimeType || "").toLowerCase();

    if (!mimeType || !ALLOWED_BACKGROUND_MEDIA_MIME_TYPES.has(mimeType)) {
      pushToast("error", "Unsupported file type. Use JPG, PNG, WEBP, GIF, or MP4.");
      event.target.value = "";
      return;
    }

    if (file.size > BACKGROUND_MEDIA_MAX_BYTES) {
      pushToast("error", "Background media must be 50MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadingBackgroundMedia(true);

    try {
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(BACKGROUND_MEDIA_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(BACKGROUND_MEDIA_BUCKET).getPublicUrl(path);

      setBackgroundMode("image");
      setBackgroundValue(publicUrl);
      pushToast("success", "Background media uploaded. Save changes to publish.");
    } catch (error) {
      const message = asSafeError(error, "Could not upload background media.");

      if (/bucket.*not found/i.test(message) || /not found/i.test(message)) {
        pushToast(
          "error",
          "Background uploads are not ready yet. Run the latest Supabase migrations and try again.",
        );
      } else {
        pushToast("error", message);
      }
    } finally {
      setUploadingBackgroundMedia(false);
      event.target.value = "";
    }
  }

  async function clearBackgroundMedia() {
    setUploadingBackgroundMedia(true);

    try {
      const backgroundUrl = backgroundValue.trim();

      if (backgroundUrl) {
        const storagePath = getStoragePathFromPublicUrl(backgroundUrl, BACKGROUND_MEDIA_BUCKET);

        if (storagePath) {
          await supabase.storage.from(BACKGROUND_MEDIA_BUCKET).remove([storagePath]);
        }
      }

      setBackgroundMode("theme");
      setBackgroundValue("");
      pushToast("success", "Background media cleared. Save changes to publish.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not clear background media."));
    } finally {
      setUploadingBackgroundMedia(false);
    }
  }

  async function handleProfileFontInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = resolveProfileFontExtension(file);
    const inferredMimeType = resolveProfileFontMimeType(extension);
    const mimeType = (file.type.trim().toLowerCase() || inferredMimeType || "").toLowerCase();

    if (!mimeType || !ALLOWED_PROFILE_FONT_MIME_TYPES.has(mimeType)) {
      pushToast("error", "Unsupported font type. Use WOFF2, WOFF, TTF, or OTF.");
      event.target.value = "";
      return;
    }

    if (file.size > PROFILE_FONT_MAX_BYTES) {
      pushToast("error", "Font file must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadingProfileFont(true);

    try {
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(PROFILE_FONT_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(PROFILE_FONT_BUCKET).getPublicUrl(path);

      const inferredName = (file.name.split(".").slice(0, -1).join(".") || "Custom Font")
        .trim()
        .slice(0, 80);

      setProfileFontPreset("custom");
      setProfileCustomFontUrl(publicUrl);
      setProfileCustomFontName(inferredName || "Custom Font");
      pushToast("success", "Custom font uploaded. Save changes to publish.");
    } catch (error) {
      const message = asSafeError(error, "Could not upload custom font.");

      if (/bucket.*not found/i.test(message) || /not found/i.test(message)) {
        pushToast(
          "error",
          "Custom fonts are not ready yet. Run the latest Supabase migrations and try again.",
        );
      } else {
        pushToast("error", message);
      }
    } finally {
      setUploadingProfileFont(false);
      event.target.value = "";
    }
  }

  async function clearProfileCustomFont() {
    setUploadingProfileFont(true);

    try {
      const fontUrl = profileCustomFontUrl.trim();

      if (fontUrl) {
        const storagePath = getStoragePathFromPublicUrl(fontUrl, PROFILE_FONT_BUCKET);

        if (storagePath) {
          await supabase.storage.from(PROFILE_FONT_BUCKET).remove([storagePath]);
        }
      }

      setProfileCustomFontUrl("");
      setProfileCustomFontName("");
      if (profileFontPreset === "custom") {
        setProfileFontPreset("inter");
      }
      pushToast("success", "Custom font removed.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not clear custom font."));
    } finally {
      setUploadingProfileFont(false);
    }
  }

  async function handleEntryGateFontInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const extension = resolveProfileFontExtension(file);
    const inferredMimeType = resolveProfileFontMimeType(extension);
    const mimeType = (file.type.trim().toLowerCase() || inferredMimeType || "").toLowerCase();

    if (!mimeType || !ALLOWED_PROFILE_FONT_MIME_TYPES.has(mimeType)) {
      pushToast("error", "Unsupported font type. Use WOFF2, WOFF, TTF, or OTF.");
      event.target.value = "";
      return;
    }

    if (file.size > PROFILE_FONT_MAX_BYTES) {
      pushToast("error", "Font file must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadingEntryGateFont(true);

    try {
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(PROFILE_FONT_BUCKET).upload(path, file, {
        upsert: true,
        contentType: mimeType,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(PROFILE_FONT_BUCKET).getPublicUrl(path);

      const inferredName = (file.name.split(".").slice(0, -1).join(".") || "Entry Font")
        .trim()
        .slice(0, 80);

      setEntryGateFontPreset("custom");
      setEntryGateCustomFontUrl(publicUrl);
      setEntryGateCustomFontName(inferredName || "Entry Font");
      pushToast("success", "Entry screen font uploaded. Save changes to publish.");
    } catch (error) {
      const message = asSafeError(error, "Could not upload entry screen font.");

      if (/bucket.*not found/i.test(message) || /not found/i.test(message)) {
        pushToast(
          "error",
          "Custom fonts are not ready yet. Run the latest Supabase migrations and try again.",
        );
      } else {
        pushToast("error", message);
      }
    } finally {
      setUploadingEntryGateFont(false);
      event.target.value = "";
    }
  }

  async function clearEntryGateCustomFont() {
    setUploadingEntryGateFont(true);

    try {
      const fontUrl = entryGateCustomFontUrl.trim();

      if (fontUrl) {
        const storagePath = getStoragePathFromPublicUrl(fontUrl, PROFILE_FONT_BUCKET);

        if (storagePath) {
          await supabase.storage.from(PROFILE_FONT_BUCKET).remove([storagePath]);
        }
      }

      setEntryGateCustomFontUrl("");
      setEntryGateCustomFontName("");
      if (entryGateFontPreset === "custom") {
        setEntryGateFontPreset("inter");
      }
      pushToast("success", "Entry screen custom font removed.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not clear entry screen custom font."));
    } finally {
      setUploadingEntryGateFont(false);
    }
  }

  async function setCommentStatus(commentId: string, status: "published" | "hidden") {
    setCommentActionId(commentId);

    try {
      const { error } = await supabase
        .from("comments")
        .update({ status })
        .eq("id", commentId)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? { ...comment, status } : comment)),
      );
      pushToast("success", status === "hidden" ? "Comment hidden." : "Comment published.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Unable to update comment."));
    } finally {
      setCommentActionId(null);
    }
  }

  async function deleteComment(commentId: string) {
    setCommentActionId(commentId);

    try {
      const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", userId);

      if (error) {
        throw error;
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      pushToast("success", "Comment removed.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Unable to remove comment."));
    } finally {
      setCommentActionId(null);
    }
  }

  async function requestAi<Result>(action: AIAction, body: Record<string, unknown>): Promise<Result> {
    setAiError("");
    setAiLoading(action);

    try {
      if (!hasPremium) {
        const message = "AI Assist requires the Pro badge. Open a Discord ticket to upgrade.";
        setAiError(message);
        throw new Error(message);
      }

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        configured?: boolean;
        error?: string;
        result?: Result;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "AI request failed.");
      }

      if (typeof payload.configured === "boolean") {
        setAiConfigured(payload.configured);
      }

      return payload.result;
    } catch (error) {
      const message = asSafeError(error, "AI request failed.");
      setAiError(message);
      throw new Error(message);
    } finally {
      setAiLoading(null);
    }
  }

  async function runBioGenerator() {
    const parsed = aiBioGenerateSchema.safeParse({
      action: "bio-generate",
      vibe: aiVibe,
      interests: aiBioInterests,
      length: aiBioLength,
    });

    if (!parsed.success) {
      setAiError(parsed.error.issues[0]?.message ?? "Add your interests first.");
      return;
    }

    try {
      const result = await requestAi<{ options: string[] }>("bio-generate", parsed.data);
      setAiBioOptions(result.options);
    } catch {
      // handled in requestAi
    }
  }

  async function runLinkLabelHelper() {
    const parsed = aiLinkLabelSchema.safeParse({
      action: "link-label",
      vibe: aiVibe,
      url: withProtocol(aiLinkUrl),
    });

    if (!parsed.success) {
      setAiError(parsed.error.issues[0]?.message ?? "Add a valid URL.");
      return;
    }

    try {
      const result = await requestAi<{ title: string; description: string }>("link-label", parsed.data);
      setAiLinkTitle(result.title);
      setAiLinkDescription(result.description || "");
      setAiLinkUrl(parsed.data.url);
    } catch {
      // handled in requestAi
    }
  }

  async function runBioPolish() {
    const parsed = aiBioPolishSchema.safeParse({
      action: "bio-polish",
      vibe: aiVibe,
      bio: aiPolishInput,
    });

    if (!parsed.success) {
      setAiError(parsed.error.issues[0]?.message ?? "Add at least a short bio to polish.");
      return;
    }

    try {
      const result = await requestAi<{ minimal: string; expressive: string }>("bio-polish", parsed.data);
      setAiPolishMinimal(result.minimal);
      setAiPolishExpressive(result.expressive);
    } catch {
      // handled in requestAi
    }
  }

  function applyAiLinkSuggestion() {
    if (!aiLinkTitle.trim() || !aiLinkUrl.trim()) {
      return;
    }

    const targetId = aiLinkTargetId;

    if (!targetId) {
      const created = emptyLink(userId, links.length);
      const nextUrl = withProtocol(aiLinkUrl);
      const nextLink: LinkRow = {
        ...created,
        title: aiLinkTitle.trim(),
        url: nextUrl,
        description: aiLinkDescription.trim() || null,
        icon: resolveLinkIconValue(nextUrl, null),
      };
      setLinks((prev) => [...prev, nextLink]);
      pushToast("success", "New link generated from AI suggestion.");
      return;
    }

    setLinks((prev) =>
      prev.map((link) =>
        link.id === targetId
          ? {
              ...link,
              title: aiLinkTitle.trim(),
              url: withProtocol(aiLinkUrl),
              description: aiLinkDescription.trim() || null,
              icon: resolveLinkIconValue(withProtocol(aiLinkUrl), link.icon),
            }
          : link,
      ),
    );

    pushToast("success", "AI suggestion applied to link.");
  }

  async function connectDiscordIdentity() {
    setDiscordLinking(true);

    try {
      window.location.assign("/api/integrations/discord/connect");
    } catch (error) {
      pushToast("error", asSafeError(error, "Unable to connect Discord right now."));
      setDiscordLinking(false);
    }
  }

  async function disconnectDiscordIdentity() {
    setDiscordDisconnecting(true);

    try {
      const response = await fetch("/api/integrations/discord/disconnect", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to disconnect Discord.");
      }

      setDiscordUserId("");
      setDiscordPresenceEnabled(false);
      pushToast("success", "Discord disconnected.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Unable to disconnect Discord."));
    } finally {
      setDiscordDisconnecting(false);
    }
  }

  async function saveAll() {
    setSaving(true);

    try {
      const normalizedBackgroundValue = backgroundValue.trim();

      if (backgroundMode === "image" && !normalizedBackgroundValue) {
        throw new Error("Upload background media or paste a media URL before saving.");
      }

      const resolvedBackgroundValue = backgroundMode === "theme" ? null : normalizedBackgroundValue;
      const resolvedEntryGateCustomFontUrl = entryGateFontPreset === "custom"
        ? (entryGateCustomFontUrl.trim() || null)
        : null;
      const resolvedEntryGateCustomFontName = entryGateFontPreset === "custom"
        ? (entryGateCustomFontName.trim() || null)
        : null;

      const parsedProfile = profileUpdateSchema.safeParse({
        handle: profile.handle,
        displayName: displayName.trim() || "Creator",
        bio: bio.trim(),
        theme,
        layout,
        template,
        colorAccent: colorAccent.trim() ? colorAccent.trim() : null,
        richText,
        badges: profileBadges,
        profileAnimation,
        profileEffect,
        linkStyle,
        linkEffect,
        linkIconTint: linkIconTint.trim() ? linkIconTint.trim() : null,
        avatarShape,
        heroAlign,
        backgroundMode,
        backgroundValue: resolvedBackgroundValue,
        backgroundEffect,
        discordPresenceEnabled,
        discordUserId: discordUserId.trim() || null,
        discordShowActivity,
        commentsEnabled,
        isPublic,
        showViewCount,
        avatarFloat,
        entryGateEnabled,
        entryGateText: entryGateText.trim() || "Click",
        entryGateTextColor: entryGateTextColor.trim(),
        entryGateBackgroundColor: entryGateBackgroundColor.trim(),
        entryGateBackgroundOpacity: sanitizeEntryGateBackgroundOpacity(entryGateBackgroundOpacity),
        entryGateBackgroundBlurPx: sanitizeEntryGateBackgroundBlur(entryGateBackgroundBlurPx),
        entryGateFontSize,
        entryGateFontWeight,
        entryGateFontPreset,
        entryGateCustomFontUrl: resolvedEntryGateCustomFontUrl,
        entryGateCustomFontName: resolvedEntryGateCustomFontName,
        profileFontPreset,
        profileCustomFontUrl: profileCustomFontUrl.trim() || null,
        profileCustomFontName: profileCustomFontName.trim() || null,
        nameEffect,
      });

      if (!parsedProfile.success) {
        throw new Error(parsedProfile.error.issues[0]?.message ?? "Invalid profile fields.");
      }

      const effectiveIsPublic = profile.is_banned ? false : parsedProfile.data.isPublic;
      const effectiveCommentsEnabled = profile.is_banned ? false : parsedProfile.data.commentsEnabled;

      const preparedLinks = normalizeSortOrder(links).map((link, index) => ({
        id: link.id,
        user_id: userId,
        title: link.title,
        url: withProtocol(link.url),
        description: link.description || null,
        icon: resolveLinkIconValue(withProtocol(link.url), link.icon) || null,
        sort_order: index,
        clicks: link.clicks ?? 0,
      }));

      for (const item of preparedLinks) {
        const parsedLink = linkInputSchema.safeParse({
          id: item.id,
          title: item.title,
          url: item.url,
          description: item.description,
          icon: item.icon,
          sortOrder: item.sort_order,
        });

        if (!parsedLink.success) {
          throw new Error(parsedLink.error.issues[0]?.message ?? "Invalid link fields.");
        }
      }

      const preparedTracks = normalizeSortOrder(tracks).map((track, index) => ({
        id: track.id,
        user_id: userId,
        title: track.title,
        embed_url: withProtocol(track.embed_url),
        sort_order: index,
        is_active: track.is_active,
      }));

      for (const item of preparedTracks) {
        const parsedTrack = musicTrackInputSchema.safeParse({
          id: item.id,
          title: item.title,
          embedUrl: item.embed_url,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        });

        if (!parsedTrack.success) {
          throw new Error(parsedTrack.error.issues[0]?.message ?? "Invalid music fields.");
        }
      }

      const preparedWidgets = normalizeSortOrder(widgets).map((widget, index) => ({
        id: widget.id,
        user_id: userId,
        widget_type: widget.widget_type,
        title: widget.title,
        value: widget.value || null,
        source_url: widget.source_url ? withProtocol(widget.source_url) : null,
        sort_order: index,
        is_active: widget.is_active,
      }));

      for (const item of preparedWidgets) {
        const parsedWidget = widgetInputSchema.safeParse({
          id: item.id,
          widgetType: item.widget_type,
          title: item.title,
          value: item.value,
          sourceUrl: item.source_url,
          sortOrder: item.sort_order,
          isActive: item.is_active,
        });

        if (!parsedWidget.success) {
          throw new Error(parsedWidget.error.issues[0]?.message ?? "Invalid widget fields.");
        }
      }

      const profileUpdates: Record<string, unknown> = {
        display_name: parsedProfile.data.displayName,
        bio: parsedProfile.data.bio || null,
        avatar_url: avatarUrl.trim() || null,
        theme: parsedProfile.data.theme,
        layout: parsedProfile.data.layout,
        template: parsedProfile.data.template,
        color_accent: parsedProfile.data.colorAccent || null,
        rich_text: parsedProfile.data.richText,
        badges: profileBadges,
        profile_animation: parsedProfile.data.profileAnimation,
        profile_effect: parsedProfile.data.profileEffect,
        link_style: parsedProfile.data.linkStyle,
        link_effect: parsedProfile.data.linkEffect,
        link_icon_tint: parsedProfile.data.linkIconTint || null,
        avatar_shape: parsedProfile.data.avatarShape,
        hero_align: parsedProfile.data.heroAlign,
        background_mode: parsedProfile.data.backgroundMode,
        background_value:
          parsedProfile.data.backgroundMode === "theme"
            ? null
            : (parsedProfile.data.backgroundValue as string),
        background_effect: parsedProfile.data.backgroundEffect,
        discord_presence_enabled: parsedProfile.data.discordPresenceEnabled,
        discord_user_id: parsedProfile.data.discordUserId || null,
        discord_show_activity: parsedProfile.data.discordShowActivity,
        comments_enabled: effectiveCommentsEnabled,
        is_public: effectiveIsPublic,
        show_view_count: parsedProfile.data.showViewCount,
        avatar_float: parsedProfile.data.avatarFloat,
        entry_gate_enabled: parsedProfile.data.entryGateEnabled,
        entry_gate_text: parsedProfile.data.entryGateText,
        entry_gate_text_color: parsedProfile.data.entryGateTextColor,
        entry_gate_background_color: parsedProfile.data.entryGateBackgroundColor,
        entry_gate_background_opacity: parsedProfile.data.entryGateBackgroundOpacity,
        entry_gate_background_blur_px: parsedProfile.data.entryGateBackgroundBlurPx,
        entry_gate_font_size: parsedProfile.data.entryGateFontSize,
        entry_gate_font_weight: parsedProfile.data.entryGateFontWeight,
        entry_gate_font_preset: parsedProfile.data.entryGateFontPreset,
        entry_gate_custom_font_url: parsedProfile.data.entryGateCustomFontUrl || null,
        entry_gate_custom_font_name: parsedProfile.data.entryGateCustomFontName || null,
        profile_font_preset: parsedProfile.data.profileFontPreset,
        profile_custom_font_url: parsedProfile.data.profileCustomFontUrl || null,
        profile_custom_font_name: parsedProfile.data.profileCustomFontName || null,
        name_effect: parsedProfile.data.nameEffect,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", userId);

      if (profileError) {
        const profileErrorMessage = profileError.message.toLowerCase();

        if (
          profileErrorMessage.includes("profiles_banned_public_check")
          || profileErrorMessage.includes("profiles_banned_comments_check")
        ) {
          throw new Error("Your account is currently banned. Public visibility and comments cannot be enabled.");
        }

        if (
          profileErrorMessage.includes("profiles_profile_effect_check")
          || profileErrorMessage.includes("profiles_background_effect_check")
          || profileErrorMessage.includes("profiles_premium_visuals_check")
          || profileErrorMessage.includes("profiles_premium_cursor_check")
          || profileErrorMessage.includes("profiles_discord_user_id_check")
          || profileErrorMessage.includes("profiles_profile_font_preset_check")
          || profileErrorMessage.includes("profiles_name_effect_check")
          || profileErrorMessage.includes("profiles_link_effect_check")
          || profileErrorMessage.includes("profiles_link_icon_tint_check")
          || profileErrorMessage.includes("profiles_entry_gate_background_opacity_check")
          || profileErrorMessage.includes("profiles_entry_gate_background_blur_px_check")
          || profileErrorMessage.includes("entry_gate_background_opacity")
          || profileErrorMessage.includes("entry_gate_background_blur_px")
          || profileErrorMessage.includes("link_effect")
          || profileErrorMessage.includes("link_icon_tint")
          || profileErrorMessage.includes("show_view_count")
        ) {
          throw new Error("Some profile options are unavailable until the latest database migration is applied.");
        }

        if (profileError.message.toLowerCase().includes("duplicate")) {
          throw new Error("That handle is already taken.");
        }

        throw profileError;
      }

      const { error: linkUpsertError } = await supabase
        .from("links")
        .upsert(preparedLinks, { onConflict: "id" });

      if (linkUpsertError) {
        throw linkUpsertError;
      }

      const nextLinkIds = new Set(preparedLinks.map((item) => item.id));
      const removedLinkIds = [...savedLinkIdsRef.current].filter((id) => !nextLinkIds.has(id));

      if (removedLinkIds.length) {
        const { error: deleteLinksError } = await supabase
          .from("links")
          .delete()
          .eq("user_id", userId)
          .in("id", removedLinkIds);

        if (deleteLinksError) {
          throw deleteLinksError;
        }
      }

      savedLinkIdsRef.current = nextLinkIds;

      const { error: trackUpsertError } = await supabase
        .from("music_tracks")
        .upsert(preparedTracks, { onConflict: "id" });

      if (trackUpsertError) {
        throw trackUpsertError;
      }

      const nextTrackIds = new Set(preparedTracks.map((item) => item.id));
      const removedTrackIds = [...savedTrackIdsRef.current].filter((id) => !nextTrackIds.has(id));

      if (removedTrackIds.length) {
        const { error: deleteTracksError } = await supabase
          .from("music_tracks")
          .delete()
          .eq("user_id", userId)
          .in("id", removedTrackIds);

        if (deleteTracksError) {
          throw deleteTracksError;
        }
      }

      savedTrackIdsRef.current = nextTrackIds;

      const { error: widgetUpsertError } = await supabase
        .from("widgets")
        .upsert(preparedWidgets, { onConflict: "id" });

      if (widgetUpsertError) {
        throw widgetUpsertError;
      }

      const nextWidgetIds = new Set(preparedWidgets.map((item) => item.id));
      const removedWidgetIds = [...savedWidgetIdsRef.current].filter((id) => !nextWidgetIds.has(id));

      if (removedWidgetIds.length) {
        const { error: deleteWidgetsError } = await supabase
          .from("widgets")
          .delete()
          .eq("user_id", userId)
          .in("id", removedWidgetIds);

        if (deleteWidgetsError) {
          throw deleteWidgetsError;
        }
      }

      savedWidgetIdsRef.current = nextWidgetIds;

      setLinks((prev) =>
        preparedLinks.map((item) => ({
          ...item,
          created_at: prev.find((row) => row.id === item.id)?.created_at ?? new Date().toISOString(),
        })),
      );
      setTracks((prev) =>
        preparedTracks.map((item) => ({
          ...item,
          created_at: prev.find((row) => row.id === item.id)?.created_at ?? new Date().toISOString(),
        })),
      );
      setWidgets((prev) =>
        preparedWidgets.map((item) => ({
          ...item,
          created_at: prev.find((row) => row.id === item.id)?.created_at ?? new Date().toISOString(),
        })),
      );

      setDisplayName(parsedProfile.data.displayName);
      setBio(parsedProfile.data.bio);
      setRichText(parsedProfile.data.richText);
      setTheme(parsedProfile.data.theme);
      setLayout(parsedProfile.data.layout);
      setTemplate(parsedProfile.data.template);
      setColorAccent(parsedProfile.data.colorAccent || "");
      setProfileAnimation(parsedProfile.data.profileAnimation);
      setProfileEffect(parsedProfile.data.profileEffect);
      setLinkStyle(parsedProfile.data.linkStyle);
      setLinkEffect(parsedProfile.data.linkEffect);
      setLinkIconTint(parsedProfile.data.linkIconTint || "");
      setAvatarShape(parsedProfile.data.avatarShape);
      setHeroAlign(parsedProfile.data.heroAlign);
      setBackgroundMode(parsedProfile.data.backgroundMode);
      setBackgroundValue(
        parsedProfile.data.backgroundMode === "theme"
          ? ""
          : (parsedProfile.data.backgroundValue as string),
      );
      setBackgroundEffect(parsedProfile.data.backgroundEffect);
      setDiscordPresenceEnabled(parsedProfile.data.discordPresenceEnabled);
      setDiscordUserId(parsedProfile.data.discordUserId || "");
      setDiscordShowActivity(parsedProfile.data.discordShowActivity);
      setCommentsEnabled(effectiveCommentsEnabled);
      setIsPublic(effectiveIsPublic);
      setShowViewCount(parsedProfile.data.showViewCount);
      setAvatarFloat(parsedProfile.data.avatarFloat);
      setEntryGateEnabled(parsedProfile.data.entryGateEnabled);
      setEntryGateText(parsedProfile.data.entryGateText);
      setEntryGateTextColor(parsedProfile.data.entryGateTextColor);
      setEntryGateBackgroundColor(parsedProfile.data.entryGateBackgroundColor);
      setEntryGateBackgroundOpacity(parsedProfile.data.entryGateBackgroundOpacity);
      setEntryGateBackgroundBlurPx(parsedProfile.data.entryGateBackgroundBlurPx);
      setEntryGateFontSize(parsedProfile.data.entryGateFontSize);
      setEntryGateFontWeight(parsedProfile.data.entryGateFontWeight);
      setEntryGateFontPreset(parsedProfile.data.entryGateFontPreset);
      setEntryGateCustomFontUrl(parsedProfile.data.entryGateCustomFontUrl || "");
      setEntryGateCustomFontName(parsedProfile.data.entryGateCustomFontName || "");
      setProfileFontPreset(parsedProfile.data.profileFontPreset);
      setProfileCustomFontUrl(parsedProfile.data.profileCustomFontUrl || "");
      setProfileCustomFontName(parsedProfile.data.profileCustomFontName || "");
      setNameEffect(parsedProfile.data.nameEffect);

      const savedSnapshot = buildEditorSnapshot({
        profile: {
          displayName: parsedProfile.data.displayName,
          handle: profile.handle,
          bio: parsedProfile.data.bio,
          richText: parsedProfile.data.richText,
          theme: parsedProfile.data.theme,
          layout: parsedProfile.data.layout,
          template: parsedProfile.data.template,
          colorAccent: parsedProfile.data.colorAccent || "",
          profileAnimation: parsedProfile.data.profileAnimation,
          profileEffect: parsedProfile.data.profileEffect,
          linkStyle: parsedProfile.data.linkStyle,
          linkEffect: parsedProfile.data.linkEffect,
          linkIconTint: parsedProfile.data.linkIconTint || "",
          avatarShape: parsedProfile.data.avatarShape,
          heroAlign: parsedProfile.data.heroAlign,
          backgroundMode: parsedProfile.data.backgroundMode,
          backgroundValue:
            parsedProfile.data.backgroundMode === "theme"
              ? ""
              : (parsedProfile.data.backgroundValue as string),
          backgroundEffect: parsedProfile.data.backgroundEffect,
          avatarFloat: parsedProfile.data.avatarFloat,
          commentsEnabled: effectiveCommentsEnabled,
          isPublic: effectiveIsPublic,
          showViewCount: parsedProfile.data.showViewCount,
          discordPresenceEnabled: parsedProfile.data.discordPresenceEnabled,
          discordUserId: parsedProfile.data.discordUserId || "",
          discordShowActivity: parsedProfile.data.discordShowActivity,
          entryGateEnabled: parsedProfile.data.entryGateEnabled,
          entryGateText: parsedProfile.data.entryGateText,
          entryGateTextColor: parsedProfile.data.entryGateTextColor,
          entryGateBackgroundColor: parsedProfile.data.entryGateBackgroundColor,
          entryGateBackgroundOpacity: parsedProfile.data.entryGateBackgroundOpacity,
          entryGateBackgroundBlurPx: parsedProfile.data.entryGateBackgroundBlurPx,
          entryGateFontSize: parsedProfile.data.entryGateFontSize,
          entryGateFontWeight: parsedProfile.data.entryGateFontWeight,
          entryGateFontPreset: parsedProfile.data.entryGateFontPreset,
          entryGateCustomFontUrl: parsedProfile.data.entryGateCustomFontUrl || "",
          entryGateCustomFontName: parsedProfile.data.entryGateCustomFontName || "",
          profileFontPreset: parsedProfile.data.profileFontPreset,
          profileCustomFontUrl: parsedProfile.data.profileCustomFontUrl || "",
          profileCustomFontName: parsedProfile.data.profileCustomFontName || "",
          nameEffect: parsedProfile.data.nameEffect,
        },
        links: preparedLinks,
        tracks: preparedTracks,
        widgets: preparedWidgets,
      });

      setLastSavedSnapshot(savedSnapshot);
      setLastSavedAt(new Date().toISOString());
      pushToast("success", "Changes saved.");
    } catch (error) {
      pushToast("error", asSafeError(error, "Could not save changes."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative lg:h-[calc(100vh-2.5rem)] lg:overflow-hidden">
      <div className="grid gap-8 xl:gap-10 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(440px,700px)]">
        <section className="scrollbar-hidden space-y-10 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-28 xl:space-y-12 xl:pr-4">
          <div className="panel relative overflow-hidden p-8 sm:p-10">
            <div className="pointer-events-none absolute left-1/2 top-[-138px] h-[280px] w-[72%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_72%)]" />
            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-[720px]">
                <p className="section-kicker">Editor Workspace</p>
                <h1 className="mt-4 text-[clamp(2.25rem,4.8vw,3.25rem)] leading-[1.03] font-semibold tracking-tight text-white">
                  Premium profile builder
                </h1>
                <p className="mt-3 max-w-[64ch] text-sm leading-relaxed text-[#9faba4]">
                  Edit one focused section at a time and validate your changes in the persistent live preview.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary inline-flex h-11 items-center gap-2 px-4"
                onClick={saveAll}
                disabled={!hasUnsavedChanges || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>

          <div className="panel p-3.5">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.03]"
              onClick={() => setStatusPanelOpen((prev) => !prev)}
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[#8e9993]">Status</p>
                <p className="mt-1 text-sm text-[#d2ddd8]">{statusSummary}</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-[#8e9993] transition ${statusPanelOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence initial={false}>
              {statusPanelOpen ? (
                <motion.div
                  className="space-y-4 pt-4"
                  initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={profileSectionTransition}
                >
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-xl border border-white/8 bg-black/22 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8e9993]">Status</p>
                      <p className={`mt-1.5 text-sm font-medium ${hasUnsavedChanges ? "text-[#e5c797]" : "text-[#d9e1dc]"}`}>
                        {saving ? "Saving..." : hasUnsavedChanges ? "Unsaved" : "Saved"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/22 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8e9993]">Visibility</p>
                      <p className="mt-1.5 text-sm font-medium text-[#d9e1dc]">{isPublic ? "Public" : "Private"}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/22 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8e9993]">Links</p>
                      <p className="mt-1.5 text-sm font-medium text-[#d9e1dc]">{links.length}</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-black/22 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[#8e9993]">Last updated</p>
                      <p className="mt-1.5 text-sm font-medium text-[#d9e1dc]">{formatLastUpdated(lastSavedAt)}</p>
                    </div>
                  </div>

                  {profile.is_banned ? (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      <p className="font-medium">Account status: banned</p>
                      <p className="mt-1 text-xs text-red-100/90">
                        Reason: {profile.banned_reason?.trim() || "No reason provided."}
                      </p>
                    </div>
                  ) : null}

                  {visibleAdminNotices.length ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-500/[0.07] px-4 py-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-amber-100/80">Moderation notice</p>
                        <p className="mt-1 text-sm text-amber-50">
                          {formatModerationAction(visibleAdminNotices[0].action_type)}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-amber-100/80">
                          {visibleAdminNotices[0].reason || "No reason provided."}
                        </p>
                        {visibleAdminNotices.length > 1 ? (
                          <p className="mt-1 text-xs text-amber-100/70">
                            {visibleAdminNotices.length - 1} more recent notice{visibleAdminNotices.length - 1 === 1 ? "" : "s"}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-amber-200/20 bg-amber-200/10 text-amber-100 transition hover:bg-amber-200/20"
                        onClick={() =>
                          setDismissedNoticeIds((prev) => [...prev, visibleAdminNotices[0].id])
                        }
                        aria-label="Dismiss moderation notice"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="panel sticky top-6 z-20 p-3.5">
            <LayoutGroup id="editor-tabs">
              <div className="relative flex flex-wrap items-center gap-1 rounded-2xl border border-white/8 bg-black/24 p-1.5">
                {TAB_ITEMS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isProOnlyTab = Boolean(tab.proOnly);
                  const isLocked = isProOnlyTab && !hasPremium;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className={`relative rounded-xl px-3.5 py-2 text-[13px] font-medium tracking-tight transition ${
                        isActive
                          ? "text-white"
                          : isLocked
                            ? "text-[#8f8c85] hover:bg-white/4 hover:text-[#d8d2c8]"
                            : "text-[#9ca59f] hover:bg-white/4 hover:text-[#dde4df]"
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {isActive ? (
                        <>
                          <motion.span
                            layoutId="editor-tab-indicator"
                            className="absolute inset-0 rounded-xl border border-white/12 bg-white/[0.08]"
                            transition={tabIndicatorTransition}
                          />
                          <motion.span
                            layoutId="editor-tab-underline"
                            className="absolute inset-x-3 bottom-0 h-px bg-[var(--accent-strong)]"
                            transition={tabIndicatorTransition}
                          />
                        </>
                      ) : null}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        {tab.label}
                        {isLocked ? (
                          <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-200">
                            Pro
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === "profile" ? (
              <motion.section key="tab-profile" className="space-y-8" {...tabTransition(reduceMotion)}>
                <div className="panel space-y-7 p-8 sm:p-9">
                  <div>
                    <h2 className="text-[1.22rem] font-semibold tracking-tight text-white">Profile</h2>
                    <p className="mt-1 text-sm text-[#95a19b]">
                      Primary identity fields and long-form copy for your public profile.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/8 bg-black/22">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                        onClick={() => setActiveProfileSection("identity")}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">Identity</p>
                          <p className="mt-1 text-xs text-[#8f9c97]">
                            Avatar: {avatarUrl ? "Set" : "Missing"} · Handle @{profile.handle.replace(/^@+/, "")}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-[#8f9c97] transition ${
                            activeProfileSection === "identity" ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {activeProfileSection === "identity" ? (
                          <motion.div
                            className="space-y-6 border-t border-white/8 px-5 py-5"
                            initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            transition={profileSectionTransition}
                          >
                            <div className="rounded-[14px] border border-white/8 bg-black/20 p-4">
                              <div className="flex flex-wrap items-center gap-4">
                                {avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={avatarUrl}
                                    alt="Avatar"
                                    className="h-16 w-16 rounded-full border border-white/14 object-cover"
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-full border border-white/14 bg-gradient-to-b from-[#252d2b] to-[#151a1d]" />
                                )}

                                <div className="min-w-[220px] flex-1">
                                  <p className="text-[11px] uppercase tracking-[0.14em] text-[#88938e]">Avatar</p>
                                  <p className="mt-1 text-sm text-[#d6ddd9]">Recommended: square image, 512x512 minimum.</p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <label className="btn btn-secondary cursor-pointer">
                                    {uploadingAvatar ? "Uploading..." : "Upload"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={handleAvatarInput}
                                      disabled={uploadingAvatar}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                      void clearAvatar();
                                    }}
                                    disabled={uploadingAvatar || !avatarUrl}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-2">
                              <label className="space-y-3">
                                <span className="text-[11px] uppercase tracking-[0.14em] text-[#88938e]">Display name</span>
                                <input
                                  className="input"
                                  value={displayName}
                                  onChange={(event) => setDisplayName(event.target.value)}
                                  placeholder="Your public name"
                                  maxLength={50}
                                />
                                <p className="text-xs text-[#8b9892]">Shown as your primary heading.</p>
                              </label>

                              <label className="space-y-3">
                                <span className="text-[11px] uppercase tracking-[0.14em] text-[#88938e]">Handle</span>
                                <div className="input flex items-center gap-2 py-0 pr-3">
                                  <span className="text-[#8d9994]">@</span>
                                  <input
                                    className="w-full bg-transparent py-3 text-sm outline-none"
                                    value={profile.handle}
                                    readOnly
                                    maxLength={20}
                                  />
                                </div>
                                <p className="text-xs text-[#8b9892]">To change your handle, use Settings.</p>
                              </label>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/22">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                        onClick={() => setActiveProfileSection("bio")}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">Bio</p>
                          <p className="mt-1 text-xs text-[#8f9c97]">Bio: {bio.length}/240</p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-[#8f9c97] transition ${
                            activeProfileSection === "bio" ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {activeProfileSection === "bio" ? (
                          <motion.div
                            className="space-y-3 border-t border-white/8 px-5 py-5"
                            initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            transition={profileSectionTransition}
                          >
                            <textarea
                              className="input min-h-28 resize-y"
                              value={bio}
                              onChange={(event) => setBio(event.target.value)}
                              placeholder="One clear sentence about what you do."
                              maxLength={240}
                            />
                            <p className="flex justify-between text-xs text-[#8b9892]">
                              <span>Keep it concise and readable.</span>
                              <span>{bio.length}/240</span>
                            </p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/22">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                        onClick={() => setActiveProfileSection("rich-text")}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">Rich text body</p>
                          <p className="mt-1 text-xs text-[#8f9c97]">
                            {richText.trim() ? `Rich text: ${richText.trim().length} chars` : "Rich text: Empty"}
                          </p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-[#8f9c97] transition ${
                            activeProfileSection === "rich-text" ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {activeProfileSection === "rich-text" ? (
                          <motion.div
                            className="space-y-4 border-t border-white/8 px-5 py-5"
                            initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            transition={profileSectionTransition}
                          >
                            <textarea
                              className="input min-h-48 resize-y"
                              value={richText}
                              onChange={(event) => setRichText(event.target.value)}
                              placeholder="## About&#10;Write in short sections.&#10;- Bullet points&#10;- [Links](https://example.com)"
                              maxLength={3200}
                            />

                            {!richText.trim() ? (
                              <p className="rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-[#8f9c97]">
                                Add your richer story, recent work, or a short manifesto.
                              </p>
                            ) : null}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-black/22">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                        onClick={() => setActiveProfileSection("badges")}
                      >
                        <div>
                          <p className="text-sm font-medium text-white">Assigned badges</p>
                          <p className="mt-1 text-xs text-[#8f9c97]">Badges: {profileBadges.length}</p>
                        </div>
                        <ChevronDown
                          className={`h-4 w-4 text-[#8f9c97] transition ${
                            activeProfileSection === "badges" ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {activeProfileSection === "badges" ? (
                          <motion.div
                            className="space-y-3 border-t border-white/8 px-5 py-5"
                            initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                            transition={profileSectionTransition}
                          >
                            <p className="text-sm text-[#95a19b]">
                              Platform-managed badges only. They cannot be self-assigned.
                            </p>

                            {profileBadges.length ? (
                              <div className="flex flex-wrap gap-2">
                                {profileBadges.map((badge) => {
                                  const badgeOption = BADGE_OPTIONS.find((option) => option.value === badge);

                                  return (
                                    <BadgeChip
                                      key={badge}
                                      label={badgeOption?.label ?? badge}
                                      description={badgeOption?.description ?? ""}
                                      icon={badgeIcon[badge]}
                                      className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/22 px-3 py-1.5 text-xs text-[#d3ddd9] transition hover:border-white/24 hover:bg-black/36 focus-visible:border-white/24 focus-visible:bg-black/36 focus-visible:outline-none"
                                      tooltipClassName="max-w-[260px] text-xs"
                                    />
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-[#8f9c97]">
                                No badges assigned yet.
                              </p>
                            )}
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {activeTab === "links" ? (
              <motion.section key="tab-links" className="space-y-5" {...tabTransition(reduceMotion)}>
                <div className="panel space-y-5 p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Links</h2>
                      <p className="mt-1 text-sm text-[#a79c8d]">Drag to reorder. Cards mirror your public style.</p>
                    </div>
                    <button type="button" className="btn btn-primary inline-flex items-center gap-2" onClick={addLink}>
                      <Plus className="h-4 w-4" />
                      Add link
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/18 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9f9688]">Quick actions</p>
                    <button type="button" className="btn btn-secondary" onClick={sortLinksAlphabetically}>
                      Sort A-Z
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={reverseLinksOrder}>
                      Reverse
                    </button>
                  </div>

                  {!links.length ? (
                    <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-[#9aa3b6]">
                      No links yet. Add your first destination.
                    </p>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={links}
                      onReorder={reorderLinks}
                      className="space-y-3"
                    >
                      {links.map((link) => (
                        <Reorder.Item
                          key={link.id}
                          value={link}
                          className="rounded-2xl border border-white/10 bg-[#141a27]/82 px-4 py-3 shadow-[0_20px_52px_-40px_black]"
                          whileDrag={reduceMotion ? undefined : { scale: 1.01 }}
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="cursor-grab rounded-lg border border-white/10 bg-black/20 p-2 text-[#93a0b5]"
                              aria-label="Drag link"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>

                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/20">
                              <SiteLinkIcon
                                url={link.url}
                                icon={link.icon}
                                iconTint={linkIconTint.trim() || null}
                                alt={`${link.title} icon`}
                                className="flex h-4 w-4 items-center justify-center"
                                imgClassName="h-4 w-4 object-contain"
                                textClassName="text-[11px] text-[#d9d2c8]"
                                fallbackClassName="h-2.5 w-2.5 rounded-full bg-white/30"
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{link.title}</p>
                              <p className="truncate text-xs text-[#9aa4b7]">
                                {link.description || "No description"}
                              </p>
                            </div>

                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openLinkDraft(link)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary inline-flex items-center gap-1"
                              onClick={() => removeLink(link.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Remove
                            </button>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                </div>
              </motion.section>
            ) : null}

            {activeTab === "appearance" ? (
              <motion.section key="tab-appearance" className="space-y-6" {...tabTransition(reduceMotion)}>
                <div className="panel space-y-5 p-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Appearance</h2>
                    <p className="mt-1 text-sm text-[#95a19b]">
                      One section at a time. Pick what to edit, keep everything else collapsed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        activeAppearanceSection === "theme"
                          ? "border-white/14 bg-white/[0.08] text-white"
                          : "border-white/8 bg-black/20 text-[#c1cbc6] hover:border-white/14 hover:bg-black/30"
                      }`}
                      onClick={() => setActiveAppearanceSection("theme")}
                    >
                      <span className="text-sm font-medium">Theme & Typography</span>
                      <span className="text-xs text-[#8f9c97]">{getEditorThemeName(theme)} · {template}</span>
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        activeAppearanceSection === "entry"
                          ? "border-white/14 bg-white/[0.08] text-white"
                          : "border-white/8 bg-black/20 text-[#c1cbc6] hover:border-white/14 hover:bg-black/30"
                      }`}
                      onClick={() => setActiveAppearanceSection("entry")}
                    >
                      <span className="text-sm font-medium">Entry Screen</span>
                      <span className="text-xs text-[#8f9c97]">{entryGateEnabled ? `On · "${entryGateText}"` : "Off"}</span>
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        activeAppearanceSection === "style"
                          ? "border-white/14 bg-white/[0.08] text-white"
                          : "border-white/8 bg-black/20 text-[#c1cbc6] hover:border-white/14 hover:bg-black/30"
                      }`}
                      onClick={() => setActiveAppearanceSection("style")}
                    >
                      <span className="text-sm font-medium">Style Controls</span>
                      <span className="text-xs text-[#8f9c97]">{profileEffect} · {linkStyle}/{linkEffect}</span>
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        activeAppearanceSection === "background"
                          ? "border-white/14 bg-white/[0.08] text-white"
                          : "border-white/8 bg-black/20 text-[#c1cbc6] hover:border-white/14 hover:bg-black/30"
                      }`}
                      onClick={() => setActiveAppearanceSection("background")}
                    >
                      <span className="text-sm font-medium">Background</span>
                      <span className="text-xs text-[#8f9c97]">{backgroundMode} · {backgroundEffect}</span>
                    </button>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        activeAppearanceSection === "visibility"
                          ? "border-white/14 bg-white/[0.08] text-white"
                          : "border-white/8 bg-black/20 text-[#c1cbc6] hover:border-white/14 hover:bg-black/30"
                      }`}
                      onClick={() => setActiveAppearanceSection("visibility")}
                    >
                      <span className="text-sm font-medium">Visibility</span>
                      <span className="text-xs text-[#8f9c97]">
                        {isPublic ? "Public" : "Private"} · Comments {commentsEnabled ? "On" : "Off"}
                      </span>
                    </button>
                  </div>
                </div>

                {activeAppearanceSection === "theme" ? (
                  <div className="panel space-y-6 p-7">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Theme & Typography</h3>
                    <p className="mt-1 text-sm text-[#a79c8d]">
                      Theme, spacing, and typography presets with restrained motion controls.
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Theme preset</span>
                      <select
                        className="input py-3"
                        value={theme}
                        onChange={(event) => setTheme(event.target.value as ThemeName)}
                      >
                        {THEME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {getEditorThemeName(option.value)}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">Muted accents only, no neon.</p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Typography preset</span>
                      <select
                        className="input py-3"
                        value={template}
                        onChange={(event) => {
                          const next = event.target.value as TemplateName;
                          setTemplate(next);

                          const preset = TEMPLATE_PRESETS.find((item) => item.value === next);
                          if (preset) {
                            setTheme(preset.theme);
                            setLayout(preset.layout);
                            setColorAccent(preset.colorAccent);
                          }
                        }}
                      >
                        {TEMPLATE_PRESETS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">Sets heading/body rhythm for your profile.</p>
                    </label>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-sm text-[#ddd6cb]">Layout source</p>
                      <p className="text-xs text-[#9f9588]">
                        Layout structure is managed directly in this Appearance workspace.
                      </p>
                      <p className="text-xs text-[#b6ab9d]">
                        Current: <span className="text-white">{layout}</span> layout /{" "}
                        <span className="text-white">{template}</span> template
                      </p>
                    </div>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Accent color</span>
                      <input
                        className="input py-3"
                        value={colorAccent}
                        onChange={(event) => setColorAccent(event.target.value)}
                        placeholder="#8C96A8"
                      />
                      <p className="text-xs text-[#8f98ac]">Optional hex override. Leave blank for preset default.</p>
                    </label>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Profile font</span>
                      <select
                        className="input py-3"
                        value={profileFontPreset}
                        onChange={(event) => setProfileFontPreset(event.target.value as ProfileFontPreset)}
                      >
                        {PROFILE_FONT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {PROFILE_FONT_OPTIONS.find((option) => option.value === profileFontPreset)?.description}
                      </p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Name effect</span>
                      <select
                        className="input py-3"
                        value={nameEffect}
                        onChange={(event) => setNameEffect(event.target.value as NameEffect)}
                      >
                        {NAME_EFFECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {NAME_EFFECT_OPTIONS.find((option) => option.value === nameEffect)?.description}
                      </p>
                    </label>
                  </div>

                  {profileFontPreset === "custom" ? (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-[#ddd6cb]">Custom font upload</p>
                      <p className="text-xs text-[#8f98ac]">
                        Upload WOFF2/WOFF/TTF/OTF (max 2MB). This font applies to your public profile typography.
                      </p>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <input
                          className="input py-3"
                          value={profileCustomFontName}
                          onChange={(event) => setProfileCustomFontName(event.target.value)}
                          placeholder="Font display name"
                          maxLength={80}
                        />

                        <div className="flex flex-wrap gap-2">
                          <input
                            id="profile-font-upload"
                            type="file"
                            accept={PROFILE_FONT_ACCEPT}
                            className="hidden"
                            onChange={handleProfileFontInput}
                            disabled={uploadingProfileFont}
                          />
                          <label htmlFor="profile-font-upload" className="btn btn-secondary cursor-pointer">
                            {uploadingProfileFont ? "Uploading..." : "Upload font"}
                          </label>

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              void clearProfileCustomFont();
                            }}
                            disabled={uploadingProfileFont || !profileCustomFontUrl.trim()}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Custom font URL</span>
                        <input
                          className="input py-3"
                          value={profileCustomFontUrl}
                          onChange={(event) => setProfileCustomFontUrl(event.target.value)}
                          placeholder="https://.../profile-fonts/{userId}/font.woff2"
                        />
                      </label>
                    </div>
                  ) : null}
                  </div>
                ) : null}

                {activeAppearanceSection === "entry" ? (
                  <div className="panel space-y-5 p-7">
                  <h3 className="text-lg font-semibold text-white">Entry Screen</h3>
                  <p className="text-sm text-[#a79c8d]">
                    Optional click-to-reveal gate before profile content appears.
                  </p>

                  <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                    <span>Enable entry screen</span>
                    <input
                      type="checkbox"
                      checked={entryGateEnabled}
                      onChange={(event) => setEntryGateEnabled(event.target.checked)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </label>

                  {entryGateEnabled ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <label className="space-y-1.5 text-sm xl:col-span-2">
                        <span className="text-[#ddd6cb]">Entry text</span>
                        <input
                          className="input py-3"
                          value={entryGateText}
                          onChange={(event) => setEntryGateText(event.target.value)}
                          maxLength={32}
                          placeholder="Click"
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Text color</span>
                        <input
                          type="color"
                          className="input h-11 cursor-pointer p-1.5"
                          value={entryGateTextColor}
                          onChange={(event) => setEntryGateTextColor(event.target.value)}
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Background color</span>
                        <input
                          type="color"
                          className="input h-11 cursor-pointer p-1.5"
                          value={entryGateBackgroundColor}
                          onChange={(event) => setEntryGateBackgroundColor(event.target.value)}
                        />
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Background transparency</span>
                        <input
                          type="range"
                          min={ENTRY_GATE_BACKGROUND_OPACITY_MIN}
                          max={ENTRY_GATE_BACKGROUND_OPACITY_MAX}
                          step={1}
                          className="w-full accent-[var(--accent)]"
                          value={entryGateBackgroundOpacity}
                          onChange={(event) => {
                            setEntryGateBackgroundOpacity(
                              sanitizeEntryGateBackgroundOpacity(Number(event.target.value)),
                            );
                          }}
                        />
                        <p className="text-xs text-[#8f98ac]">
                          {entryGateBackgroundOpacity}% opacity (minimum {ENTRY_GATE_BACKGROUND_OPACITY_MIN}%)
                        </p>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Background blur</span>
                        <input
                          type="range"
                          min={ENTRY_GATE_BACKGROUND_BLUR_MIN}
                          max={ENTRY_GATE_BACKGROUND_BLUR_MAX}
                          step={1}
                          className="w-full accent-[var(--accent)]"
                          value={entryGateBackgroundBlurPx}
                          onChange={(event) => {
                            setEntryGateBackgroundBlurPx(
                              sanitizeEntryGateBackgroundBlur(Number(event.target.value)),
                            );
                          }}
                        />
                        <p className="text-xs text-[#8f98ac]">{entryGateBackgroundBlurPx}px blur</p>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Text size</span>
                        <select
                          className="input py-3"
                          value={entryGateFontSize}
                          onChange={(event) => setEntryGateFontSize(event.target.value as EntryGateFontSize)}
                        >
                          {ENTRY_GATE_FONT_SIZE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Text weight</span>
                        <select
                          className="input py-3"
                          value={entryGateFontWeight}
                          onChange={(event) => setEntryGateFontWeight(event.target.value as EntryGateFontWeight)}
                        >
                          {ENTRY_GATE_FONT_WEIGHT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 text-sm xl:col-span-2">
                        <span className="text-[#ddd6cb]">Entry font</span>
                        <select
                          className="input py-3"
                          value={entryGateFontPreset}
                          onChange={(event) => setEntryGateFontPreset(event.target.value as EntryGateFontPreset)}
                        >
                          {PROFILE_FONT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-[#8f98ac]">
                          {PROFILE_FONT_OPTIONS.find((option) => option.value === entryGateFontPreset)?.description}
                        </p>
                      </label>

                      {entryGateFontPreset === "custom" ? (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4 xl:col-span-2">
                          <p className="text-sm text-[#ddd6cb]">Entry custom font upload</p>
                          <p className="text-xs text-[#8f98ac]">
                            Upload WOFF2/WOFF/TTF/OTF (max 2MB). This applies only to entry screen text.
                          </p>

                          <div className="grid gap-3 xl:grid-cols-2">
                            <input
                              className="input py-3"
                              value={entryGateCustomFontName}
                              onChange={(event) => setEntryGateCustomFontName(event.target.value)}
                              placeholder="Entry font display name"
                              maxLength={80}
                            />

                            <div className="flex flex-wrap gap-2">
                              <input
                                id="entry-gate-font-upload"
                                type="file"
                                accept={PROFILE_FONT_ACCEPT}
                                className="hidden"
                                onChange={handleEntryGateFontInput}
                                disabled={uploadingEntryGateFont}
                              />
                              <label htmlFor="entry-gate-font-upload" className="btn btn-secondary cursor-pointer">
                                {uploadingEntryGateFont ? "Uploading..." : "Upload font"}
                              </label>

                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => {
                                  void clearEntryGateCustomFont();
                                }}
                                disabled={uploadingEntryGateFont || !entryGateCustomFontUrl.trim()}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <label className="space-y-1.5 text-sm">
                            <span className="text-[#ddd6cb]">Entry custom font URL</span>
                            <input
                              className="input py-3"
                              value={entryGateCustomFontUrl}
                              onChange={(event) => setEntryGateCustomFontUrl(event.target.value)}
                              placeholder="https://.../profile-fonts/{userId}/entry-font.woff2"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8f98ac]">Entry screen is disabled.</p>
                  )}
                  </div>
                ) : null}

                {activeAppearanceSection === "style" ? (
                  <div className="panel space-y-5 p-7">
                  <h3 className="text-lg font-semibold text-white">Style Controls</h3>
                  <p className="text-sm text-[#a79c8d]">Fine tune profile effects, card texture, avatar shape, and hero alignment.</p>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Profile effect</span>
                      <select
                        className="input py-3"
                        value={profileEffect}
                        onChange={(event) => setProfileEffect(event.target.value as ProfileEffect)}
                      >
                        {PROFILE_EFFECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {PROFILE_EFFECT_OPTIONS.find((option) => option.value === profileEffect)?.description}
                      </p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Link style</span>
                      <select
                        className="input py-3"
                        value={linkStyle}
                        onChange={(event) => setLinkStyle(event.target.value as LinkStyle)}
                      >
                        {LINK_STYLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {LINK_STYLE_OPTIONS.find((option) => option.value === linkStyle)?.description}
                      </p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Link effect</span>
                      <select
                        className="input py-3"
                        value={linkEffect}
                        onChange={(event) => setLinkEffect(event.target.value as LinkEffect)}
                      >
                        {LINK_EFFECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {LINK_EFFECT_OPTIONS.find((option) => option.value === linkEffect)?.description}
                      </p>
                    </label>

                    <div className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Favicon tint</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="input h-11 w-14 cursor-pointer p-1.5"
                          value={/^#([0-9a-fA-F]{6})$/.test(linkIconTint) ? linkIconTint : "#d9d2c8"}
                          onChange={(event) => setLinkIconTint(event.target.value)}
                        />
                        <input
                          className="input py-3"
                          value={linkIconTint}
                          onChange={(event) => setLinkIconTint(event.target.value)}
                          placeholder="#D9D2C8"
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setLinkIconTint("")}
                        >
                          Clear
                        </button>
                      </div>
                      <p className="text-xs text-[#8f98ac]">
                        Optional tint applied to favicons and fallback icons. Leave empty for original favicon colors.
                      </p>
                    </div>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Avatar shape</span>
                      <select
                        className="input py-3"
                        value={avatarShape}
                        onChange={(event) => setAvatarShape(event.target.value as AvatarShape)}
                      >
                        {AVATAR_SHAPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {AVATAR_SHAPE_OPTIONS.find((option) => option.value === avatarShape)?.description}
                      </p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Hero alignment</span>
                      <select
                        className="input py-3"
                        value={heroAlign}
                        onChange={(event) => setHeroAlign(event.target.value as HeroAlign)}
                      >
                        {HERO_ALIGN_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {HERO_ALIGN_OPTIONS.find((option) => option.value === heroAlign)?.description}
                      </p>
                    </label>
                  </div>
                  </div>
                ) : null}

                {activeAppearanceSection === "background" ? (
                  <div className="panel space-y-5 p-7">
                  <h3 className="text-lg font-semibold text-white">Background</h3>
                  <p className="text-sm text-[#a79c8d]">
                    Choose theme default, gradient preset, or custom image/MP4 media for your full profile page.
                  </p>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Mode</span>
                      <select
                        className="input py-3"
                        value={backgroundMode}
                        onChange={(event) => {
                          const nextMode = event.target.value as BackgroundMode;
                          setBackgroundMode(nextMode);

                          if (nextMode === "theme") {
                            setBackgroundValue("");
                          }

                          if (nextMode === "gradient" && !backgroundValue) {
                            setBackgroundValue("midnight");
                          }
                        }}
                      >
                        {BACKGROUND_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {BACKGROUND_MODE_OPTIONS.find((option) => option.value === backgroundMode)?.description}
                      </p>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Background effect</span>
                      <select
                        className="input py-3"
                        value={backgroundEffect}
                        onChange={(event) => setBackgroundEffect(event.target.value as BackgroundEffect)}
                      >
                        {BACKGROUND_EFFECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-[#8f98ac]">
                        {BACKGROUND_EFFECT_OPTIONS.find((option) => option.value === backgroundEffect)?.description}
                      </p>
                    </label>

                    {backgroundMode === "gradient" ? (
                      <label className="space-y-1.5 text-sm">
                        <span className="text-[#ddd6cb]">Gradient preset</span>
                        <select
                          className="input py-3"
                          value={backgroundValue || "midnight"}
                          onChange={(event) => setBackgroundValue(event.target.value)}
                        >
                          {BACKGROUND_GRADIENT_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-[#8f98ac]">Presets are optimized for text readability.</p>
                      </label>
                    ) : null}

                    {backgroundMode === "image" ? (
                      <div className="space-y-1.5 text-sm xl:col-span-2">
                        <span className="text-[#ddd6cb]">Media URL (image or MP4)</span>
                        <input
                          className="input py-3"
                          value={backgroundValue}
                          onChange={(event) => setBackgroundValue(event.target.value)}
                          placeholder="https://cdn.example.com/background.mp4"
                        />
                        <p className="text-xs text-[#8f98ac]">
                          Use a high-resolution image or looping MP4 with low visual noise behind text.
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <input
                            id="background-media-upload"
                            type="file"
                            accept={BACKGROUND_MEDIA_ACCEPT}
                            className="hidden"
                            onChange={handleBackgroundMediaInput}
                            disabled={uploadingBackgroundMedia}
                          />
                          <label htmlFor="background-media-upload" className="btn btn-secondary cursor-pointer">
                            {uploadingBackgroundMedia ? "Uploading..." : "Upload media"}
                          </label>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              void clearBackgroundMedia();
                            }}
                            disabled={uploadingBackgroundMedia || !backgroundValue.trim()}
                          >
                            Clear media
                          </button>
                        </div>
                        <p className="text-xs text-[#8f98ac]">
                          Upload from your device (JPG, PNG, WEBP, GIF, MP4 up to 50MB). Save changes after upload.
                        </p>
                      </div>
                    ) : null}
                  </div>
                  </div>
                ) : null}

                {activeAppearanceSection === "visibility" ? (
                  <div className="panel space-y-5 p-7">
                  <h3 className="text-lg font-semibold text-white">Visibility</h3>
                  <div className="grid gap-3">
                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Public profile</span>
                      <input
                        type="checkbox"
                        checked={isPublic}
                        onChange={(event) => setIsPublic(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        disabled={profile.is_banned}
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Enable comments</span>
                      <input
                        type="checkbox"
                        checked={commentsEnabled}
                        onChange={(event) => setCommentsEnabled(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        disabled={profile.is_banned}
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Show viewer count</span>
                      <input
                        type="checkbox"
                        checked={showViewCount}
                        onChange={(event) => setShowViewCount(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                    {profile.is_banned ? (
                      <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        This account is currently banned. Public visibility and comments are locked off.
                      </p>
                    ) : null}
                  </div>
                  </div>
                ) : null}
              </motion.section>
            ) : null}

            {activeTab === "motion" ? (
              <motion.section key="tab-motion" className="space-y-5" {...tabTransition(reduceMotion)}>
                <div className="panel space-y-5 p-7">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Motion Controls</h2>
                    <p className="mt-1 text-sm text-[#a79c8d]">
                      Global transition behavior and lightweight interaction settings for your public page.
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Enable transitions</span>
                      <input
                        type="checkbox"
                        checked={transitionsEnabled}
                        onChange={(event) => {
                          const enabled = event.target.checked;
                          setTransitionsEnabled(enabled);

                          if (!enabled) {
                            setProfileAnimation("none");
                            return;
                          }

                          setProfileAnimation((prev) => (prev === "none" ? "subtle" : prev));
                        }}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Enable avatar float</span>
                      <input
                        type="checkbox"
                        checked={avatarFloat}
                        onChange={(event) => setAvatarFloat(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Transition style</span>
                      <select
                        className="input py-3"
                        value={profileAnimation === "none" ? "subtle" : profileAnimation}
                        onChange={(event) => setProfileAnimation(event.target.value as ProfileAnimation)}
                        disabled={!transitionsEnabled}
                      >
                        {PROFILE_ANIMATION_OPTIONS.filter((option) => option.value !== "none").map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Profile effect emphasis</span>
                      <select
                        className="input py-3"
                        value={profileEffect}
                        onChange={(event) => setProfileEffect(event.target.value as ProfileEffect)}
                      >
                        {PROFILE_EFFECT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </motion.section>
            ) : null}

            {activeTab === "integrations" ? (
              <motion.section key="tab-integrations" className="space-y-5" {...tabTransition(reduceMotion)}>
                <div className="panel p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-medium text-white">Discord Presence</p>
                      <p className="text-xs text-[#a79c8d]">
                        Connect Discord once, then show live online, idle, or DND status on your public page.
                      </p>
                    </div>

                    {hasDiscordConnection ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={disconnectDiscordIdentity}
                        disabled={discordDisconnecting}
                      >
                        {discordDisconnecting ? "Disconnecting..." : "Disconnect"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={connectDiscordIdentity}
                        disabled={discordLinking}
                      >
                        {discordLinking ? "Connecting..." : "Authorize Discord"}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-[#bdb4a8]">
                      {hasDiscordConnection ? (
                        <span>
                          Connected as user ID <span className="font-medium text-white">{maskedDiscordUserId}</span>.
                        </span>
                      ) : (
                        <span>No Discord account connected yet.</span>
                      )}
                    </div>

                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Show Discord status</span>
                      <input
                        type="checkbox"
                        checked={discordPresenceEnabled}
                        onChange={(event) => setDiscordPresenceEnabled(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        disabled={!hasDiscordConnection}
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#d2d8e3]">
                      <span>Show current activity</span>
                      <input
                        type="checkbox"
                        checked={discordShowActivity}
                        onChange={(event) => setDiscordShowActivity(event.target.checked)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        disabled={!discordPresenceEnabled || !hasDiscordConnection}
                      />
                    </label>
                  </div>
                </div>

                <div className="panel p-7">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left"
                    onClick={() => setShowMusicSection((prev) => !prev)}
                  >
                    <div>
                      <p className="text-base font-medium text-white">Music Player</p>
                      <p className="text-xs text-[#a79c8d]">Search tracks via API, then add previews to your profile.</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#a6aebe] transition ${showMusicSection ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {showMusicSection ? (
                      <motion.div
                        className="mt-4 space-y-3"
                        initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-white">Music API Search</p>
                            <span className="text-xs text-[#a79c8d]">Powered by iTunes Search API</span>
                          </div>

                          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                            <input
                              className="input py-2.5"
                              value={musicQuery}
                              onChange={(event) => setMusicQuery(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void searchMusicCatalog();
                                }
                              }}
                              placeholder="Search songs or artists"
                            />
                            <button
                              type="button"
                              className="btn btn-secondary inline-flex items-center gap-2"
                              onClick={searchMusicCatalog}
                              disabled={musicSearching}
                            >
                              {musicSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              {musicSearching ? "Searching..." : "Search"}
                            </button>
                          </div>

                          {musicSearchError ? (
                            <p className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                              {musicSearchError}
                            </p>
                          ) : null}

                          {musicResults.length ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {musicResults.map((result) => (
                                <div key={result.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <div className="flex items-start gap-3">
                                    {result.artworkUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={result.artworkUrl}
                                        alt={`${result.title} cover`}
                                        className="h-12 w-12 rounded-md border border-white/12 object-cover"
                                      />
                                    ) : (
                                      <div className="h-12 w-12 rounded-md border border-white/12 bg-black/40" />
                                    )}

                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-medium text-white">{result.title}</p>
                                      <p className="truncate text-xs text-[#a79c8d]">{result.artist}</p>
                                    </div>
                                  </div>

                                  <audio controls preload="none" src={result.previewUrl} className="mt-3 w-full" />

                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    {result.trackViewUrl ? (
                                      <Link
                                        href={result.trackViewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs text-[var(--accent-strong)] hover:underline"
                                      >
                                        Open source
                                      </Link>
                                    ) : (
                                      <span className="text-xs text-[#8390a5]">Preview only</span>
                                    )}
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => addTrackFromSearch(result)}
                                    >
                                      Add
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#8f98ac]">Search to find tracks you can add instantly.</p>
                          )}
                        </div>

                        <div className="flex justify-between gap-2">
                          <p className="text-xs text-[#a79c8d]">
                            Use direct audio URLs, or upload audio files directly.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              id="music-file-upload"
                              type="file"
                              accept={MUSIC_FILE_ACCEPT}
                              className="hidden"
                              onChange={handleMusicFileInput}
                              disabled={uploadingMusicFile}
                            />
                            <label
                              htmlFor="music-file-upload"
                              className={`btn btn-secondary cursor-pointer ${uploadingMusicFile ? "pointer-events-none opacity-65" : ""}`}
                            >
                              {uploadingMusicFile ? "Uploading..." : "Upload audio"}
                            </label>
                            <button
                              type="button"
                              className="btn btn-secondary inline-flex items-center gap-2"
                              onClick={addTrack}
                            >
                              <Plus className="h-4 w-4" />
                              Add custom track
                            </button>
                          </div>
                        </div>

                        {!tracks.length ? (
                          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#ab9f90]">
                            No tracks yet.
                          </p>
                        ) : (
                          tracks.map((track) => {
                            const resolvedEmbed = resolveMusicEmbedUrl(track.embed_url);
                            const searchLinks = getMusicProviderSearchLinks(track.title);

                            return (
                              <div key={track.id} className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
                                  <input
                                    className="input py-2.5"
                                    value={track.title}
                                    onChange={(event) => updateTrack(track.id, { title: event.target.value })}
                                    placeholder="Track title"
                                  />
                                  <input
                                    className="input py-2.5"
                                    value={track.embed_url}
                                    onChange={(event) => updateTrack(track.id, { embed_url: event.target.value })}
                                    placeholder="Paste direct audio URL (.mp3, .m4a, .wav, .ogg)"
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-secondary inline-flex items-center gap-2"
                                    onClick={() => removeTrack(track.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove
                                  </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => checkTrackUrl(track.id)}
                                  >
                                    Check URL
                                  </button>
                                  {searchLinks.map((item) => (
                                    <Link
                                      key={`${track.id}-${item.label}`}
                                      href={item.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-xs text-[var(--accent-strong)] hover:underline"
                                    >
                                      {item.label}
                                    </Link>
                                  ))}
                                </div>

                                <p className="text-xs text-[#8f98ac]">{resolvedEmbed.hint}</p>

                                <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#b0a595]">
                                  <span>Active</span>
                                  <input
                                    type="checkbox"
                                    checked={track.is_active}
                                    onChange={(event) => updateTrack(track.id, { is_active: event.target.checked })}
                                    className="h-4 w-4 accent-[var(--accent)]"
                                  />
                                </label>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="panel p-7">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left"
                    onClick={() => setShowWidgetSection((prev) => !prev)}
                  >
                    <div>
                      <p className="text-base font-medium text-white">Widget Integrations</p>
                      <p className="text-xs text-[#a79c8d]">Clock, stats, quote, and embed widgets.</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#a6aebe] transition ${showWidgetSection ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {showWidgetSection ? (
                      <motion.div
                        className="mt-4 space-y-3"
                        initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex justify-end">
                          <button type="button" className="btn btn-secondary inline-flex items-center gap-2" onClick={addWidget}>
                            <Plus className="h-4 w-4" />
                            Add widget
                          </button>
                        </div>

                        {!widgets.length ? (
                          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#ab9f90]">
                            No widgets yet.
                          </p>
                        ) : (
                          widgets.map((widget) => (
                            <div key={widget.id} className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                              <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
                                <select
                                  className="input py-2.5"
                                  value={widget.widget_type}
                                  onChange={(event) => updateWidget(widget.id, { widget_type: event.target.value as WidgetRow["widget_type"] })}
                                >
                                  <option value="clock">Clock</option>
                                  <option value="stat">Stat</option>
                                  <option value="quote">Quote</option>
                                  <option value="embed">Embed</option>
                                </select>
                                <input
                                  className="input py-2.5"
                                  value={widget.title}
                                  onChange={(event) => updateWidget(widget.id, { title: event.target.value })}
                                  placeholder="Widget title"
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary inline-flex items-center gap-2"
                                  onClick={() => removeWidget(widget.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </button>
                              </div>

                              {widget.widget_type === "embed" ? (
                                <input
                                  className="input py-2.5"
                                  value={widget.source_url ?? ""}
                                  onChange={(event) => updateWidget(widget.id, { source_url: event.target.value })}
                                  placeholder="https://embed-source.com"
                                />
                              ) : (
                                <input
                                  className="input py-2.5"
                                  value={widget.value ?? ""}
                                  onChange={(event) => updateWidget(widget.id, { value: event.target.value })}
                                  placeholder={widget.widget_type === "stat" ? "42" : "Widget value"}
                                />
                              )}

                              <label className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-[#b0a595]">
                                <span>Active</span>
                                <input
                                  type="checkbox"
                                  checked={widget.is_active}
                                  onChange={(event) => updateWidget(widget.id, { is_active: event.target.checked })}
                                  className="h-4 w-4 accent-[var(--accent)]"
                                />
                              </label>
                            </div>
                          ))
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="panel p-7">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-left"
                    onClick={() => setShowCommentSection((prev) => !prev)}
                  >
                    <div>
                      <p className="text-base font-medium text-white">Comments</p>
                      <p className="text-xs text-[#a79c8d]">Moderate recent comments from your audience.</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#a6aebe] transition ${showCommentSection ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {showCommentSection ? (
                      <motion.div
                        className="mt-4 space-y-3"
                        initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        {!comments.length ? (
                          <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#ab9f90]">
                            No comments yet.
                          </p>
                        ) : (
                          comments.map((comment) => (
                            <div key={comment.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-white">{comment.author_name}</p>
                                  <p className="mt-1 text-xs text-[#98a3b8]">{new Date(comment.created_at).toLocaleString()}</p>
                                </div>
                                <span className="rounded-full border border-white/12 bg-black/30 px-2 py-1 text-[10px] text-[#c3ccdc]">
                                  {comment.status}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-relaxed text-[#ddd5c9]">{comment.body}</p>

                              <div className="mt-4 flex flex-wrap gap-2">
                                {comment.status === "published" ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setCommentStatus(comment.id, "hidden")}
                                    disabled={commentActionId === comment.id}
                                  >
                                    {commentActionId === comment.id ? "Saving..." : "Hide"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setCommentStatus(comment.id, "published")}
                                    disabled={commentActionId === comment.id}
                                  >
                                    {commentActionId === comment.id ? "Saving..." : "Publish"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => deleteComment(comment.id)}
                                  disabled={commentActionId === comment.id}
                                >
                                  {commentActionId === comment.id ? "Removing..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </motion.section>
            ) : null}

            {activeTab === "ai" ? (
              <motion.section key="tab-ai" className="space-y-5" {...tabTransition(reduceMotion)}>
                {!hasPremium ? (
                  <div className="panel space-y-4 p-7">
                    <h2 className="text-xl font-semibold text-white">AI Assist</h2>
                    <p className="text-sm text-[#a79c8d]">
                      AI Assist is Pro-only. Upgrade to unlock bio generation, link labeling, and bio polish tools.
                    </p>
                    <Link
                      href={premiumTicketUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary inline-flex items-center gap-2"
                    >
                      Open Discord ticket
                    </Link>
                  </div>
                ) : (
                  <>
                <div className="panel space-y-6 p-7">
                  <div>
                    <h2 className="text-xl font-semibold text-white">AI Assist</h2>
                    <p className="mt-1 text-sm text-[#a79c8d]">
                      Clean writing helpers for bios and link labels. AI suggestions - edit as you like.
                    </p>
                    {aiConfigured === false ? (
                      <p className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#b0a595]">
                        AI not configured. Using local fallback templates.
                      </p>
                    ) : null}
                    {aiError ? (
                      <p className="mt-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {aiError}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                    <label className="space-y-1.5 text-sm">
                      <span className="text-[#ddd6cb]">Vibe</span>
                      <select
                        className="input py-3"
                        value={aiVibe}
                        onChange={(event) => setAiVibe(event.target.value as typeof aiVibe)}
                      >
                        <option value="clean/professional">Clean / professional</option>
                        <option value="creative">Creative</option>
                        <option value="minimal">Minimal</option>
                        <option value="confident">Confident</option>
                      </select>
                    </label>
                    <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#a79c8d]">
                      Safety rules enforced: no harassment, doxxing, hate, violence, or wrongdoing.
                    </p>
                  </div>
                </div>

                <div className="panel space-y-5 p-7">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Bio Generator</h3>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-2"
                      onClick={runBioGenerator}
                      disabled={aiLoading === "bio-generate"}
                    >
                      {aiLoading === "bio-generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      {aiBioOptions.length ? "Regenerate" : "Generate"}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_160px]">
                    <input
                      className="input py-3"
                      value={aiBioInterests}
                      onChange={(event) => setAiBioInterests(event.target.value)}
                      placeholder="Interests: design systems, product strategy, music"
                    />
                    <select
                      className="input py-3"
                      value={aiBioLength}
                      onChange={(event) => setAiBioLength(event.target.value as typeof aiBioLength)}
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>

                  {aiBioOptions.length ? (
                    <div className="space-y-3">
                      {aiBioOptions.map((option, index) => (
                        <div key={`${option}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <p className="text-sm leading-relaxed text-[#ddd5c9]">{option}</p>
                          <div className="mt-3">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setBio(option);
                                pushToast("success", "Bio updated from AI suggestion.");
                              }}
                            >
                              Use this
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="panel space-y-5 p-7">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Link Label Helper</h3>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-2"
                      onClick={runLinkLabelHelper}
                      disabled={aiLoading === "link-label"}
                    >
                      {aiLoading === "link-label" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Suggest
                    </button>
                  </div>

                  <input
                    className="input py-3"
                    value={aiLinkUrl}
                    onChange={(event) => setAiLinkUrl(event.target.value)}
                    placeholder="Paste URL for title + description suggestion"
                  />

                  {aiLinkTitle ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-medium text-white">{aiLinkTitle}</p>
                      {aiLinkDescription ? (
                        <p className="mt-1 text-xs text-[#a79c8d]">{aiLinkDescription}</p>
                      ) : (
                        <p className="mt-1 text-xs text-[#a79c8d]">No description suggested.</p>
                      )}

                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                        <select
                          className="input py-2.5"
                          value={aiLinkTargetId}
                          onChange={(event) => setAiLinkTargetId(event.target.value)}
                        >
                          <option value="">Create as new link</option>
                          {links.map((link) => (
                            <option key={link.id} value={link.id}>
                              {link.title}
                            </option>
                          ))}
                        </select>
                        <button type="button" className="btn btn-primary" onClick={applyAiLinkSuggestion}>
                          Use this
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="panel space-y-5 p-7">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">Bio Polish</h3>
                    <button
                      type="button"
                      className="btn btn-secondary inline-flex items-center gap-2"
                      onClick={runBioPolish}
                      disabled={aiLoading === "bio-polish"}
                    >
                      {aiLoading === "bio-polish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Polish
                    </button>
                  </div>

                  <textarea
                    className="input min-h-28 resize-y py-3"
                    value={aiPolishInput}
                    onChange={(event) => setAiPolishInput(event.target.value)}
                    placeholder="Paste a bio to improve clarity and tone"
                  />

                  {aiPolishMinimal || aiPolishExpressive ? (
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs text-[#a79c8d] uppercase tracking-[0.14em]">More minimal</p>
                        <p className="mt-2 text-sm text-[#ddd5c9]">{aiPolishMinimal}</p>
                        <button
                          type="button"
                          className="btn btn-secondary mt-3"
                          onClick={() => {
                            setBio(aiPolishMinimal);
                            pushToast("success", "Bio updated.");
                          }}
                        >
                          Use this
                        </button>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs text-[#a79c8d] uppercase tracking-[0.14em]">More expressive</p>
                        <p className="mt-2 text-sm text-[#ddd5c9]">{aiPolishExpressive}</p>
                        <button
                          type="button"
                          className="btn btn-secondary mt-3"
                          onClick={() => {
                            setBio(aiPolishExpressive);
                            pushToast("success", "Bio updated.");
                          }}
                        >
                          Use this
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                  </>
                )}
              </motion.section>
            ) : null}
          </AnimatePresence>
        </section>

        <aside className="scrollbar-hidden h-fit space-y-6 self-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-24">
          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="section-kicker">Live Preview</p>
                <p className="mt-1 text-xs text-[#95a19b]">Interactive device frame with realtime updates.</p>
              </div>
              <div className="segmented">
                {PREVIEW_DEVICE_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="segmented-btn inline-flex items-center gap-1.5"
                      data-active={previewDevice === option.value}
                      onClick={() => setPreviewDevice(option.value)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {previewLoading ? (
            <div className="panel space-y-4 p-5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-white/10" />
              <div className="rounded-[20px] border border-white/8 bg-black/30 p-5">
                <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-white/10" />
                <div className="mx-auto mt-4 h-4 w-40 animate-pulse rounded bg-white/10" />
                <div className="mx-auto mt-3 h-3 w-52 animate-pulse rounded bg-white/10" />
                <div className="mt-6 space-y-3">
                  <div className="h-14 animate-pulse rounded-[14px] bg-white/10" />
                  <div className="h-14 animate-pulse rounded-[14px] bg-white/10" />
                  <div className="h-14 animate-pulse rounded-[14px] bg-white/10" />
                </div>
              </div>
            </div>
          ) : (
            <LivePreview
              profile={{
                displayName: displayName.trim() || "Creator",
                handle: profile.handle,
                bio: bio,
                avatarUrl,
                theme,
                colorAccent: colorAccent || null,
                layout,
                richText,
                badges: profileBadges,
                profileAnimation,
                avatarFloat,
                profileEffect,
                linkStyle,
                linkEffect,
                linkIconTint: linkIconTint.trim() || null,
                avatarShape,
                heroAlign,
                backgroundMode,
                backgroundValue: backgroundMode === "theme" ? null : backgroundValue.trim() || null,
                backgroundEffect,
                discordPresenceEnabled,
                discordConnected: Boolean(discordUserId.trim()),
                showViewCount,
                profileFontPreset,
                profileCustomFontUrl: profileCustomFontUrl.trim() || null,
                nameEffect,
              }}
              links={links}
              tracks={tracks}
              widgets={widgets}
              previewDevice={previewDevice}
              hideCustomBackground={activeTab === "profile"}
            />
          )}
        </aside>
      </div>

      <AnimatePresence>
        {linkDraft ? (
          <motion.div
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            onClick={closeLinkDraft}
          >
            <motion.form
              className="panel scrollbar-hidden h-full w-full max-w-lg space-y-5 overflow-y-auto rounded-none border-l border-white/12 p-7 sm:rounded-l-3xl sm:rounded-r-none"
              initial={reduceMotion ? undefined : { opacity: 0, x: 18 }}
              animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: 18 }}
              transition={{ duration: 0.2 }}
              onSubmit={commitLinkDraft}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-white">Edit link</h3>
                <button type="button" className="btn btn-secondary" onClick={closeLinkDraft}>
                  Close
                </button>
              </div>

              <label className="space-y-1.5 text-sm">
                <span className="text-[#ddd6cb]">Title</span>
                <input
                  className="input py-3"
                  value={linkDraft.title}
                  onChange={(event) => setLinkDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                  maxLength={80}
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="text-[#ddd6cb]">URL</span>
                <input
                  className="input py-3"
                  value={linkDraft.url}
                  onChange={(event) => setLinkDraft((prev) => (prev ? { ...prev, url: event.target.value } : prev))}
                  placeholder="https://example.com"
                />
              </label>

              <label className="space-y-1.5 text-sm">
                <span className="text-[#ddd6cb]">Description</span>
                <input
                  className="input py-3"
                  value={linkDraft.description}
                  onChange={(event) =>
                    setLinkDraft((prev) => (prev ? { ...prev, description: event.target.value } : prev))
                  }
                  maxLength={120}
                />
              </label>

              <div className="space-y-1.5 text-sm">
                <span className="text-[#ddd6cb]">Custom icon upload (optional)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="link-icon-upload-input"
                    type="file"
                    accept={LINK_ICON_ACCEPT}
                    className="hidden"
                    onChange={handleLinkIconInput}
                    disabled={uploadingLinkIcon}
                  />
                  <label htmlFor="link-icon-upload-input" className="btn btn-secondary cursor-pointer">
                    {uploadingLinkIcon ? "Uploading..." : "Upload icon"}
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      void clearCustomLinkIcon();
                    }}
                    disabled={uploadingLinkIcon || !linkDraft.icon.trim()}
                  >
                    Use site favicon
                  </button>
                </div>
                <p className="text-xs text-[#8f98ac]">
                  Upload PNG, JPG, WEBP, GIF, SVG, or ICO (max 512KB), or use the site&apos;s favicon.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-[#9d9488]">Icon preview</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/24">
                    <SiteLinkIcon
                      url={linkDraft.url}
                      icon={linkDraft.icon}
                      iconTint={linkIconTint.trim() || null}
                      alt={`${linkDraft.title || "Link"} icon preview`}
                      className="flex h-5 w-5 items-center justify-center"
                      imgClassName="h-5 w-5 object-contain"
                      textClassName="text-sm text-[#ddd6cb]"
                      fallbackClassName="h-3 w-3 rounded-full bg-white/30"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[#b6ada0]">
                      Auto favicon: {getSiteFaviconUrl(linkDraft.url) ?? "Unavailable until URL is valid"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      void clearCustomLinkIcon();
                    }}
                    disabled={uploadingLinkIcon || !linkDraft.icon.trim()}
                  >
                    Use auto favicon
                  </button>
                </div>
              </div>

              {linkDraftError ? (
                <p className="rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {linkDraftError}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={closeLinkDraft}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploadingLinkIcon}>
                  Save link
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none fixed right-4 top-20 z-50 space-y-2 sm:right-6">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`pointer-events-auto rounded-xl border px-3 py-2 text-xs shadow-[0_18px_42px_-30px_black] ${
                toast.kind === "success"
                  ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
                  : toast.kind === "error"
                    ? "border-red-300/25 bg-red-500/10 text-red-100"
                    : "border-white/15 bg-black/35 text-[#d6dce8]"
              }`}
              initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}




