import { BadgeType } from "@/types/db";

export const PREMIUM_BADGE: BadgeType = "pro";

export function hasPremiumBadge(badges: ReadonlyArray<BadgeType | string> | null | undefined): boolean {
  if (!Array.isArray(badges)) {
    return false;
  }

  return badges.some((badge) => String(badge).toLowerCase() === PREMIUM_BADGE);
}

interface PremiumCursorGateInput {
  hasPremium: boolean;
  cursorEnabled: boolean;
  cursorTrailsEnabled: boolean;
  activeCursorId: string | null;
}

export function getPremiumCursorGateMessage(input: PremiumCursorGateInput): string | null {
  if (input.hasPremium) {
    return null;
  }

  if (input.cursorEnabled || input.cursorTrailsEnabled || Boolean(input.activeCursorId)) {
    return "Cursor Studio";
  }

  return null;
}
