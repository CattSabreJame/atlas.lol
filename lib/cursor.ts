import { SupabaseClient } from "@supabase/supabase-js";

export const CURSOR_BUCKET = "cursors";

export function getStoragePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    const parsed = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index < 0) {
      return null;
    }

    const encodedPath = parsed.pathname.slice(index + marker.length);
    return encodedPath ? decodeURIComponent(encodedPath) : null;
  } catch {
    return null;
  }
}

export function getCursorStoragePathFromPublicUrl(publicUrl: string): string | null {
  return getStoragePathFromPublicUrl(publicUrl, CURSOR_BUCKET);
}

export function resolveCursorPublicUrl(
  supabase: SupabaseClient,
  storedFileUrl: string | null | undefined,
): string | null {
  if (!storedFileUrl) {
    return null;
  }

  const storagePath = getCursorStoragePathFromPublicUrl(storedFileUrl);
  if (!storagePath) {
    return null;
  }

  const { data } = supabase.storage.from(CURSOR_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl || null;
}
