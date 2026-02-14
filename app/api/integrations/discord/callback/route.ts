import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isDiscordUserId } from "@/lib/discord";
import { getDiscordOAuthEnv, getDiscordPresenceBotEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DISCORD_CONNECT_STATE_COOKIE = "atlas_discord_connect_state";

function buildEditorRedirect(origin: string, code: string): URL {
  const url = new URL("/editor", origin);
  url.searchParams.set("discord", code);
  return url;
}

async function exchangeDiscordCodeForAccessToken(code: string, redirectUri: string): Promise<string | null> {
  const oauth = getDiscordOAuthEnv();

  if (!oauth) {
    return null;
  }

  const body = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access_token?: unknown;
    scope?: unknown;
  };
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  if (!accessToken) {
    return null;
  }
  return accessToken;
}

async function fetchDiscordUserIdentity(
  accessToken: string,
): Promise<{ userId: string | null; scopes: string[] }> {
  const oauthResponse = await fetch("https://discord.com/api/v10/oauth2/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  }).catch(() => null);

  let scopes: string[] = [];
  let oauthUserId: string | null = null;

  if (oauthResponse && oauthResponse.ok) {
    const oauthPayload = (await oauthResponse.json()) as {
      scopes?: unknown;
      user?: {
        id?: unknown;
      };
    };

    scopes = Array.isArray(oauthPayload.scopes)
      ? oauthPayload.scopes.filter((item): item is string => typeof item === "string")
      : [];

    const candidate = typeof oauthPayload.user?.id === "string" ? oauthPayload.user.id : null;
    oauthUserId = isDiscordUserId(candidate) ? candidate : null;
  }

  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return {
      userId: oauthUserId,
      scopes,
    };
  }

  const payload = (await response.json()) as { id?: unknown };
  const candidate = typeof payload.id === "string" ? payload.id : null;
  return {
    userId: isDiscordUserId(candidate) ? candidate : oauthUserId,
    scopes,
  };
}

async function tryJoinConfiguredDiscordGuild(discordUserId: string, accessToken: string): Promise<boolean> {
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
      access_token: accessToken,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return false;
  }

  if (response.status === 201 || response.status === 204) {
    return true;
  }

  const raw = await response.text().catch(() => "");
  console.error("Discord direct connect guild join failed", {
    status: response.status,
    guildId: botConfig.guildId,
    discordUserId,
    body: raw.slice(0, 400),
  });
  return false;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code")?.trim() ?? "";
  const state = requestUrl.searchParams.get("state")?.trim() ?? "";
  const redirectUri = `${requestUrl.origin}/api/integrations/discord/callback`;

  try {
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get(DISCORD_CONNECT_STATE_COOKIE)?.value ?? "";
    const [expectedState, expectedUserId] = stateCookie.split(":");

    const response = NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "connected"));
    response.cookies.set(DISCORD_CONNECT_STATE_COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      maxAge: 0,
    });

    if (!code || !state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "state_error"));
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "auth_required"));
    }

    if (expectedUserId && expectedUserId !== user.id) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "state_user_mismatch"));
    }

    const accessToken = await exchangeDiscordCodeForAccessToken(code, redirectUri);

    if (!accessToken) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "token_error"));
    }

    const identity = await fetchDiscordUserIdentity(accessToken);
    const discordUserId = identity.userId;

    if (!discordUserId) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "identity_error"));
    }

    if (!identity.scopes.includes("guilds.join")) {
      console.error("Discord direct connect scope missing guilds.join", {
        scopes: identity.scopes,
        discordUserId,
      });
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "scope_missing"));
    }

    const joined = await tryJoinConfiguredDiscordGuild(discordUserId, accessToken);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        discord_user_id: discordUserId,
        discord_presence_enabled: true,
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "profile_update_error"));
    }

    if (!joined) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "join_failed"));
    }

    return response;
  } catch (error) {
    console.error("Discord direct connect callback failed", error);
    return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "unknown_error"));
  }
}
