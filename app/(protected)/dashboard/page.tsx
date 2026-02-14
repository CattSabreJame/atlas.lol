import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PageTransition } from "@/components/ui/page-transition";
import { getOrCreateProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDailyRow, LinkRow } from "@/types/db";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await getOrCreateProfile(user);

  const [analyticsResult, linksResult] = await Promise.all([
    supabase
      .from("analytics_daily")
      .select("*")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(30),
    supabase.from("links").select("*").eq("user_id", user.id),
  ]);

  const [{ count: commentsCount }, { count: tracksCount }, { count: widgetsCount }] = await Promise.all([
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("music_tracks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("widgets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const analyticsRows = (analyticsResult.data ?? []) as AnalyticsDailyRow[];
  const links = (linksResult.data ?? []) as LinkRow[];

  return (
    <PageTransition className="w-full">
      <DashboardClient
        handle={profile.handle}
        analyticsRows={analyticsRows}
        links={links}
        commentsCount={commentsCount ?? 0}
        tracksCount={tracksCount ?? 0}
        widgetsCount={widgetsCount ?? 0}
      />
    </PageTransition>
  );
}

