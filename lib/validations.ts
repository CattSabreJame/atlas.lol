import { z } from "zod";

import { isCatboxUrl } from "@/lib/catbox";
import { HANDLE_REGEX } from "@/lib/handles";
import { isAllowedBasicPlatformUrl, isAllowedMusicUrl } from "@/lib/url-allowlist";

const httpsUrlSchema = z
  .string()
  .trim()
  .url("Please enter a valid URL.")
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must start with http:// or https://",
  });

const interestsSchema = z
  .string()
  .trim()
  .min(1, "Add at least one interest.")
  .max(200, "Interests must be 200 characters or fewer.");
const bioPolishInputSchema = z
  .string()
  .trim()
  .min(12, "Bio must be at least 12 characters.")
  .max(400, "Bio must be 400 characters or fewer.");

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_REGEX, "Use 3-20 lowercase letters, numbers, or underscores.");

export const themeSchema = z.enum(["slate", "emerald", "amber", "rose"]);
export const layoutSchema = z.enum(["stack", "grid", "split"]);
export const templateSchema = z.enum(["signature", "mono", "spotlight", "editorial"]);
export const badgeSchema = z.enum(["owner", "admin", "staff", "verified", "pro", "founder"]);
export const profileAnimationSchema = z.enum(["none", "subtle", "lift", "pulse"]);
export const profileEffectSchema = z.enum(["none", "glow", "grain", "scanlines", "halo", "velvet", "frost"]);
export const backgroundEffectSchema = z.enum(["none", "vignette", "noise", "mesh", "spotlight", "snow", "rain", "embers"]);
export const linkStyleSchema = z.enum(["soft", "glass", "outline"]);
export const linkEffectSchema = z.enum(["none", "glow", "outline", "lift", "pulse"]);
export const avatarShapeSchema = z.enum(["circle", "rounded", "square"]);
export const heroAlignSchema = z.enum(["center", "left"]);
export const backgroundModeSchema = z.enum(["theme", "gradient", "image"]);
export const backgroundGradientSchema = z.enum(["aurora", "sunset", "midnight", "ocean"]);
export const entryGateFontSizeSchema = z.enum(["sm", "md", "lg"]);
export const entryGateFontWeightSchema = z.enum(["medium", "semibold", "bold"]);
export const entryGateBackgroundOpacitySchema = z.number().int().min(35).max(100);
export const entryGateBackgroundBlurSchema = z.number().int().min(0).max(32);
export const profileFontPresetSchema = z.enum([
  "inter",
  "manrope",
  "general_sans",
  "satoshi",
  "neue_montreal",
  "ibm_plex_sans",
  "space_grotesk",
  "jetbrains_mono",
  "clash_display",
  "outfit",
  "plus_jakarta_sans",
  "custom",
]);
export const nameEffectSchema = z.enum([
  "none",
  "gradient",
  "glow",
  "outline",
  "shimmer",
  "underline_accent",
  "shadow_depth",
  "micro_badge",
]);
export const cursorModeSchema = z.enum([
  "glow",
  "crosshair",
  "morph",
  "split",
  "hollow_square",
  "target_lock",
  "invert",
  "elastic",
  "outline_morph",
  "shadow_echo",
]);
export const cursorTrailModeSchema = z.enum([
  "velocity",
  "dots",
  "pixel",
  "motion_blur",
  "neon_thread",
  "smoke",
  "gravity",
  "ripple_wake",
  "data_stream",
  "dual_layer",
  "pulse_droplets",
]);
export const accentSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use hex format like #8C96A8.");

