import { type CSSProperties } from "react";

import { isCatboxUrl } from "@/lib/catbox";
import {
  BackgroundEffect,
  BackgroundGradient,
  BackgroundMode,
  LayoutName,
  ProfileEffect,
  TemplateName,
  ThemeName,
} from "@/types/db";

export const THEME_PRESETS: Record<
  ThemeName,
  {
    name: string;
    accent: string;
    accentStrong: string;
    accentSoft: string;
  }
> = {
  slate: {
    name: "Slate",
    accent: "#9CA7B8",
    accentStrong: "#C1C9D6",
    accentSoft: "rgba(156, 167, 184, 0.2)",
  },
  emerald: {
    name: "Olive",
    accent: "#8E9884",
    accentStrong: "#B6C1AB",
    accentSoft: "rgba(142, 152, 132, 0.2)",
  },
  amber: {
    name: "Amber",
    accent: "#A68F72",
    accentStrong: "#C9B194",
    accentSoft: "rgba(166, 143, 114, 0.2)",
  },
  rose: {
    name: "Rose",
    accent: "#A3878E",
    accentStrong: "#C9AEB5",
    accentSoft: "rgba(163, 135, 142, 0.2)",
  },
};

export const THEME_OPTIONS = Object.entries(THEME_PRESETS).map(
  ([value, meta]) => ({
    value: value as ThemeName,
    ...meta,
  }),
);

export const LAYOUT_OPTIONS: Array<{
  value: LayoutName;
  name: string;
  description: string;
}> = [
  {
    value: "stack",
    name: "Stack",
    description: "Classic vertical list for clean scanability.",
  },
  {
    value: "grid",
    name: "Grid",
    description: "Two-column cards with compact rhythm.",
  },
  {
    value: "split",
    name: "Split",
    description: "Feature-first layout with larger top card.",
  },
];

export const TEMPLATE_PRESETS: Array<{
  value: TemplateName;
  name: string;
  description: string;
  theme: ThemeName;
  layout: LayoutName;
  colorAccent: string;
}> = [
  {
    value: "signature",
    name: "Signature",
    description: "Balanced premium default with calm spacing.",
    theme: "slate",
    layout: "stack",
    colorAccent: "#8C96A8",
  },
  {
    value: "mono",
    name: "Mono Studio",
    description: "Minimal editorial vibe with soft neutral accents.",
    theme: "slate",
    layout: "split",
    colorAccent: "#9AA3B4",
  },
  {
    value: "spotlight",
    name: "Spotlight",
    description: "Creator-forward layout with stronger call-to-action.",
    theme: "emerald",
    layout: "grid",
    colorAccent: "#7E9A8A",
  },
  {
    value: "editorial",
    name: "Editorial",
    description: "Typography-led content and rich text emphasis.",
    theme: "amber",
    layout: "stack",
    colorAccent: "#A38B6C",
  },
];

