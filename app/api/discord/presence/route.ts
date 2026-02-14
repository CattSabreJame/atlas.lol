import { NextResponse } from "next/server";

import { getDiscordPresenceFromBot } from "@/lib/discord-bot";
import { type DiscordStatus, isDiscordUserId } from "@/lib/discord";

export const runtime = "nodejs";

function emptyPresenceResponse(status: DiscordStatus = "offline") {
  return {
    status,
    username: null,
    globalName: null,
    avatarUrl: null,
    activity: null,
    listening: null,
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const userId = requestUrl.searchParams.get("userId")?.trim() ?? "";
  const includeActivity = requestUrl.searchParams.get("activity") !== "0";

  if (!isDiscordUserId(userId)) {
    return NextResponse.json({ error: "Invalid Discord user ID." }, { status: 400 });
  }

  try {
    const presence = await getDiscordPresenceFromBot(userId, includeActivity);

    if (!presence) {
      return NextResponse.json(emptyPresenceResponse());
    }

    return NextResponse.json(presence);
  } catch {
    return NextResponse.json(emptyPresenceResponse());
  }
}
