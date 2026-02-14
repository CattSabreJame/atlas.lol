export type MusicEmbedProvider = "audio" | "youtube" | "spotify" | "soundcloud" | "apple" | "unknown";

export interface MusicEmbedResolution {
  provider: MusicEmbedProvider;
  embedUrl: string;
  embeddable: boolean;
  converted: boolean;
  hint: string;
}

interface MusicSearchLink {
  label: string;
  href: string;
}

const AUDIO_URL_REGEX = /\.(m4a|mp3|wav|ogg|aac|flac|mp4|opus|webm)(\?|$)/i;

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

function looksLikeAudioUrl(url: URL): boolean {
  if (AUDIO_URL_REGEX.test(url.href)) {
    return true;
  }

  const path = url.pathname.toLowerCase();

  if (/\.(m4a|mp3|wav|ogg|aac|flac|mp4|opus|webm)$/.test(path)) {
    return true;
  }

  const filenameHint = url.searchParams.get("filename") ?? url.searchParams.get("file") ?? "";

  if (/\.(m4a|mp3|wav|ogg|aac|flac|mp4|opus|webm)$/i.test(filenameHint)) {
    return true;
  }

  // Treat URLs from the profile music bucket as audio sources.
  if (path.includes("/storage/v1/object/public/profile-music/")) {
    return true;
  }

  return false;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function extractYouTubeId(url: URL): string | null {
  const host = normalizeHost(url.hostname);

  if (host === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!host.includes("youtube.com")) {
    return null;
  }

  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (!segments.length) {
    return null;
  }

  if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
    return segments[1] ?? null;
  }

  return null;
}

function resolveSpotifyEmbed(url: URL): MusicEmbedResolution | null {
  const host = normalizeHost(url.hostname);

  if (!host.includes("spotify.com")) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (!segments.length) {
    return null;
  }

  if (segments[0].startsWith("intl-")) {
    segments.shift();
  }

  if (!segments.length) {
    return null;
  }

  const currentPath = segments.join("/");

  return {
    provider: "spotify",
    embedUrl: `https://open.spotify.com/${currentPath}`,
    embeddable: false,
    converted: false,
    hint: "Spotify links are not direct audio files. Use an .mp3/.m4a URL for the custom player.",
  };
}

export function resolveMusicEmbedUrl(raw: string): MusicEmbedResolution {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      provider: "unknown",
      embedUrl: trimmed,
      embeddable: false,
      converted: false,
      hint: "Paste a music page URL or direct audio URL.",
    };
  }

  if (AUDIO_URL_REGEX.test(trimmed) || trimmed.toLowerCase().includes("audio-ssl.itunes.apple.com")) {
    return {
      provider: "audio",
      embedUrl: trimmed,
      embeddable: true,
      converted: false,
      hint: "Direct audio URL detected. It will play with audio controls.",
    };
  }

  const parsed = safeParseUrl(trimmed);

  if (!parsed) {
    return {
      provider: "unknown",
      embedUrl: trimmed,
      embeddable: false,
      converted: false,
      hint: "URL format looks invalid.",
    };
  }

  if (looksLikeAudioUrl(parsed)) {
    return {
      provider: "audio",
      embedUrl: trimmed,
      embeddable: true,
      converted: false,
      hint: "Direct audio URL detected. It will play with audio controls.",
    };
  }

  const host = normalizeHost(parsed.hostname);

  const spotify = resolveSpotifyEmbed(parsed);

  if (spotify) {
    return spotify;
  }

  const youtubeId = extractYouTubeId(parsed);

  if (youtubeId) {
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      embeddable: false,
      converted: false,
      hint: "YouTube links are not direct audio files. Use an .mp3/.m4a URL for the custom player.",
    };
  }

  if (host.includes("soundcloud.com") || host === "snd.sc") {
    return {
      provider: "soundcloud",
      embedUrl: trimmed,
      embeddable: false,
      converted: false,
      hint: "SoundCloud links are not direct audio files. Use an .mp3/.m4a URL for the custom player.",
    };
  }

  if (host === "embed.music.apple.com") {
    return {
      provider: "apple",
      embedUrl: trimmed,
      embeddable: false,
      converted: false,
      hint: "Apple Music links are not direct audio files. Use an .mp3/.m4a URL for the custom player.",
    };
  }

  if (host === "music.apple.com") {
    return {
      provider: "apple",
      embedUrl: trimmed,
      embeddable: false,
      converted: false,
      hint: "Apple Music links are not direct audio files. Use an .mp3/.m4a URL for the custom player.",
    };
  }

  return {
    provider: "unknown",
    embedUrl: trimmed,
    embeddable: false,
    converted: false,
    hint: "Not auto-detected. Paste a direct audio URL (.mp3, .m4a, .wav, .ogg).",
  };
}

export function getMusicProviderSearchLinks(query: string): MusicSearchLink[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const encoded = encodeURIComponent(trimmed);

  return [
    { label: "Spotify", href: `https://open.spotify.com/search/${encoded}` },
    { label: "YouTube", href: `https://www.youtube.com/results?search_query=${encoded}` },
    { label: "SoundCloud", href: `https://soundcloud.com/search/sounds?q=${encoded}` },
    { label: "Apple Music", href: `https://music.apple.com/us/search?term=${encoded}` },
  ];
}