export const profileUpdateSchema = z.object({
  handle: handleSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(50, "Display name must be 50 characters or fewer."),
  bio: z.string().trim().max(240, "Bio must be 240 characters or fewer."),
  theme: themeSchema,
  layout: layoutSchema,
  template: templateSchema,
  colorAccent: accentSchema.nullable().or(z.literal("")),
  richText: z.string().max(3200, "Rich text must be 3200 characters or fewer."),
  badges: z.array(badgeSchema).max(6),
  profileAnimation: profileAnimationSchema,
  profileEffect: profileEffectSchema,
  linkStyle: linkStyleSchema,
  linkEffect: linkEffectSchema,
  linkIconTint: accentSchema.nullable().or(z.literal("")),
  avatarShape: avatarShapeSchema,
  heroAlign: heroAlignSchema,
  backgroundMode: backgroundModeSchema,
  backgroundValue: z
    .string()
    .trim()
    .max(500, "Background value must be 500 characters or fewer.")
    .nullable()
    .or(z.literal("")),
  backgroundEffect: backgroundEffectSchema,
  discordPresenceEnabled: z.boolean(),
  discordUserId: z
    .string()
    .trim()
    .max(20, "Discord user ID must be 20 digits or fewer.")
    .nullable()
    .or(z.literal("")),
  discordShowActivity: z.boolean(),
  commentsEnabled: z.boolean(),
  isPublic: z.boolean(),
  showViewCount: z.boolean(),
  avatarFloat: z.boolean(),
  entryGateEnabled: z.boolean(),
  entryGateText: z
    .string()
    .trim()
    .min(1, "Entry text is required.")
    .max(32, "Entry text must be 32 characters or fewer."),
  entryGateTextColor: accentSchema,
  entryGateBackgroundColor: accentSchema,
  entryGateBackgroundOpacity: entryGateBackgroundOpacitySchema,
  entryGateBackgroundBlurPx: entryGateBackgroundBlurSchema,
  entryGateFontSize: entryGateFontSizeSchema,
  entryGateFontWeight: entryGateFontWeightSchema,
  entryGateFontPreset: profileFontPresetSchema,
  entryGateCustomFontUrl: z
    .string()
    .trim()
    .max(700, "Entry font URL must be 700 characters or fewer.")
    .nullable()
    .or(z.literal("")),
  entryGateCustomFontName: z
    .string()
    .trim()
    .max(80, "Entry font name must be 80 characters or fewer.")
    .nullable()
    .or(z.literal("")),
  profileFontPreset: profileFontPresetSchema,
  profileCustomFontUrl: z
    .string()
    .trim()
    .max(700, "Custom font URL must be 700 characters or fewer.")
    .nullable()
    .or(z.literal("")),
  profileCustomFontName: z
    .string()
    .trim()
    .max(80, "Custom font name must be 80 characters or fewer.")
    .nullable()
    .or(z.literal("")),
  nameEffect: nameEffectSchema,
}).superRefine((data, context) => {
  const value = typeof data.backgroundValue === "string" ? data.backgroundValue.trim() : "";

  if (data.backgroundMode === "theme" && value) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["backgroundValue"],
      message: "Theme background should not include a custom value.",
    });
  }

  if (data.backgroundMode === "gradient") {
    const parsed = backgroundGradientSchema.safeParse(value);

    if (!parsed.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["backgroundValue"],
        message: "Select a valid gradient preset.",
      });
    }
  }

  if (data.backgroundMode === "image") {
    if (!value) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["backgroundValue"],
        message: "Background media URL is required.",
      });
      return;
    }

    if (!isCatboxUrl(value)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["backgroundValue"],
        message: "Background media URL must use https://catbox.moe.",
      });
    }
  }

  const normalizedDiscordId =
    typeof data.discordUserId === "string" ? data.discordUserId.trim() : "";

  if (data.discordPresenceEnabled && !normalizedDiscordId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discordUserId"],
      message: "Discord user ID is required when Discord presence is enabled.",
    });
  }

  if (normalizedDiscordId && !/^[0-9]{17,20}$/.test(normalizedDiscordId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discordUserId"],
      message: "Discord user ID must be 17-20 digits.",
    });
  }

  const customFontUrl =
    typeof data.profileCustomFontUrl === "string" ? data.profileCustomFontUrl.trim() : "";
  const customFontName =
    typeof data.profileCustomFontName === "string" ? data.profileCustomFontName.trim() : "";

  if (data.profileFontPreset === "custom" && !customFontUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profileCustomFontUrl"],
      message: "Upload a custom font file when custom font preset is selected.",
    });
  }

  if (customFontUrl && !/^https?:\/\//i.test(customFontUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profileCustomFontUrl"],
      message: "Custom font URL must start with http:// or https://.",
    });
  }

  if (customFontUrl && !customFontName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["profileCustomFontName"],
      message: "Custom font name is required when a custom font URL is set.",
    });
  }

  const entryFontUrl =
    typeof data.entryGateCustomFontUrl === "string" ? data.entryGateCustomFontUrl.trim() : "";
  const entryFontName =
    typeof data.entryGateCustomFontName === "string" ? data.entryGateCustomFontName.trim() : "";

  if (data.entryGateFontPreset === "custom" && !entryFontUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entryGateCustomFontUrl"],
      message: "Upload a custom font file when entry font preset is custom.",
    });
  }

  if (entryFontUrl && !/^https?:\/\//i.test(entryFontUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entryGateCustomFontUrl"],
      message: "Entry font URL must start with http:// or https://.",
    });
  }

  if (entryFontUrl && !entryFontName) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["entryGateCustomFontName"],
      message: "Entry font name is required when an entry font URL is set.",
    });
  }
});

