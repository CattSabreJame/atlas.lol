import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHandle } from "@/lib/handles";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { badgeSchema, handleSchema } from "@/lib/validations";

const adminBadgeBodySchema = z.object({
  handle: handleSchema,
  badges: z.array(badgeSchema).max(6),
});

interface AdminBadgeProfile {
  id: string;
  handle: string;
  display_name: string | null;
  badges: string[];
  is_public: boolean;
  updated_at: string;
}

function mapRpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
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

  const rows = (data ?? []) as AdminBadgeProfile[];
  const profile = rows[0];

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile });
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

  const parsedPayload = adminBadgeBodySchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid badge payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const uniqueBadges = Array.from(new Set(parsedPayload.data.badges));

  const { data, error } = await supabase.rpc("admin_set_profile_badges", {
    p_handle: parsedPayload.data.handle,
    p_badges: uniqueBadges,
  });

  if (error) {
    if (error.code === "22023") {
      return NextResponse.json({ error: "Invalid badge selection." }, { status: 400 });
    }

    return mapRpcError(error);
  }

  const rows = (data ?? []) as AdminBadgeProfile[];
  const profile = rows[0];

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  return NextResponse.json({ profile });
}