export function isHexAccent(value: string | null | undefined): value is string {
  return Boolean(value && /^#([0-9a-fA-F]{6})$/.test(value));
}

export function getThemeStyle(theme: ThemeName, customAccent?: string | null): CSSProperties {
  const selected = THEME_PRESETS[theme] ?? THEME_PRESETS.slate;
  const accent = isHexAccent(customAccent) ? customAccent : selected.accent;
  const accentStrong = isHexAccent(customAccent)
    ? `color-mix(in srgb, ${accent} 72%, white 28%)`
    : selected.accentStrong;
  const accentSoft = isHexAccent(customAccent)
    ? `color-mix(in srgb, ${accent} 18%, transparent)`
    : selected.accentSoft;

  return {
    "--accent": accent,
    "--accent-strong": accentStrong,
    "--accent-soft": accentSoft,
  } as CSSProperties;
}

export const BACKGROUND_GRADIENT_PRESETS: Array<{
  value: BackgroundGradient;
  name: string;
  css: string;
}> = [
  {
    value: "aurora",
    name: "Mist",
    css: "radial-gradient(120% 85% at 14% -10%, rgba(178, 187, 202, 0.22), transparent 56%), radial-gradient(100% 80% at 90% 100%, rgba(120, 128, 146, 0.16), transparent 62%), linear-gradient(180deg, rgba(13,14,18,0.94), rgba(11,12,15,0.97))",
  },
  {
    value: "sunset",
    name: "Ember",
    css: "radial-gradient(120% 90% at 0% 0%, rgba(179, 146, 112, 0.22), transparent 58%), radial-gradient(110% 85% at 100% 100%, rgba(123, 103, 94, 0.2), transparent 60%), linear-gradient(180deg, rgba(18,15,14,0.94), rgba(11,10,11,0.97))",
  },
  {
    value: "midnight",
    name: "Midnight",
    css: "radial-gradient(120% 90% at 50% -10%, rgba(146, 158, 180, 0.2), transparent 58%), radial-gradient(110% 88% at 90% 100%, rgba(84, 92, 108, 0.18), transparent 56%), linear-gradient(180deg, rgba(10,11,15,0.94), rgba(8,9,12,0.98))",
  },
  {
    value: "ocean",
    name: "Stone",
    css: "radial-gradient(120% 90% at 10% 0%, rgba(126, 140, 155, 0.22), transparent 58%), radial-gradient(120% 90% at 90% 100%, rgba(110, 124, 117, 0.16), transparent 56%), linear-gradient(180deg, rgba(10,12,14,0.94), rgba(8,10,12,0.98))",
  },
];

export const BACKGROUND_EFFECT_OPTIONS: Array<{
  value: BackgroundEffect;
  label: string;
  description: string;
}> = [
  { value: "none", label: "None", description: "No extra background overlay effect." },
  { value: "vignette", label: "Vignette", description: "Strong edge darkening for dramatic focus." },
  { value: "noise", label: "Noise", description: "Visible animated grain across the full background." },
  { value: "mesh", label: "Mesh", description: "Large moving gradient blobs behind the profile." },
  { value: "spotlight", label: "Spotlight", description: "High-visibility center light pulse." },
  { value: "snow", label: "Snow", description: "Clearly visible animated snowfall." },
  { value: "rain", label: "Rain", description: "Fast diagonal rain streaks." },
  { value: "embers", label: "Embers", description: "Warm drifting embers with stronger motion." },
];

const BACKGROUND_PRESET_MAP = BACKGROUND_GRADIENT_PRESETS.reduce(
  (acc, item) => {
    acc[item.value] = item.css;
    return acc;
  },
  {} as Record<BackgroundGradient, string>,
);

export function isVideoBackgroundUrl(value?: string | null): boolean {
  if (!value || !isCatboxUrl(value)) {
    return false;
  }

  const normalized = value.trim();

  try {
    const parsed = new URL(normalized);
    return /\.mp4$/i.test(parsed.pathname);
  } catch {
    return /\.mp4(?:$|[?#])/i.test(normalized);
  }
}

export function getProfileBackgroundStyle(
  mode: BackgroundMode,
  value?: string | null,
): CSSProperties {
  if (mode === "gradient") {
    const preset = (value ?? "midnight") as BackgroundGradient;
    return {
      background: BACKGROUND_PRESET_MAP[preset] ?? BACKGROUND_PRESET_MAP.midnight,
    };
  }

  if (mode === "image" && typeof value === "string" && isCatboxUrl(value)) {
    const imageUrl = value.trim();

    if (isVideoBackgroundUrl(imageUrl)) {
      return {};
    }

    return {
      backgroundImage: `linear-gradient(180deg, rgba(9,11,15,0.5), rgba(9,11,15,0.72)), url("${imageUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }

  return {};
}

export function getProfileEffectCardStyle(effect: ProfileEffect): CSSProperties {
  if (effect === "glow") {
    return {
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.18), 0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent), 0 0 130px -38px color-mix(in srgb, var(--accent) 74%, rgba(0,0,0,0.78)), 0 38px 86px -46px rgba(0,0,0,0.9)",
      animation: "atlasCardGlow 5.2s ease-in-out infinite",
    };
  }

  if (effect === "halo") {
    return {
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.16), 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent), 0 0 150px -36px color-mix(in srgb, var(--accent) 76%, rgba(0,0,0,0.78)), 0 34px 78px -40px rgba(0,0,0,0.86)",
      animation: "atlasCardGlow 4.4s ease-in-out infinite",
    };
  }

  if (effect === "velvet") {
    return {
      background:
        "linear-gradient(162deg, rgba(26,23,20,0.98), rgba(14,13,12,0.92) 58%, rgba(24,20,17,0.96))",
      border: "1px solid rgba(255,255,255,0.11)",
      boxShadow: "0 34px 80px -46px rgba(0,0,0,0.96), inset 0 1px 0 rgba(255,255,255,0.06)",
      backgroundSize: "220% 220%",
      animation: "atlasVelvetShift 10.5s ease-in-out infinite",
    };
  }

  if (effect === "frost") {
    return {
      background: "linear-gradient(165deg, rgba(48,44,40,0.74), rgba(27,24,22,0.58))",
      border: "1px solid rgba(255,255,255,0.2)",
      backdropFilter: "blur(22px) saturate(120%)",
      boxShadow: "0 34px 78px -44px rgba(0,0,0,0.86), inset 0 1px 0 rgba(255,255,255,0.2)",
      animation: "atlasCardGlow 6.2s ease-in-out infinite",
    };
  }

  return {};
}

export function getProfileEffectOverlayStyle(effect: ProfileEffect): CSSProperties | null {
  if (effect === "grain") {
    return {
      opacity: 0.36,
      backgroundImage:
        "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.42) 0.8px, transparent 1px), radial-gradient(circle at 2px 2px, rgba(0,0,0,0.36) 0.7px, transparent 1px)",
      backgroundSize: "2px 2px, 3px 3px",
      mixBlendMode: "overlay",
      animation: "atlasGrainShift 1.25s steps(5) infinite",
    };
  }

  if (effect === "scanlines") {
    return {
      opacity: 0.44,
      backgroundImage:
        "repeating-linear-gradient(180deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, rgba(0,0,0,0.22) 1px, rgba(0,0,0,0.22) 2px, transparent 2px, transparent 6px)",
      mixBlendMode: "overlay",
      backgroundSize: "100% 8px",
      animation: "atlasScanlineDrift 3.8s linear infinite",
    };
  }

  if (effect === "halo") {
    return {
      opacity: 0.64,
      background:
        "radial-gradient(86% 62% at 50% 18%, color-mix(in srgb, var(--accent) 56%, rgba(255,255,255,0.25)), transparent 70%), radial-gradient(90% 70% at 50% 55%, rgba(255,255,255,0.1), transparent 72%)",
      mixBlendMode: "screen",
      animation: "atlasHaloPulse 4.9s ease-in-out infinite",
    };
  }

  if (effect === "frost") {
    return {
      opacity: 0.46,
      background:
        "linear-gradient(115deg, rgba(255,255,255,0.36) 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.02) 60%, rgba(255,255,255,0.24) 100%)",
      mixBlendMode: "screen",
      backgroundSize: "240% 240%",
      animation: "atlasFrostSweep 6.8s ease-in-out infinite",
    };
  }

  return null;
}

export function getBackgroundEffectOverlayStyle(effect: BackgroundEffect): CSSProperties | null {
  if (effect === "vignette") {
    return {
      background:
        "radial-gradient(130% 92% at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.52) 70%, rgba(0,0,0,0.82) 100%)",
      opacity: 0.9,
      animation: "atlasVignettePulse 6.8s ease-in-out infinite",
    };
  }

  if (effect === "noise") {
    return {
      opacity: 0.34,
      backgroundImage:
        "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.26) 0.5px, transparent 0.8px), radial-gradient(circle at 2px 2px, rgba(0,0,0,0.36) 0.5px, transparent 0.9px)",
      backgroundSize: "2px 2px, 3px 3px",
      mixBlendMode: "overlay",
      animation: "atlasNoiseShift 1.8s steps(6) infinite",
    };
  }

  if (effect === "mesh") {
    return {
      opacity: 0.72,
      background:
        "radial-gradient(80% 58% at 8% -8%, color-mix(in srgb, var(--accent) 52%, transparent), transparent 72%), radial-gradient(82% 66% at 102% 108%, rgba(255,255,255,0.18), transparent 72%), radial-gradient(56% 50% at 52% 40%, color-mix(in srgb, var(--accent) 36%, transparent), transparent 75%)",
      mixBlendMode: "screen",
      backgroundSize: "190% 190%",
      animation: "atlasMeshDrift 11s ease-in-out infinite",
    };
  }

  if (effect === "spotlight") {
    return {
      background:
        "radial-gradient(92% 62% at 50% 34%, rgba(255,255,255,0.36), rgba(255,255,255,0.12) 44%, rgba(0,0,0,0.52) 100%)",
      opacity: 0.84,
      mixBlendMode: "screen",
      animation: "atlasSpotlightPulse 6.2s ease-in-out infinite",
    };
  }

  if (effect === "snow") {
    return {
      opacity: 0.82,
      backgroundImage:
        "radial-gradient(circle, rgba(255,255,255,0.9) 1.1px, transparent 1.3px), radial-gradient(circle, rgba(255,255,255,0.75) 0.8px, transparent 1px), radial-gradient(circle, rgba(255,255,255,0.65) 1.4px, transparent 1.6px)",
      backgroundSize: "240px 240px, 170px 170px, 120px 120px",
      backgroundPosition: "0 0, 40px 80px, 120px 20px",
      animation: "atlasSnowFall 16s linear infinite",
      mixBlendMode: "screen",
    };
  }

  if (effect === "rain") {
    return {
      opacity: 0.58,
      backgroundImage:
        "repeating-linear-gradient(120deg, rgba(255,255,255,0.33) 0px, rgba(255,255,255,0.33) 1px, transparent 1px, transparent 8px), repeating-linear-gradient(120deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 14px)",
      backgroundSize: "180px 180px, 260px 260px",
      animation: "atlasRainFall 0.56s linear infinite",
      mixBlendMode: "screen",
    };
  }

  if (effect === "embers") {
    return {
      opacity: 0.54,
      backgroundImage:
        "radial-gradient(circle, rgba(255,208,149,0.62) 1.2px, transparent 1.5px), radial-gradient(circle, rgba(255,164,92,0.5) 1.6px, transparent 2px)",
      backgroundSize: "220px 220px, 160px 160px",
      backgroundPosition: "30px 140px, 120px 40px",
      animation: "atlasEmberDrift 13s ease-in-out infinite",
      mixBlendMode: "screen",
    };
  }

  return null;
}
