import { NameEffect, ProfileFontPreset } from "@/types/db";

export const PROFILE_FONT_OPTIONS: Array<{
  value: ProfileFontPreset;
  label: string;
  description: string;
}> = [
  { value: "inter", label: "Inter", description: "Safe default with clean SaaS-style readability." },
  { value: "manrope", label: "Manrope", description: "Soft modern sans with a premium tone." },
  { value: "general_sans", label: "General Sans", description: "Clean and expensive-feeling modern sans." },
  { value: "satoshi", label: "Satoshi", description: "Sharp modern sans with tight visual rhythm." },
  { value: "neue_montreal", label: "Neue Montreal", description: "Design-forward premium sans feel." },
  { value: "ibm_plex_sans", label: "IBM Plex Sans", description: "Structured technical sans for dev-core style." },
  { value: "space_grotesk", label: "Space Grotesk", description: "Modern geometric sans with subtle futuristic edge." },
  { value: "jetbrains_mono", label: "JetBrains Mono", description: "Developer-coded typography aesthetic." },
  { value: "clash_display", label: "Clash Display", description: "Bold creative display-forward typography." },
  { value: "outfit", label: "Outfit", description: "Friendly geometric sans for creator profiles." },
  { value: "plus_jakarta_sans", label: "Plus Jakarta Sans", description: "Clean editorial SaaS typography." },
  { value: "custom", label: "Custom Upload", description: "Use your own uploaded font file." },
];

export const NAME_EFFECT_OPTIONS: Array<{
  value: NameEffect;
  label: string;
  description: string;
}> = [
  { value: "none", label: "No Effect", description: "Pure typography with no animation or glow." },
  { value: "glow", label: "Soft Glow", description: "Subtle accent glow with controlled opacity." },
  { value: "gradient", label: "Gradient Fill", description: "Muted white-to-accent gradient fill." },
  { value: "underline_accent", label: "Underline Accent", description: "Thin animated underline on hover." },
  { value: "outline", label: "Outline Stroke", description: "Thin text stroke for crisp dev-core edge." },
  { value: "shimmer", label: "Shimmer Sweep", description: "Slow, subtle controlled shimmer sweep." },
  { value: "shadow_depth", label: "Shadow Depth", description: "Very faint depth shadow, no glow." },
  { value: "micro_badge", label: "Micro Badge", description: "Minimal accent marker beside the name." },
];

const LEGACY_FONT_PRESET_MAP: Record<string, ProfileFontPreset> = {
  atlas_sans: "inter",
  geometric: "satoshi",
  humanist: "manrope",
  editorial_serif: "neue_montreal",
  mono_signal: "ibm_plex_sans",
};

export function normalizeProfileFontPreset(preset: string | null | undefined): ProfileFontPreset {
  const value = String(preset ?? "").trim().toLowerCase();

  if (!value) {
    return "inter";
  }

  if (value in LEGACY_FONT_PRESET_MAP) {
    return LEGACY_FONT_PRESET_MAP[value];
  }

  const match = PROFILE_FONT_OPTIONS.find((option) => option.value === value);
  return match?.value ?? "inter";
}

export function getProfileFontFamily(preset: ProfileFontPreset | string): string {
  const normalizedPreset = normalizeProfileFontPreset(preset);

  if (normalizedPreset === "manrope") {
    return '"Manrope", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "general_sans") {
    return '"General Sans", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "satoshi") {
    return '"Satoshi", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "neue_montreal") {
    return '"Neue Montreal", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "ibm_plex_sans") {
    return '"IBM Plex Sans", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "space_grotesk") {
    return '"Space Grotesk", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "jetbrains_mono") {
    return '"JetBrains Mono", var(--font-mono), "SFMono-Regular", Menlo, Consolas, monospace';
  }

  if (normalizedPreset === "clash_display") {
    return '"Clash Display", "General Sans", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "outfit") {
    return '"Outfit", "Inter", "Segoe UI", sans-serif';
  }

  if (normalizedPreset === "plus_jakarta_sans") {
    return '"Plus Jakarta Sans", var(--font-sans), "Segoe UI", sans-serif';
  }

  return '"Inter", var(--font-sans), "Segoe UI", sans-serif';
}

export function getNameEffectClass(effect: NameEffect): string {
  if (effect === "none") {
    return "";
  }

  if (effect === "gradient") {
    return "name-effect-gradient";
  }

  if (effect === "glow") {
    return "name-effect-glow";
  }

  if (effect === "outline") {
    return "name-effect-outline";
  }

  if (effect === "shimmer") {
    return "name-effect-shimmer";
  }

  if (effect === "underline_accent") {
    return "name-effect-underline";
  }

  if (effect === "shadow_depth") {
    return "name-effect-shadow-depth";
  }

  if (effect === "micro_badge") {
    return "name-effect-micro-badge";
  }

  return "";
}

function getFontFormatFromUrl(url: string): string | null {
  const normalized = url.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";

  if (normalized.endsWith(".woff2")) {
    return "woff2";
  }

  if (normalized.endsWith(".woff")) {
    return "woff";
  }

  if (normalized.endsWith(".ttf")) {
    return "truetype";
  }

  if (normalized.endsWith(".otf")) {
    return "opentype";
  }

  return null;
}

export function buildCustomFontFaceCss(
  customFontUrl: string | null | undefined,
  familyName = "AtlasProfileCustom",
): string | null {
  if (!customFontUrl || !/^https?:\/\//i.test(customFontUrl)) {
    return null;
  }

  const format = getFontFormatFromUrl(customFontUrl);
  const safeFamilyName = familyName.replace(/[^a-zA-Z0-9_-]/g, "");
  const srcValue = format
    ? `url("${customFontUrl}") format("${format}")`
    : `url("${customFontUrl}")`;

  return `@font-face{font-family:"${safeFamilyName}";src:${srcValue};font-display:swap;font-style:normal;font-weight:100 900;}`;
}

export function getProfileFontStyle(
  preset: ProfileFontPreset | string,
  customFontUrl: string | null | undefined,
  customFamilyName = "AtlasProfileCustom",
): { fontFamily: string } {
  const normalizedPreset = normalizeProfileFontPreset(preset);

  if (normalizedPreset === "custom" && customFontUrl) {
    const safeFamilyName = customFamilyName.replace(/[^a-zA-Z0-9_-]/g, "");
    return {
      fontFamily: `"${safeFamilyName}", "Inter", var(--font-sans), "Segoe UI", sans-serif`,
    };
  }

  return {
    fontFamily: getProfileFontFamily(normalizedPreset),
  };
}
