const BASIC_PLATFORM_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "soundcloud.com",
  "snd.sc",
  "spotify.com",
  "discord.gg",
  "discord.com",
];

const EXTENDED_MUSIC_DOMAINS = [
  ...BASIC_PLATFORM_DOMAINS,
  "music.apple.com",
  "itunes.apple.com",
  "audio-ssl.itunes.apple.com",
  "catbox.moe",
];

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function hostMatchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isAllowedHost(hostname: string, domains: string[]): boolean {
  return domains.some((domain) => hostMatchesDomain(hostname, domain));
}

export function isAllowedBasicPlatformUrl(value: string | null | undefined): boolean {
  const parsed = parseHttpUrl(value);

  if (!parsed) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  return isAllowedHost(host, BASIC_PLATFORM_DOMAINS);
}

export function isAllowedMusicUrl(value: string | null | undefined): boolean {
  const parsed = parseHttpUrl(value);

  if (!parsed) {
    return false;
  }

  const host = parsed.hostname.toLowerCase();

  if (isAllowedHost(host, EXTENDED_MUSIC_DOMAINS)) {
    return true;
  }

  if (
    host.endsWith(".supabase.co")
    && parsed.pathname.startsWith("/storage/v1/object/public/profile-music/")
  ) {
    return true;
  }

  return false;
}
