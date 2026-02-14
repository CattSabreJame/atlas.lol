import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getRequestIp, rejectCrossOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeHandle } from "@/lib/handles";
import { consumeTrackingToken } from "@/lib/tracking-rate-limit";
import { trackViewQuerySchema } from "@/lib/validations";

async function fallbackIncrementProfileView(supabase: SupabaseClient, handle: string): Promise<boolean> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle)
    .eq("is_public", true)
    .maybeSingle<{ id: string }>();

  if (profileError) {
    return false;
  }

  if (!profile?.id) {
    return true;
  }

  const day = new Date().toISOString().slice(0, 10);
  const { data: existing, error: existingError } = await supabase
    .from("analytics_daily")
    .select("id, profile_views")
    .eq("user_id", profile.id)
    .eq("day", day)
    .maybeSingle<{ id: string; profile_views: number }>();

  if (existingError) {
    return false;
  }

  if (!existing?.id) {
    const { error: insertError } = await supabase
      .from("analytics_daily")
      .insert({ user_id: profile.id, day, profile_views: 1 });

    return !insertError;
  }

  const { error: updateError } = await supabase
    .from("analytics_daily")
    .update({ profile_views: existing.profile_views + 1 })
    .eq("id", existing.id);

  return !updateError;
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);

  if (rejected) {
    return rejected;
  }

  try {
    const ip = getRequestIp(request);

    if (!consumeTrackingToken(`view:${ip}`)) {
      return NextResponse.json({ error: "Too many tracking requests." }, { status: 429 });
    }

    const url = new URL(request.url);
    const parsed = trackViewQuerySchema.safeParse({
      handle: normalizeHandle(url.searchParams.get("handle") ?? ""),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid handle." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc("increment_profile_view", {
      p_handle: parsed.data.handle,
    });

    if (error) {
      const fallbackOk = await fallbackIncrementProfileView(supabase, parsed.data.handle);

      if (!fallbackOk) {
        return NextResponse.json({ error: "Unable to track profile view." }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tracking is unavailable." }, { status: 503 });
  }
}
