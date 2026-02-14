import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PublicProfile } from "@/components/profile/public-profile";
import { resolveCursorPublicUrl } from "@/lib/cursor";
import { getSiteBaseUrl } from "@/lib/env";
import { HANDLE_REGEX, normalizeHandle } from "@/lib/handles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CommentRow, LinkRow, MusicTrackRow, ProfileRow, WidgetRow } from "@/types/db";

interface PublicHandlePageProps {
  params: Promise<{ handle: string }>;
}

function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

export async function generateMetadata({ params }: PublicHandlePageProps): Promise<Metadata> {
  const { handle: rawHandle } = await params;
  const normalizedHandle = normalizeHandle(rawHandle);

  if (!HANDLE_REGEX.test(normalizedHandle)) {
    return {
      title: "Profile",
      description: "View this Atlas profile.",
    };
  }

  const site = getSiteBaseUrl();
  const supabase = await createClient();
  const handleCandidates = Array.from(
    new Set([normalizedHandle, rawHandle.toLowerCase(), `@${normalizedHandle}`]),
  );

  const { data } = await supabase
    .from("profiles")
    .select("handle, display_name, bio, avatar_url, is_public")
    .in("handle", handleCandidates)
    .limit(1);

  const profile = data?.[0] as Pick<
    ProfileRow,
    "handle" | "display_name" | "bio" | "avatar_url" | "is_public"
  > | undefined;

  if (!profile || !profile.is_public) {
    return {
      title: "Profile",
      description: "View this Atlas profile.",
    };
  }

  const pageTitle = profile.display_name?.trim()
    ? `${profile.display_name} (@${profile.handle})`
    : `@${profile.handle}`;
  const pageDescription = profile.bio?.trim() || "View this Atlas profile.";
  const canonicalUrl = `${site}/@${profile.handle}`;
  const fallbackOgImageUrl = `${site}/api/og/profile?handle=${encodeURIComponent(profile.handle)}${profile.display_name ? `&name=${encodeURIComponent(profile.display_name)}` : ""}`;
  const imageUrl = isHttpUrl(profile.avatar_url) ? profile.avatar_url : fallbackOgImageUrl;

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description: pageDescription,
      url: canonicalUrl,
      siteName: "Atlas",
      type: "profile",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: [imageUrl],
    },
  };
}

export default async function PublicHandlePage({ params }: PublicHandlePageProps) {
  const { handle: rawHandle } = await params;
  const normalizedHandle = normalizeHandle(rawHandle);

  if (!HANDLE_REGEX.test(normalizedHandle)) {
    notFound();
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const handleCandidates = Array.from(
    new Set([normalizedHandle, rawHandle.toLowerCase(), `@${normalizedHandle}`]),
  );

  let reader = supabase;

  const { data: profileCandidates } = await supabase
    .from("profiles")
    .select("*")
    .in("handle", handleCandidates)
    .limit(1);

  let profile = (profileCandidates?.[0] as ProfileRow | undefined) ?? null;

  if (!profile) {
    try {
      const admin = createAdminClient();
      const { data: adminCandidates } = await admin
        .from("profiles")
        .select("*")
        .in("handle", handleCandidates)
        .limit(1);

      const adminProfile = (adminCandidates?.[0] as ProfileRow | undefined) ?? null;

      if (adminProfile && (adminProfile.is_public || adminProfile.id === user?.id)) {
        profile = adminProfile;
        reader = admin;
      }
    } catch {
      // Service role fallback is optional.
    }
  }

  if (!profile) {
    notFound();
  }

  const isOwner = user?.id === profile.id;

  if (!profile.is_public && !isOwner) {
    notFound();
  }

  const { data: linksData } = await reader
    .from("links")
    .select("*")
    .eq("user_id", profile.id)
    .order("sort_order", { ascending: true });

  const { data: tracksData } = await reader
    .from("music_tracks")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: widgetsData } = await reader
    .from("widgets")
    .select("*")
    .eq("user_id", profile.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: commentsData } = await reader
    .from("comments")
    .select("*")
    .eq("user_id", profile.id)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(30);

  let totalViews = 0;
  let activeCursorAsset:
    | { fileUrl: string; hotspotX: number; hotspotY: number }
    | null = null;

  try {
    const admin = createAdminClient();
    const { data: analyticsData } = await admin
      .from("analytics_daily")
      .select("profile_views")
      .eq("user_id", profile.id);

    totalViews = (analyticsData ?? []).reduce((sum, row) => {
      if (!row || typeof row.profile_views !== "number") {
        return sum;
      }

      return sum + row.profile_views;
    }, 0);
  } catch {
    totalViews = 0;
  }

  if (profile.cursor_enabled && profile.active_cursor_id) {
    try {
      const admin = createAdminClient();
      const { data: activeCursor } = await admin
        .from("user_cursors")
        .select("file_url, hotspot_x, hotspot_y")
        .eq("id", profile.active_cursor_id)
        .eq("user_id", profile.id)
        .maybeSingle<{ file_url: string; hotspot_x: number; hotspot_y: number }>();

      if (activeCursor) {
        const resolvedUrl = resolveCursorPublicUrl(admin, activeCursor.file_url);
        activeCursorAsset = {
          fileUrl: resolvedUrl ?? activeCursor.file_url,
          hotspotX: activeCursor.hotspot_x,
          hotspotY: activeCursor.hotspot_y,
        };
      }
    } catch {
      activeCursorAsset = null;
    }
  }

  const links = (linksData ?? []) as LinkRow[];
  const tracks = (tracksData ?? []) as MusicTrackRow[];
  const widgets = (widgetsData ?? []) as WidgetRow[];
  const comments = (commentsData ?? []) as CommentRow[];
  const shouldTrack = profile.is_public;

  return (
    <PublicProfile
      profile={profile}
      links={links}
      tracks={tracks}
      widgets={widgets}
      initialComments={comments}
      initialViewCount={totalViews}
      activeCursorAsset={activeCursorAsset}
      shouldTrack={shouldTrack}
    />
  );
}
