"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseEnv();

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
