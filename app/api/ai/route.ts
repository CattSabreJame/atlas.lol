import { NextResponse } from "next/server";
import { z } from "zod";

import { createFallbackResult } from "@/lib/ai/fallback";
import { extractJsonObject } from "@/lib/ai/parse";
import { buildAiUserPrompt, AI_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { consumeAiToken } from "@/lib/ai/rate-limit";
import { AI_REFUSAL_MESSAGE, isUnsafePrompt } from "@/lib/ai/safety";
import { getGroqEnv, isGroqConfigured } from "@/lib/env";
import { hasPremiumBadge } from "@/lib/premium";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";
import { aiRequestSchema } from "@/lib/validations";

const bioGenerateResultSchema = z.object({
  options: z.array(z.string().trim().min(8).max(320)).length(3),
});

const linkLabelResultSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(120).optional().default(""),
});

const bioPolishResultSchema = z.object({
  minimal: z.string().trim().min(8).max(320),
  expressive: z.string().trim().min(8).max(320),
});

function validateAiResult(payload: z.infer<typeof aiRequestSchema>, value: unknown) {
  if (payload.action === "bio-generate") {
    return bioGenerateResultSchema.safeParse(value);
  }

  if (payload.action === "link-label") {
    return linkLabelResultSchema.safeParse(value);
  }

  return bioPolishResultSchema.safeParse(value);
}

function getSafetyInput(payload: z.infer<typeof aiRequestSchema>): string {
  switch (payload.action) {
    case "bio-generate":
      return `${payload.vibe} ${payload.interests}`;
    case "link-label":
      return `${payload.vibe} ${payload.url}`;
    case "bio-polish":
      return `${payload.vibe} ${payload.bio}`;
    default:
      return "";
  }
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

  const parsedPayload = aiRequestSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json({ error: "Invalid AI request." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("badges")
    .eq("id", user.id)
    .maybeSingle<{ badges: string[] | null }>();

  if (!hasPremiumBadge(profile?.badges)) {
    return NextResponse.json(
      { error: "AI Assist requires the Pro badge. Open a Discord ticket to upgrade." },
      { status: 403 },
    );
  }

  if (!consumeAiToken(user.id)) {
    return NextResponse.json(
      { error: "Rate limit reached. Try again in a minute." },
      { status: 429 },
    );
  }

  if (isUnsafePrompt(getSafetyInput(parsedPayload.data))) {
    return NextResponse.json({ error: AI_REFUSAL_MESSAGE }, { status: 400 });
  }

  const fallback = createFallbackResult(parsedPayload.data);

  if (!isGroqConfigured()) {
    return NextResponse.json({ configured: false, result: fallback });
  }

  const { apiKey, model } = getGroqEnv();

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content: AI_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildAiUserPrompt(parsedPayload.data),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "AI is currently unavailable. Try again shortly." },
        { status: 502 },
      );
    }

    const completion = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = completion.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ configured: true, result: fallback });
    }

    const extracted = extractJsonObject(content);
    const parsedResult = validateAiResult(parsedPayload.data, extracted);

    if (!parsedResult.success) {
      return NextResponse.json({ configured: true, result: fallback });
    }

    return NextResponse.json({
      configured: true,
      result: parsedResult.data,
    });
  } catch {
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 500 },
    );
  }
}
