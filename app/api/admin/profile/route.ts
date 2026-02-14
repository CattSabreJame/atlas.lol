import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHandle } from "@/lib/handles";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { badgeSchema, handleSchema } from "@/lib/validations";

const adminProfileBodySchema = z.object({
  handle: handleSchema,
  badges: z.array(badgeSchema).max(6),
  isPublic: z.boolean(),
  commentsEnabled: z.boolean(),
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

  if (error.code === "22023") {
    return NextResponse.json({ error: error.message ?? "Invalid admin payload." }, { status: 400 });
  }

  if (error.code === "23514") {
    return NextResponse.json({ error: error.message ?? "Invalid profile state." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unable to process admin request." }, { status: 500 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsedHandle = handleSchema.safeParse(normalizeHandle(url.searchParams.get("handle") ?? ""));

  if (!parsedHandle.success) {
    return NextResponse.json({ error: "Invalid handle." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_get_profile_for_badges", {
    p_handle: parsedHandle.data,
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

  const parsed = adminProfileBodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid admin profile payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const uniqueBadges = Array.from(new Set(parsed.data.badges));
  const { data, error } = await supabase.rpc("admin_update_profile", {
    p_handle: parsed.data.handle,
    p_badges: uniqueBadges,
    p_is_public: parsed.data.isPublic,
    p_comments_enabled: parsed.data.commentsEnabled,
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
