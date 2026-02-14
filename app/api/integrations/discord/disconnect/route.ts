import { NextResponse } from "next/server";

import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);

  if (rejected) {
    return rejected;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: identitiesData, error: identityError } = await supabase.auth.getUserIdentities();

    if (identityError) {
      return NextResponse.json({ error: "Unable to access linked identities." }, { status: 500 });
    }

    const discordIdentity = identitiesData?.identities?.find((identity) => identity.provider === "discord");

    if (discordIdentity) {
      const { error: unlinkError } = await supabase.auth.unlinkIdentity(discordIdentity);

      if (unlinkError) {
        return NextResponse.json({ error: "Unable to unlink Discord right now." }, { status: 500 });
      }
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        discord_presence_enabled: false,
        discord_user_id: null,
      })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json({ error: "Unable to clear Discord settings." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Discord disconnect is unavailable." }, { status: 503 });
  }
}
