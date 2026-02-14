import { NextResponse } from "next/server";

import { consumeCommentToken } from "@/lib/comments-rate-limit";
import { getRequestIp, rejectCrossOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const ip = getRequestIp(request);
  const rateKey = `${ip}:${parsed.data.handle}`;

  if (!consumeCommentToken(rateKey)) {
    return NextResponse.json(
      { error: "Too many comments. Please try again shortly." },
      { status: 429 },
    );
  }

  let supabase;

  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Comments are unavailable right now." }, { status: 503 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_public, comments_enabled")
    .eq("handle", parsed.data.handle)
    .maybeSingle<{ id: string; is_public: boolean; comments_enabled: boolean }>();

  if (!profile || !profile.is_public || !profile.comments_enabled) {
    return NextResponse.json({ error: "Comments are unavailable for this profile." }, { status: 403 });
  }

  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      user_id: profile.id,
      author_name: parsed.data.authorName,
      author_website: parsed.data.authorWebsite || null,
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
