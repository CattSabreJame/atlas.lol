import { EditorClient } from "@/components/editor/editor-client";
import { PageTransition } from "@/components/ui/page-transition";
import { getOrCreateProfile } from "@/lib/data";
import { getDiscordPremiumTicketUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { AdminActionNoticeRow, CommentRow, LinkRow, MusicTrackRow, WidgetRow } from "@/types/db";

export default async function EditorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await getOrCreateProfile(user);

  const [linksResult, tracksResult, widgetsResult, commentsResult, noticesResult] = await Promise.all([
    supabase.from("links").select("*").eq("user_id", user.id).order("sort_order", { ascending: true }),
    supabase
      .from("music_tracks")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("widgets")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("comments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("admin_action_notices")
      .select("*")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const links = (linksResult.data ?? []) as LinkRow[];
  const tracks = (tracksResult.data ?? []) as MusicTrackRow[];
  const widgets = (widgetsResult.data ?? []) as WidgetRow[];
  const comments = (commentsResult.data ?? []) as CommentRow[];
  const adminNotices = (noticesResult.data ?? []) as AdminActionNoticeRow[];

  return (
    <PageTransition className="w-full">
      <EditorClient
        userId={user.id}
        profile={profile}
        initialLinks={links}
        initialTracks={tracks}
        initialWidgets={widgets}
        recentComments={comments}
        adminNotices={adminNotices}
        premiumTicketUrl={getDiscordPremiumTicketUrl()}
      />
    </PageTransition>
  );
}
