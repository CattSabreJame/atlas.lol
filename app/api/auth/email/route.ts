import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteBaseUrl } from "@/lib/env";
import { getRequestIp, rejectCrossOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSmtpEmail } from "@/lib/smtp";
import { handleSchema } from "@/lib/validations";

export const runtime = "nodejs";

const emailSchema = z.string().trim().email("Enter a valid email address.").max(320);

const authEmailRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign-up"),
    email: emailSchema,
    password: z.string().min(8, "Password must be at least 8 characters."),
    handle: handleSchema,
    nextPath: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("magic"),
    email: emailSchema,
    nextPath: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("reset"),
    email: emailSchema,
  }),
]);

type AuthEmailRequest = z.infer<typeof authEmailRequestSchema>;

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

const rateBuckets = new Map<string, Bucket>();
const RATE_WINDOW_MS = 60_000;
const RATE_CAPACITY = 4;
const RATE_REFILL_PER_WINDOW = 4;

function refill(bucket: Bucket, now: number) {
  const elapsed = now - bucket.lastRefillAt;
  const refillAmount = (elapsed / RATE_WINDOW_MS) * RATE_REFILL_PER_WINDOW;
  bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + refillAmount);
  bucket.lastRefillAt = now;
}

function consumeRateToken(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? {
    tokens: RATE_CAPACITY,
    lastRefillAt: now,
  };

  refill(bucket, now);

  if (bucket.tokens < 1) {
    rateBuckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  rateBuckets.set(key, bucket);
  return true;
}

function normalizeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function buildCallbackLink(site: string, tokenHash: string, type: string, nextPath: string): string {
  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
    next: nextPath,
  });

  return `${site}/auth/callback?${params.toString()}`;
}

function isLocalhostUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function resolveEmailSiteUrl(request: Request): string {
  const configuredSite = getSiteBaseUrl();

  if (!isLocalhostUrl(configuredSite)) {
    return configuredSite;
  }

  const requestOrigin = new URL(request.url).origin;

  if (!isLocalhostUrl(requestOrigin)) {
    return requestOrigin;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    const normalized = vercelUrl.replace(/^https?:\/\//i, "");
    return `https://${normalized}`;
  }

  return "https://joinatlas.dev";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderAuthEmailTemplate(input: {
  preheader: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  details?: Array<{ label: string; value: string }>;
  footer: string;
}): { html: string; text: string } {
  const preheader = escapeHtml(input.preheader);
  const heading = escapeHtml(input.heading);
  const intro = escapeHtml(input.intro);
  const buttonLabel = escapeHtml(input.buttonLabel);
  const buttonUrl = escapeHtml(input.buttonUrl);
  const footer = escapeHtml(input.footer);
  const details = input.details ?? [];
  const detailsHtml = details.length > 0
    ? [
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;border-collapse:collapse;background:#f6f3ee;border:1px solid #e7e1d8;border-radius:12px;">',
      ...details.map((row) => [
        "<tr>",
        `<td style="padding:10px 14px 6px;font-size:12px;line-height:1.2;color:#7b7368;font-family:Inter,Helvetica,Arial,sans-serif;">${escapeHtml(row.label)}</td>`,
        "</tr>",
        "<tr>",
        `<td style="padding:0 14px 12px;font-size:14px;line-height:1.35;color:#1d1a16;font-family:Inter,Helvetica,Arial,sans-serif;font-weight:600;">${escapeHtml(row.value)}</td>`,
        "</tr>",
      ].join("")),
      "</table>",
    ].join("")
    : "";

  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "<title>Atlas</title>",
    "</head>",
    '<body style="margin:0;padding:0;background:#f3efe8;">',
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f3efe8;padding:20px 12px;">',
    "<tr>",
    '<td align="center" style="padding:22px 0;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#ffffff;border:1px solid #ded7cc;border-radius:16px;overflow:hidden;">',
    "<tr>",
    '<td style="padding:22px 26px;background:#101111;">',
    '<p style="margin:0;font-size:13px;line-height:1.2;letter-spacing:0.16em;text-transform:uppercase;color:#d6cec1;font-family:Inter,Helvetica,Arial,sans-serif;">Atlas</p>',
    '<p style="margin:8px 0 0;font-size:12px;line-height:1.35;color:#a59a8d;font-family:Inter,Helvetica,Arial,sans-serif;">no-reply@joinatlas.dev</p>',
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:26px 26px 22px;">',
    `<h1 style="margin:0;font-size:28px;line-height:1.12;color:#16130f;font-family:Inter,Helvetica,Arial,sans-serif;font-weight:700;letter-spacing:-0.02em;">${heading}</h1>`,
    `<p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#4a4339;font-family:Inter,Helvetica,Arial,sans-serif;">${intro}</p>`,
    `<p style="margin:24px 0 0;"><a href="${buttonUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#1b1713;color:#f4efe7;text-decoration:none;font-size:14px;line-height:1.2;font-family:Inter,Helvetica,Arial,sans-serif;font-weight:600;">${buttonLabel}</a></p>`,
    '<p style="margin:14px 0 0;font-size:12px;line-height:1.45;color:#7a7164;font-family:Inter,Helvetica,Arial,sans-serif;">If the button does not work, copy and paste this link:</p>',
    `<p style="margin:6px 0 0;word-break:break-all;font-size:12px;line-height:1.45;color:#5d554a;font-family:Inter,Helvetica,Arial,sans-serif;">${buttonUrl}</p>`,
    detailsHtml,
    `<p style="margin:18px 0 0;font-size:12px;line-height:1.55;color:#7a7164;font-family:Inter,Helvetica,Arial,sans-serif;">${footer}</p>`,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:14px 26px;background:#f7f4ee;border-top:1px solid #e7e1d8;">',
    '<p style="margin:0;font-size:11px;line-height:1.4;color:#8f8679;font-family:Inter,Helvetica,Arial,sans-serif;">Atlas · Premium link and profile platform</p>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");

  const text = [
    input.heading,
    "",
    input.intro,
    "",
    `${input.buttonLabel}:`,
    input.buttonUrl,
    ...details.flatMap((row) => ["", `${row.label}: ${row.value}`]),
    "",
    input.footer,
    "",
    "Sent by Atlas (no-reply@joinatlas.dev)",
  ].join("\n");

  return { html, text };
}

function buildSignupEmail(link: string, handle: string) {
  const rendered = renderAuthEmailTemplate({
    preheader: `Confirm @${handle} on Atlas`,
    heading: "Confirm your Atlas account",
    intro:
      "Welcome to Atlas. Confirm your email to activate your account and start building your public profile.",
    buttonLabel: "Confirm account",
    buttonUrl: link,
    details: [
      { label: "Handle", value: `@${handle}` },
      { label: "Access", value: "Create profile, publish links, and use the editor." },
    ],
    footer: "If you did not create this account, you can ignore this email.",
  });

  return {
    subject: "Confirm your Atlas account",
    text: rendered.text,
    html: rendered.html,
  };
}

function buildMagicEmail(link: string) {
  const rendered = renderAuthEmailTemplate({
    preheader: "Use your Atlas magic link to sign in",
    heading: "Sign in to Atlas",
    intro:
      "Your secure magic link is ready. Use it to sign in without entering your password.",
    buttonLabel: "Sign in now",
    buttonUrl: link,
    details: [
      { label: "Method", value: "One-time secure sign-in link" },
      { label: "Security", value: "Only use links you requested from Atlas." },
    ],
    footer: "If you did not request this email, you can safely ignore it.",
  });

  return {
    subject: "Your Atlas magic link",
    text: rendered.text,
    html: rendered.html,
  };
}

function buildResetEmail(link: string) {
  const rendered = renderAuthEmailTemplate({
    preheader: "Reset your Atlas password",
    heading: "Reset your password",
    intro:
      "We received a request to reset your Atlas password. Use the button below to continue.",
    buttonLabel: "Reset password",
    buttonUrl: link,
    details: [
      { label: "Request", value: "Password reset" },
      { label: "Recommended", value: "Use a strong password you do not reuse elsewhere." },
    ],
    footer: "If you did not request a password reset, no action is needed.",
  });

  return {
    subject: "Reset your Atlas password",
    text: rendered.text,
    html: rendered.html,
  };
}

function profileConflictMessage(errorMessage: string): string {
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes("already been registered")
    || normalized.includes("already registered")
    || normalized.includes("user already exists")
  ) {
    return "An account with this email already exists. Use Login instead.";
  }

  if (
    normalized.includes("handle is already taken")
    || normalized.includes("profiles_handle_key")
  ) {
    return "That handle is already taken.";
  }

  return "Unable to create account right now.";
}

async function sendSignupEmail(
  payload: Extract<AuthEmailRequest, { action: "sign-up" }>,
  site: string,
): Promise<NextResponse> {
  const nextPath = normalizeNextPath(payload.nextPath);
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        handle: payload.handle,
      },
      redirectTo,
    },
  });

  if (error || !data.properties) {
    const message = profileConflictMessage(error?.message ?? "Unknown signup error");
    const status = message.includes("already") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  const verificationLink = buildCallbackLink(
    site,
    data.properties.hashed_token,
    data.properties.verification_type,
    nextPath,
  );
  const email = buildSignupEmail(verificationLink, payload.handle);

  await sendSmtpEmail({
    to: payload.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  return NextResponse.json({
    message: "Account created. Verify your email, then sign in.",
  });
}

async function sendMagicLinkEmail(
  payload: Extract<AuthEmailRequest, { action: "magic" }>,
  site: string,
): Promise<NextResponse> {
  const nextPath = normalizeNextPath(payload.nextPath);
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: payload.email,
    options: {
      redirectTo,
    },
  });

  if (!error && data.properties) {
    const verificationLink = buildCallbackLink(
      site,
      data.properties.hashed_token,
      data.properties.verification_type,
      nextPath,
    );
    const email = buildMagicEmail(verificationLink);

    await sendSmtpEmail({
      to: payload.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } else {
    console.error("Custom magic link generation failed", {
      email: payload.email,
      message: error?.message ?? "No properties returned.",
    });
  }

  return NextResponse.json({
    message: "Magic link sent. Open your email to continue.",
  });
}

async function sendRecoveryEmail(
  payload: Extract<AuthEmailRequest, { action: "reset" }>,
  site: string,
): Promise<NextResponse> {
  const nextPath = "/auth/update-password";
  const redirectTo = `${site}/auth/callback?next=${encodeURIComponent(nextPath)}`;
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: payload.email,
    options: {
      redirectTo,
    },
  });

  if (!error && data.properties) {
    const verificationLink = buildCallbackLink(
      site,
      data.properties.hashed_token,
      data.properties.verification_type,
      nextPath,
    );
    const email = buildResetEmail(verificationLink);

    await sendSmtpEmail({
      to: payload.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } else {
    console.error("Custom recovery link generation failed", {
      email: payload.email,
      message: error?.message ?? "No properties returned.",
    });
  }

  return NextResponse.json({
    message: "Password reset link sent. Check your inbox.",
  });
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

  const parsed = authEmailRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid auth payload." }, { status: 400 });
  }

  const ip = getRequestIp(request);
  const rateKey = `${ip}:${parsed.data.email}:${parsed.data.action}`;

  if (!consumeRateToken(rateKey)) {
    return NextResponse.json(
      { error: "Too many auth email requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  try {
    const site = resolveEmailSiteUrl(request);

    if (parsed.data.action === "sign-up") {
      return await sendSignupEmail(parsed.data, site);
    }

    if (parsed.data.action === "magic") {
      return await sendMagicLinkEmail(parsed.data, site);
    }

    return await sendRecoveryEmail(parsed.data, site);
  } catch (error) {
    console.error("Custom auth email route failed", error);
    return NextResponse.json(
      { error: "Email delivery is unavailable right now. Please try again shortly." },
      { status: 503 },
    );
  }
}
