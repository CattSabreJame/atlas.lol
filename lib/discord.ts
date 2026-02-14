export type DiscordStatus = "online" | "idle" | "dnd" | "offline";

export function isDiscordUserId(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9]{17,20}$/.test(value));
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
}

function pickDiscordIdCandidate(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();

    if (isDiscordUserId(normalized)) {
      return normalized;
    }
  }

  return null;
}

export function extractDiscordUserIdFromIdentity(identity: unknown): string | null {
  const source = toRecord(identity);
  const identityData = toRecord(source.identity_data);

  return pickDiscordIdCandidate(
    source.provider_id,
    identityData.sub,
    identityData.id,
    identityData.user_id,
    identityData.discord_id,
    source.identity_id,
    source.id,
  );
}

export function normalizeDiscordStatus(value: unknown): DiscordStatus {
  if (value === "online" || value === "idle" || value === "dnd" || value === "offline") {
    return value;
  }

  return "offline";
}
