const CATBOX_HOST_PATTERN = /(^|\.)catbox\.moe$/i;

export function isCatboxUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" && CATBOX_HOST_PATTERN.test(parsed.hostname);
  } catch {
    return false;
  }
}
