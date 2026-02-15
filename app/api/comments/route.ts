import { NextResponse } from "next/server";

import { consumeCommentToken } from "@/lib/comments-rate-limit";
import { ensureHandlePrefix } from "@/lib/handles";
import { getRequestIp, rejectCrossOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { commentCreateSchema } from "@/lib/validations";
import { CommentRow } from "@/types/db";

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

  const parsed = commentCreateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to post comments." }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const rateKey = `${ip}:${user.id}:${parsed.data.handle}`;

  if (!consumeCommentToken(rateKey)) {
    return NextResponse.json(
      { error: "Too many comments. Please try again shortly." },
      { status: 429 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;

  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Comments are unavailable right now." }, { status: 503 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, is_public, comments_enabled")
    .eq("handle", parsed.data.handle)
    .maybeSingle<{ id: string; is_public: boolean; comments_enabled: boolean }>();

  if (!profile || !profile.is_public || !profile.comments_enabled) {
    return NextResponse.json({ error: "Comments are unavailable for this profile." }, { status: 403 });
  }

  const { data: commenterProfile } = await admin
    .from("profiles")
    .select("handle, display_name")
    .eq("id", user.id)
    .maybeSingle<{ handle: string; display_name: string | null }>();

  if (!commenterProfile) {
    return NextResponse.json({ error: "Unable to verify your commenter profile." }, { status: 403 });
  }

  const authorName =
    commenterProfile.display_name?.trim() || ensureHandlePrefix(commenterProfile.handle);

  const { data: comment, error } = await admin
    .from("comments")
    .insert({
      user_id: profile.id,
      author_name: authorName,
      author_website: null,
      body: parsed.data.body,
      status: "published",
    })
    .select("*")
    .single<CommentRow>();

  if (error || !comment) {
    return NextResponse.json({ error: "Unable to post comment." }, { status: 500 });
  }

  return NextResponse.json({ comment });
}
