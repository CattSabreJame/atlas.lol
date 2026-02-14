import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { musicSearchQuerySchema } from "@/lib/validations";

interface ItunesTrack {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  trackViewUrl?: string;
  artworkUrl100?: string;
}

interface MusicSearchResult {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  trackViewUrl: string | null;
  artworkUrl: string | null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = musicSearchQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    limit: url.searchParams.get("limit") ?? "8",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search query." }, { status: 400 });
  }

  const endpoint = `https://itunes.apple.com/search?entity=song&country=US&term=${encodeURIComponent(
    parsed.data.q,
  )}&limit=${parsed.data.limit}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Music search is unavailable." }, { status: 502 });
    }

    const payload = (await response.json()) as { results?: ItunesTrack[] };
    const rawResults = Array.isArray(payload.results) ? payload.results : [];

    const dedupe = new Set<string>();
    const results: MusicSearchResult[] = [];

    for (const item of rawResults) {
      if (!item.previewUrl || !item.trackName || !item.artistName || !item.trackId) {
        continue;
      }

      const id = String(item.trackId);

      if (dedupe.has(id)) {
        continue;
      }

      dedupe.add(id);
      results.push({
        id,
        title: item.trackName,
        artist: item.artistName,
        previewUrl: item.previewUrl,
        trackViewUrl: item.trackViewUrl ?? null,
        artworkUrl: item.artworkUrl100 ?? null,
      });
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Music search request failed." }, { status: 500 });
  }
}
