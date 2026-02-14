export const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;

export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export function ensureHandlePrefix(handle: string): string {
  return `@${handle.replace(/^@+/, "")}`;
}

export function createDefaultHandle(userId: string): string {
  return `user_${userId.replaceAll("-", "").slice(0, 8)}`;
}
