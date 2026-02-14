import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Route handlers and middleware can set cookies. Server components may not.
        }
      },
    },
  });
}
