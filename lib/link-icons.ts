export function withProtocol(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value.trim()));
}

export function getOriginFromUrl(value: string): string | null {
  try {
    return new URL(withProtocol(value)).origin;
  } catch {
    return null;
  }
}

export function getSiteFaviconUrl(value: string): string | null {
  const origin = getOriginFromUrl(value);
  if (!origin) {
    return null;
  }

  return `${origin}/favicon.ico`;
}

export function getFallbackFaviconUrl(value: string): string | null {
  const origin = getOriginFromUrl(value);
  if (!origin) {
    return null;
  }

  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(origin)}`;
}

export function isLikelyCustomTextIcon(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }

  return trimmed.length <= 6;
}

export function resolveLinkIconValue(url: string, customIcon?: string | null): string | null {
  const trimmedIcon = customIcon?.trim() ?? "";

  if (trimmedIcon) {
    return trimmedIcon;
  }

  return getSiteFaviconUrl(url);
}
