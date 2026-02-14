import { SettingsPanel } from "@/components/settings/settings-panel";
import { PageTransition } from "@/components/ui/page-transition";
import { getOrCreateProfile } from "@/lib/data";
import { getDiscordPremiumTicketUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { UserCursorRow } from "@/types/db";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  const [profile, cursorsResult] = await Promise.all([
    getOrCreateProfile(user),
    supabase
      .from("user_cursors")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const initialUserCursors = (cursorsResult.data ?? []) as UserCursorRow[];

  return (
    <PageTransition className="mx-auto w-full max-w-[980px]">
      <SettingsPanel
        userId={user.id}
        email={user.email}
        initialHandle={profile.handle}
        initialPublic={profile.is_public}
        initialBadges={profile.badges}
        handleChangedAt={profile.handle_changed_at}
        initialCursorEnabled={profile.cursor_enabled ?? false}
        initialCursorTrailsEnabled={profile.cursor_trails_enabled ?? false}
        initialCursorMode={profile.cursor_mode ?? "glow"}
        initialCursorTrailMode={profile.cursor_trail_mode ?? "velocity"}
        initialActiveCursorId={profile.active_cursor_id ?? null}
        initialUserCursors={initialUserCursors}
        premiumTicketUrl={getDiscordPremiumTicketUrl()}
      />
    </PageTransition>
  );
}
