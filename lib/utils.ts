export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function toPublicProfileUrl(handle: string): string {
  return `/@${handle.replace(/^@+/, "")}`;
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function websiteFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}
