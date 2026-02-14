import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

const PROTECTED_PATHS = ["/dashboard", "/editor", "/settings", "/admin"];

export async function proxy(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();

  const path = request.nextUrl.pathname;

  if (path.startsWith("/@") && path.length > 2) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/${path.slice(2)}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (PROTECTED_PATHS.some((segment) => path.startsWith(segment)) && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (path === "/auth" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
