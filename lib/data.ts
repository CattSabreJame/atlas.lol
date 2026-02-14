import { User } from "@supabase/supabase-js";

import { createDefaultHandle } from "@/lib/handles";
import { createClient } from "@/lib/supabase/server";
import { ProfileRow } from "@/types/db";

export async function requireUser(): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function getOrCreateProfile(user: User): Promise<ProfileRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (existing) {
    return existing;
  }

  const fallbackName =
    user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "Creator";

  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      handle: createDefaultHandle(user.id),
      display_name: fallbackName,
    })
    .select("*")
    .single<ProfileRow>();

  if (error || !created) {
    throw new Error("Unable to create profile.");
  }

  return created;
}
