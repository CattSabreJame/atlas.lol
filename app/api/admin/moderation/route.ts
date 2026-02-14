import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHandle } from "@/lib/handles";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { handleSchema } from "@/lib/validations";

const moderationActionSchema = z.enum([
  "ban",
  "unban",
  "remove_avatar",
  "remove_background",
  "reset_visuals",
  "clear_bio",
  "wipe_links",
  "purge_comments",
  "force_private",
  "force_public",
  "disable_comments",
  "enable_comments",
]);

const moderationBodySchema = z.object({
  handle: handleSchema,
  action: moderationActionSchema,
  reason: z.string().trim().min(3).max(500),
});

interface AdminProfileRow {
  id: string;
  handle: string;
  display_name: string | null;
  badges: string[];
  is_public: boolean;
  comments_enabled: boolean;
  avatar_url: string | null;
  profile_effect: string;
  background_mode: string;
  background_value: string | null;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
}

function mapRpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (error.code === "22023" || error.code === "23514") {
    return NextResponse.json({ error: error.message ?? "Invalid moderation action." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unable to process admin request." }, { status: 500 });
}

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);

  if (rejected) {
    return rejected;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = moderationBodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid moderation payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("admin_apply_profile_action", {
    p_handle: normalizeHandle(parsed.data.handle),
    p_action: parsed.data.action,
    p_reason: parsed.data.reason,
  });

  if (error) {
    return mapRpcError(error);
  }

  const row = ((data ?? []) as AdminProfileRow[])[0];

  if (!row) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile: row });
}
