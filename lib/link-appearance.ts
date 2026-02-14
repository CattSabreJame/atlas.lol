import { LinkEffect } from "@/types/db";

export const LINK_EFFECT_OPTIONS: Array<{
  value: LinkEffect;
  label: string;
  description: string;
}> = [
  { value: "none", label: "None", description: "No additional motion or glow." },
  { value: "glow", label: "Glow", description: "Soft ambient glow around link icons." },
  { value: "outline", label: "Outline", description: "Sharper border emphasis." },
  { value: "lift", label: "Lift", description: "Raised hover depth with stronger shadow." },
  { value: "pulse", label: "Pulse", description: "Subtle breathing glow animation." },
];

export function getLinkEffectClass(effect: LinkEffect): string {
  if (effect === "glow") {
    return "link-effect-glow";
  }

  if (effect === "outline") {
    return "link-effect-outline";
  }

  if (effect === "lift") {
    return "link-effect-lift";
  }

  if (effect === "pulse") {
    return "link-effect-pulse";
  }

  return "";
}

export function normalizeHexColor(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return { r, g, b };
}

export function getLinkIconTintImageStyle(tint: string | null | undefined): { filter: string } | undefined {
  const color = normalizeHexColor(tint);
  if (!color) {
    return undefined;
  }

  const { r, g, b } = hexToRgb(color);
  return {
    filter:
      `brightness(0) saturate(100%) ` +
      `drop-shadow(0 0 0 rgb(${r} ${g} ${b} / 0.95)) ` +
      `drop-shadow(0 0 6px rgb(${r} ${g} ${b} / 0.35))`,
  };
}

export function getLinkIconTintTextStyle(
  tint: string | null | undefined,
): { color: string; textShadow: string } | undefined {
  const color = normalizeHexColor(tint);
  if (!color) {
    return undefined;
  }

  return {
    color,
    textShadow: `0 0 8px color-mix(in srgb, ${color} 55%, transparent)`,
  };
}

export function getLinkIconTintFallbackStyle(
  tint: string | null | undefined,
): { backgroundColor: string; boxShadow: string } | undefined {
  const color = normalizeHexColor(tint);
  if (!color) {
    return undefined;
  }

  return {
    backgroundColor: color,
    boxShadow: `0 0 10px color-mix(in srgb, ${color} 56%, transparent)`,
  };
}
