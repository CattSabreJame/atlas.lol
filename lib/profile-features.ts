import { BadgeType, ProfileAnimation, ProfileEffect } from "@/types/db";

export interface BadgeOption {
  value: BadgeType;
  label: string;
  description: string;
}

export const BADGE_OPTIONS: BadgeOption[] = [
  { value: "owner", label: "Owner", description: "Primary owner of the platform or brand." },
  { value: "admin", label: "Admin", description: "Trusted administrator with platform-level responsibilities." },
  { value: "staff", label: "Staff", description: "Official team member." },
  { value: "verified", label: "Verified", description: "Identity or account authenticity confirmed." },
  { value: "pro", label: "Pro", description: "Professional-tier creator account." },
  { value: "founder", label: "Founder", description: "Early builder or project founder." },
];

export const BADGE_PRESETS: Array<{
  id: "team" | "trusted" | "founding";
  label: string;
  description: string;
  badges: BadgeType[];
}> = [
  {
    id: "team",
    label: "Team Set",
    description: "Owner, admin, and staff badges.",
    badges: ["owner", "admin", "staff"],
  },
  {
    id: "trusted",
    label: "Trusted Set",
    description: "Verified + pro badges.",
    badges: ["verified", "pro"],
  },
  {
    id: "founding",
    label: "Founding Set",
    description: "Founder + verified badges.",
    badges: ["founder", "verified"],
  },
];

const BADGE_MAP = BADGE_OPTIONS.reduce(
  (acc, option) => {
    acc[option.value] = option;
    return acc;
  },
  {} as Record<BadgeType, BadgeOption>,
);

export function getBadgeOption(badge: BadgeType): BadgeOption {
  return BADGE_MAP[badge];
}

export const PROFILE_ANIMATION_OPTIONS: Array<{
  value: ProfileAnimation;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "None",
    description: "No automatic profile animation.",
  },
  {
    value: "subtle",
    label: "Subtle",
    description: "Gentle movement for a premium feel.",
  },
  {
    value: "lift",
    label: "Lift",
    description: "Slight vertical motion on profile hero.",
  },
  {
    value: "pulse",
    label: "Pulse",
    description: "Soft scale pulse for profile identity.",
  },
];

export const PROFILE_EFFECT_OPTIONS: Array<{
  value: ProfileEffect;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "None",
    description: "Clean default rendering.",
  },
  {
    value: "glow",
    label: "Glow",
    description: "Visible animated edge glow around the profile card.",
  },
  {
    value: "grain",
    label: "Grain",
    description: "High-visibility animated film texture.",
  },
  {
    value: "scanlines",
    label: "Scanlines",
    description: "Moving horizontal scanline texture.",
  },
  {
    value: "halo",
    label: "Halo",
    description: "Animated ambient ring and pulse around the profile.",
  },
  {
    value: "velvet",
    label: "Velvet",
    description: "Animated matte gradient shell with deeper contrast.",
  },
  {
    value: "frost",
    label: "Frost",
    description: "Visible glass shimmer with frosted highlights.",
  },
];

export function normalizeBadges(input: BadgeType[] | null | undefined): BadgeType[] {
  if (!input || !Array.isArray(input)) {
    return [];
  }

  const allowed = new Set(BADGE_OPTIONS.map((item) => item.value));
  return input.filter((badge): badge is BadgeType => allowed.has(badge));
}