export const linkInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z
    .string()
    .trim()
    .min(1, "Link title is required.")
    .max(80, "Link title must be 80 characters or fewer."),
  url: httpsUrlSchema.refine(
    (value) => isAllowedBasicPlatformUrl(value),
    "Only basic platform links are allowed (YouTube, SoundCloud, Spotify, Discord).",
  ),
  description: z
    .string()
    .trim()
    .max(120, "Link description must be 120 characters or fewer.")
    .optional()
    .nullable(),
  icon: z
    .string()
    .trim()
    .max(500, "Link icon must be 500 characters or fewer.")
    .optional()
    .nullable(),
  sortOrder: z.number().int().min(0),
});

export const trackViewQuerySchema = z.object({
  handle: handleSchema,
});

export const trackClickBodySchema = z.object({
  linkId: z.string().uuid(),
});

export const musicTrackInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z
    .string()
    .trim()
    .min(1, "Track title is required.")
    .max(80, "Track title must be 80 characters or fewer."),
  embedUrl: httpsUrlSchema.refine(
    (value) => isAllowedMusicUrl(value),
    "Music URL must be from allowed providers or approved storage.",
  ),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});

export const musicSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search must be at least 2 characters.")
    .max(80, "Search must be 80 characters or fewer."),
  limit: z.coerce.number().int().min(1).max(10).default(8),
});

export const widgetInputSchema = z.object({
  id: z.string().uuid().optional(),
  widgetType: z.enum(["clock", "stat", "quote", "embed"]),
  title: z
    .string()
    .trim()
    .min(1, "Widget title is required.")
    .max(80, "Widget title must be 80 characters or fewer."),
  value: z
    .string()
    .trim()
    .max(200, "Widget value must be 200 characters or fewer.")
    .optional()
    .nullable(),
  sourceUrl: httpsUrlSchema.optional().nullable(),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
});

export const commentCreateSchema = z.object({
  handle: handleSchema,
  body: z
    .string()
    .trim()
    .min(2, "Comment must be at least 2 characters.")
    .max(300, "Comment must be 300 characters or fewer.")
    .refine((value) => !/[<>]/.test(value), "Comment cannot include HTML tags."),
});

export const aiBioGenerateSchema = z.object({
  action: z.literal("bio-generate"),
  vibe: z.enum(["clean/professional", "creative", "minimal", "confident"]),
  interests: interestsSchema,
  length: z.enum(["short", "medium", "long"]),
});

export const aiLinkLabelSchema = z.object({
  action: z.literal("link-label"),
  vibe: z.enum(["clean/professional", "creative", "minimal", "confident"]),
  url: httpsUrlSchema,
});

export const aiBioPolishSchema = z.object({
  action: z.literal("bio-polish"),
  vibe: z.enum(["clean/professional", "creative", "minimal", "confident"]),
  bio: bioPolishInputSchema,
});

export const aiRequestSchema = z.discriminatedUnion("action", [
  aiBioGenerateSchema,
  aiLinkLabelSchema,
  aiBioPolishSchema,
]);

export type AIRequest = z.infer<typeof aiRequestSchema>;
