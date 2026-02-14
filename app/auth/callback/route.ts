import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

import { extractDiscordUserIdFromIdentity, isDiscordUserId } from "@/lib/discord";
import { getDiscordPresenceBotEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);
const PROFILE_BADGES = new Set(["owner", "admin", "staff", "verified", "pro", "founder"]);

function normalizeBadgeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((badge): badge is string => typeof badge === "string")
    .map((badge) => badge.trim().toLowerCase())
    .filter((badge) => PROFILE_BADGES.has(badge));
}

async function ensureVerifiedBadge(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  emailConfirmedAt: string | null | undefined,
): Promise<void> {
  if (!emailConfirmedAt) {
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("badges")
    .eq("id", userId)
    .maybeSingle<{ badges: unknown }>();

  if (profileError || !profile) {
    return;
  }

  const existingBadges = normalizeBadgeArray(profile.badges);

  if (existingBadges.includes("verified")) {
    return;
  }

  const nextBadges = Array.from(new Set([...existingBadges, "verified"]));
  await supabase.from("profiles").update({ badges: nextBadges }).eq("id", userId);
}

async function tryJoinConfiguredDiscordGuild(
  discordUserId: string,
  providerToken: string,
): Promise<boolean> {
  const botConfig = getDiscordPresenceBotEnv();

  if (!botConfig) {
    return false;
  }

  const response = await fetch(`https://discord.com/api/v10/guilds/${botConfig.guildId}/members/${discordUserId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botConfig.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      access_token: providerToken,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return false;
  }

  if (response.status === 201 || response.status === 204) {
    return true;
  }

  const errorBody = await response.text().catch(() => "");
  console.error("Discord guild join failed", {
    status: response.status,
    body: errorBody.slice(0, 400),
  });
  return false;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";
  const type = requestUrl.searchParams.get("type");
  const source = requestUrl.searchParams.get("source");
  const targetPath =
    type === "recovery" ? "/auth/update-password" : next.startsWith("/") ? next : "/dashboard";
  let supabaseClient: Awaited<ReturnType<typeof createClient>> | null = null;

  if (code || tokenHash) {
    supabaseClient = await createClient();

    if (tokenHash && type && EMAIL_OTP_TYPES.has(type as EmailOtpType)) {
      const { error: verifyError } = await supabaseClient.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });

      if (verifyError) {
        return NextResponse.redirect(new URL("/auth?error=callback", requestUrl.origin));
      }
    }
  }

  if (code) {
    const supabase = supabaseClient ?? await createClient();
    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/auth?error=callback", requestUrl.origin));
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await ensureVerifiedBadge(supabase, user.id, user.email_confirmed_at);

      try {
        let discordUserId: string | null = null;
        const providerTokenFromExchange = exchangeData.session?.provider_token ?? null;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const providerToken = providerTokenFromExchange ?? session?.provider_token ?? null;

        if (source === "discord-link" && providerToken) {
          const discordResponse = await fetch("https://discord.com/api/v10/users/@me", {
            headers: {
              Authorization: `Bearer ${providerToken}`,
            },
            cache: "no-store",
          });

          if (discordResponse.ok) {
            const discordUser = (await discordResponse.json()) as { id?: unknown };
            const candidateId = typeof discordUser.id === "string" ? discordUser.id : null;

            if (isDiscordUserId(candidateId)) {
              discordUserId = candidateId;
            }
          }
        }

        if (!discordUserId) {
          const { data: identitiesData } = await supabase.auth.getUserIdentities();
          const discordIdentity = identitiesData?.identities?.find((identity) => identity.provider === "discord");
          discordUserId = extractDiscordUserIdFromIdentity(discordIdentity);
        }

        if (discordUserId) {
          if (source === "discord-link" && providerToken) {
            await tryJoinConfiguredDiscordGuild(discordUserId, providerToken);
          }

          const updates: Record<string, unknown> = {
            discord_user_id: discordUserId,
          };

          if (source === "discord-link") {
            updates.discord_presence_enabled = true;
          }

          await supabase.from("profiles").update(updates).eq("id", user.id);
        }
      } catch {
        // OAuth callback should still complete if discord sync fails.
      }
    }
  }

  if (!code && supabaseClient) {
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (user) {
      await ensureVerifiedBadge(supabaseClient, user.id, user.email_confirmed_at);
    }
  }

  const redirectTo = new URL(targetPath, requestUrl.origin);
  return NextResponse.redirect(redirectTo);
}
