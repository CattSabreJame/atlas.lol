import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeHandle } from "@/lib/handles";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { handleSchema } from "@/lib/validations";

const adminUserBodySchema = z.object({
  handle: handleSchema,
  makeAdmin: z.boolean(),
});

interface AdminUserRow {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  created_at: string | null;
  is_admin?: boolean;
}

function mapRpcError(error: { code?: string; message?: string }) {
  if (error.code === "42501") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (error.code === "22023") {
    return NextResponse.json({ error: error.message ?? "Invalid admin action." }, { status: 400 });
  }

  return NextResponse.json({ error: "Unable to process admin request." }, { status: 500 });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("admin_list_admin_users");

  if (error) {
    return mapRpcError(error);
  }

  return NextResponse.json({ admins: (data ?? []) as AdminUserRow[] });
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

  const parsed = adminUserBodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid admin user payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("admin_set_user_admin", {
    p_handle: normalizeHandle(parsed.data.handle),
    p_make_admin: parsed.data.makeAdmin,
  });

  if (error) {
    return mapRpcError(error);
  }

  return NextResponse.json({ result: ((data ?? []) as AdminUserRow[])[0] ?? null });
}
