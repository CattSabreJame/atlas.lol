import { NextResponse } from "next/server";

import { ensureDiscordBotReady } from "@/lib/discord-bot";
import { getDiscordOAuthEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const DISCORD_CONNECT_STATE_COOKIE = "atlas_discord_connect_state";

function buildEditorRedirect(origin: string, code: string): URL {
  const url = new URL("/editor", origin);
  url.searchParams.set("discord", code);
  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  try {
    const oauth = getDiscordOAuthEnv();

    if (!oauth) {
      return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "oauth_missing"));
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authUrl = new URL("/auth", requestUrl.origin);
      authUrl.searchParams.set("next", "/editor");
      return NextResponse.redirect(authUrl);
    }

    await ensureDiscordBotReady().catch(() => undefined);

    const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
    const redirectUri = `${requestUrl.origin}/api/integrations/discord/callback`;
    const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", oauth.clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", "identify guilds.join");
    authorizeUrl.searchParams.set("prompt", "consent");
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(DISCORD_CONNECT_STATE_COOKIE, `${state}:${user.id}`, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: requestUrl.protocol === "https:",
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    console.error("Discord connect route failed", error);
    return NextResponse.redirect(buildEditorRedirect(requestUrl.origin, "unknown_error"));
  }
}
