const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

interface DiscordPresenceBotEnv {
  token: string;
  guildId: string;
}

interface DiscordOAuthEnv {
  clientId: string;
  clientSecret: string;
}

interface SmtpEnv {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLocalhostBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.",
    );
  }

  return { url, anonKey };
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return key;
}

export function getGroqEnv() {
  return {
    apiKey: process.env.GROQ_API_KEY ?? "",
    model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
  };
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getDiscordAppealUrl(): string {
  return process.env.NEXT_PUBLIC_DISCORD_APPEAL_URL ?? "https://discord.gg/";
}

export function getDiscordPremiumTicketUrl(): string {
  return process.env.NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL ?? getDiscordAppealUrl();
}

export function getDiscordPresenceBotEnv(): DiscordPresenceBotEnv | null {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  const guildId = process.env.DISCORD_PRESENCE_GUILD_ID?.trim();

  if (!token || !guildId) {
    return null;
  }

  return { token, guildId };
}

export function getDiscordOAuthEnv(): DiscordOAuthEnv | null {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getSiteBaseUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL
    ?? process.env.SITE_URL
    ?? "https://joinatlas.dev/";

  const normalizedCandidate = normalizeBaseUrl(candidate);

  if (isLocalhostBaseUrl(normalizedCandidate)) {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

    if (isProduction) {
      const vercelUrl = process.env.VERCEL_URL?.trim();

      if (vercelUrl) {
        const sanitizedVercelHost = vercelUrl.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

        if (sanitizedVercelHost) {
          return `https://${sanitizedVercelHost}`;
        }
      }

      return "https://joinatlas.dev";
    }
  }

  return normalizedCandidate;
}

export function getSmtpEnv(): SmtpEnv | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "Atlas";
  const rawPort = process.env.SMTP_PORT?.trim() || "587";
  const parsedPort = Number.parseInt(rawPort, 10);
  const secure = process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || parsedPort === 465;

  if (!host || !user || !pass || !fromEmail || Number.isNaN(parsedPort) || parsedPort <= 0) {
    return null;
  }

  return {
    host,
    port: parsedPort,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
  };
}
