import { NextResponse } from "next/server";

function parseOrigin(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isSameOriginRequest(request: Request): boolean {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = parseOrigin(request.headers.get("origin"));
  const refererHeader = parseOrigin(request.headers.get("referer"));

  if (!originHeader && !refererHeader) {
    return true;
  }

  if (originHeader && originHeader !== requestOrigin) {
    return false;
  }

  if (refererHeader && refererHeader !== requestOrigin) {
    return false;
  }

  return true;
}

export function rejectCrossOrigin(request: Request): NextResponse | null {
  if (isSameOriginRequest(request)) {
    return null;
  }

  return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || "unknown";
}
