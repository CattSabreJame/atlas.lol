"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CURSOR_BUCKET, getCursorStoragePathFromPublicUrl, resolveCursorPublicUrl } from "@/lib/cursor";
import { normalizeHandle } from "@/lib/handles";
import { getPremiumCursorGateMessage, hasPremiumBadge } from "@/lib/premium";
import { createClient } from "@/lib/supabase/client";
import { cursorModeSchema, cursorTrailModeSchema, handleSchema } from "@/lib/validations";
import { BadgeType, CursorMode, CursorTrailMode, UserCursorRow } from "@/types/db";

interface SettingsPanelProps {
  userId: string;
  email: string;
  initialHandle: string;
  initialPublic: boolean;
  initialBadges: BadgeType[] | null;
  handleChangedAt: string;
  initialCursorEnabled: boolean;
  initialCursorTrailsEnabled: boolean;
  initialCursorMode: CursorMode;
  initialCursorTrailMode: CursorTrailMode;
  initialActiveCursorId: string | null;
  initialUserCursors: UserCursorRow[];
  premiumTicketUrl: string;
}

const HANDLE_CHANGE_WINDOW_DAYS = 14;
const CURSOR_FILE_MAX_BYTES = 200 * 1024;
const CURSOR_MAX_DIMENSION = 128;
const CURSOR_ACCEPT = "image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.png,.svg,.ico";
const SUPPORTED_CURSOR_MIME_TYPES = new Set([
  "image/png",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);
const CURSOR_MODE_LABEL: Record<CursorMode, string> = {
  glow: "Glow Dot Cursor",
  crosshair: "Crosshair Dev Cursor",
  morph: "Morph Cursor",
  split: "Split Cursor",
  hollow_square: "Hollow Square Cursor",
  target_lock: "Target Lock Cursor",
  invert: "Invert Cursor",
  elastic: "Elastic Cursor",
  outline_morph: "Outline Morph Cursor",
  shadow_echo: "Cursor With Shadow Echo",
};
const CURSOR_TRAIL_LABEL: Record<CursorTrailMode, string> = {
  velocity: "Velocity Glow Trail",
  dots: "Micro Dot Trail",
  pixel: "Pixel Fragment Trail",
  motion_blur: "Motion Blur Trail",
  neon_thread: "Neon Thread Trail",
  smoke: "Smoke Trail",
  gravity: "Gravity Particles",
  ripple_wake: "Ripple Wake",
  data_stream: "Data Stream Trail",
  dual_layer: "Dual Layer Trail",
  pulse_droplets: "Pulse Droplets",
};

function daysUntilNextHandleChange(handleChangedAt: string): number {
  const changedAt = new Date(handleChangedAt).getTime();
  const unlockAt = changedAt + HANDLE_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return Math.max(Math.ceil((unlockAt - Date.now()) / (24 * 60 * 60 * 1000)), 0);
}

function clampHotspot(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(CURSOR_MAX_DIMENSION - 1, Math.max(0, Math.round(value)));
}

function resolveCursorExtension(file: File): "png" | "svg" | "ico" {
  const fromName = (file.name.split(".").pop() ?? "").trim().toLowerCase();

  if (fromName === "svg") {
    return "svg";
  }

  if (fromName === "ico") {
    return "ico";
  }

  if (file.type === "image/svg+xml") {
    return "svg";
  }

  if (file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon") {
    return "ico";
  }

  return "png";
}

function resolveCursorMimeType(extension: "png" | "svg" | "ico"): string {
  if (extension === "svg") {
    return "image/svg+xml";
  }

  if (extension === "ico") {
    return "image/x-icon";
  }

  return "image/png";
}

function isSafeSvg(rawSvg: string): boolean {
  const unsafePatterns = [
    /<script[\s>]/i,
    /<\/script>/i,
    /on[a-z]+\s*=/i,
    /javascript:/i,
    /<foreignObject[\s>]/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
  ];

  return !unsafePatterns.some((pattern) => pattern.test(rawSvg));
}

async function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      return { width, height };
    } catch {
      // Fall back to <img> parsing for formats with limited createImageBitmap support (for example some .ico files).
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Unable to inspect cursor dimensions."));
      image.src = objectUrl;
    });

    return dimensions;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeCursorName(rawName: string): string {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return "Cursor";
  }

  return trimmed.slice(0, 60);
}

export function SettingsPanel({
  userId,
  email,
  initialHandle,
  initialPublic,
  initialBadges,
  handleChangedAt,
  initialCursorEnabled,
  initialCursorTrailsEnabled,
  initialCursorMode,
  initialCursorTrailMode,
  initialActiveCursorId,
  initialUserCursors,
  premiumTicketUrl,
}: SettingsPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const hasPremium = hasPremiumBadge(initialBadges);

  const [handle, setHandle] = useState(initialHandle);
  const [isPublic, setIsPublic] = useState(initialPublic);

  const [cursorEnabled, setCursorEnabled] = useState(initialCursorEnabled);
  const [cursorTrailsEnabled, setCursorTrailsEnabled] = useState(initialCursorTrailsEnabled);
  const [cursorMode, setCursorMode] = useState<CursorMode>(initialCursorMode);
  const [cursorTrailMode, setCursorTrailMode] = useState<CursorTrailMode>(initialCursorTrailMode);
  const [activeCursorId, setActiveCursorId] = useState(initialActiveCursorId ?? "");

  const [userCursors, setUserCursors] = useState<UserCursorRow[]>(initialUserCursors);
  const [selectedCursorId, setSelectedCursorId] = useState(
    initialActiveCursorId ?? initialUserCursors[0]?.id ?? "",
  );
  const [cursorName, setCursorName] = useState("");
  const [hotspotX, setHotspotX] = useState(0);
  const [hotspotY, setHotspotY] = useState(0);

  const [loading, setLoading] = useState(false);
  const [uploadingCursor, setUploadingCursor] = useState(false);
  const [savingCursorMeta, setSavingCursorMeta] = useState(false);
  const [defaultingCursor, setDefaultingCursor] = useState(false);
  const [removingCursor, setRemovingCursor] = useState(false);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [cursorMessage, setCursorMessage] = useState("");
  const [cursorErrorMessage, setCursorErrorMessage] = useState("");

  const daysRemaining = daysUntilNextHandleChange(handleChangedAt);
  const selectedCursor = useMemo(
    () => userCursors.find((cursor) => cursor.id === selectedCursorId) ?? null,
    [selectedCursorId, userCursors],
  );

  useEffect(() => {
    if (!selectedCursor) {
      setCursorName("");
      setHotspotX(0);
      setHotspotY(0);
      return;
    }

    setCursorName(selectedCursor.name);
    setHotspotX(selectedCursor.hotspot_x);
    setHotspotY(selectedCursor.hotspot_y);
  }, [selectedCursor]);

  const cursorPreviewUrlById = useMemo(() => {
    const previewMap = new Map<string, string>();

    for (const cursor of userCursors) {
      const previewUrl = resolveCursorPublicUrl(supabase, cursor.file_url);

      if (previewUrl) {
        previewMap.set(cursor.id, previewUrl);
      }
    }

    return previewMap;
  }, [supabase, userCursors]);

  const selectedCursorFileUrl =
    selectedCursor && cursorPreviewUrlById.has(selectedCursor.id)
      ? (cursorPreviewUrlById.get(selectedCursor.id) ?? null)
      : null;

  async function saveSettings() {
    setLoading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const normalized = normalizeHandle(handle);
      const parsedHandle = handleSchema.safeParse(normalized);
      const parsedCursorMode = cursorModeSchema.safeParse(cursorMode);
      const parsedTrailMode = cursorTrailModeSchema.safeParse(cursorTrailMode);

      if (!parsedHandle.success) {
        setErrorMessage(parsedHandle.error.issues[0]?.message ?? "Invalid handle.");
        return;
      }

      if (!parsedCursorMode.success) {
        setErrorMessage("Invalid cursor mode.");
        return;
      }

      if (!parsedTrailMode.success) {
        setErrorMessage("Invalid trail mode.");
        return;
      }

      const handleChanged = normalized !== initialHandle;
      const premiumCursorGateMessage = getPremiumCursorGateMessage({
        hasPremium,
        cursorEnabled,
        cursorTrailsEnabled,
        activeCursorId: activeCursorId || null,
      });

      if (premiumCursorGateMessage) {
        setErrorMessage(
          `${premiumCursorGateMessage} requires the Pro badge. Open a Discord ticket to upgrade.`,
        );
        return;
      }

      const effectiveCursorEnabled = hasPremium ? cursorEnabled : false;
      const effectiveTrailsEnabled =
        hasPremium && effectiveCursorEnabled ? cursorTrailsEnabled : false;

      if (handleChanged && daysRemaining > 0) {
        setErrorMessage(
          `Handle can be changed every ${HANDLE_CHANGE_WINDOW_DAYS} days. Try again in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
        );
        return;
      }

      const updates: Record<string, string | boolean | null> = {
        handle: normalized,
        is_public: isPublic,
        cursor_enabled: effectiveCursorEnabled,
        cursor_trails_enabled: effectiveTrailsEnabled,
        cursor_mode: parsedCursorMode.data,
        cursor_trail_mode: parsedTrailMode.data,
        cursor_apply_in_app: false,
        active_cursor_id: hasPremium ? activeCursorId || null : null,
      };

      if (handleChanged) {
        updates.handle_changed_at = new Date().toISOString();
      }

      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);

      if (error) {
        if (error.message.toLowerCase().includes("duplicate")) {
          throw new Error("That handle is already taken.");
        }

        if (error.message.toLowerCase().includes("active_cursor_id")) {
          throw new Error("Default cursor is invalid or unavailable.");
        }

        throw error;
      }

      setMessage("Settings saved.");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSelectedCursorMeta() {
    if (!hasPremium) {
      setCursorErrorMessage("Cursor Studio requires the Pro badge.");
      return;
    }

    if (!selectedCursor) {
      setCursorErrorMessage("Select a cursor first.");
      return;
    }

    setSavingCursorMeta(true);
    setCursorMessage("");
    setCursorErrorMessage("");

    try {
      const nextName = normalizeCursorName(cursorName);
      const nextX = clampHotspot(hotspotX);
      const nextY = clampHotspot(hotspotY);

      const { data, error } = await supabase
        .from("user_cursors")
        .update({
          name: nextName,
          hotspot_x: nextX,
          hotspot_y: nextY,
        })
        .eq("id", selectedCursor.id)
        .eq("user_id", userId)
        .select("*")
        .single<UserCursorRow>();

      if (error || !data) {
        throw error ?? new Error("Could not update cursor metadata.");
      }

      setUserCursors((prev) => prev.map((cursor) => (cursor.id === data.id ? data : cursor)));
      setCursorMessage("Cursor hotspot updated.");
    } catch (error) {
      setCursorErrorMessage(error instanceof Error ? error.message : "Could not update cursor hotspot.");
    } finally {
      setSavingCursorMeta(false);
    }
  }

  async function setAsDefaultCursor() {
    if (!hasPremium) {
      setCursorErrorMessage("Cursor Studio requires the Pro badge.");
      return;
    }

    if (!selectedCursor) {
      setCursorErrorMessage("Select a cursor first.");
      return;
    }

    setDefaultingCursor(true);
    setCursorMessage("");
    setCursorErrorMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ active_cursor_id: selectedCursor.id })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      setActiveCursorId(selectedCursor.id);
      setCursorMessage("Default cursor updated.");
      router.refresh();
    } catch (error) {
      setCursorErrorMessage(error instanceof Error ? error.message : "Could not set default cursor.");
    } finally {
      setDefaultingCursor(false);
    }
  }

  async function clearDefaultCursor() {
    setDefaultingCursor(true);
    setCursorMessage("");
    setCursorErrorMessage("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ active_cursor_id: null })
        .eq("id", userId);

      if (error) {
        throw error;
      }

      setActiveCursorId("");
      setCursorMessage("Default cursor cleared. Preset cursor mode will be used.");
      router.refresh();
    } catch (error) {
      setCursorErrorMessage(error instanceof Error ? error.message : "Could not clear default cursor.");
    } finally {
      setDefaultingCursor(false);
    }
  }

  async function removeSelectedCursor() {
    if (!selectedCursor) {
      setCursorErrorMessage("Select a cursor first.");
      return;
    }

    const confirmed = window.confirm(`Delete "${selectedCursor.name}"?`);
    if (!confirmed) {
      return;
    }

    setRemovingCursor(true);
    setCursorMessage("");
    setCursorErrorMessage("");

    try {
      const storagePath = getCursorStoragePathFromPublicUrl(selectedCursor.file_url);

      if (storagePath) {
        await supabase.storage.from(CURSOR_BUCKET).remove([storagePath]);
      }

      const { error } = await supabase
        .from("user_cursors")
        .delete()
        .eq("id", selectedCursor.id)
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      const nextCursors = userCursors.filter((cursor) => cursor.id !== selectedCursor.id);
      setUserCursors(nextCursors);
      setSelectedCursorId(nextCursors[0]?.id ?? "");

      if (activeCursorId === selectedCursor.id) {
        setActiveCursorId("");
      }

      setCursorMessage("Cursor deleted.");
      router.refresh();
    } catch (error) {
      setCursorErrorMessage(error instanceof Error ? error.message : "Could not delete cursor.");
    } finally {
      setRemovingCursor(false);
    }
  }

  async function handleCursorUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!hasPremium) {
      setCursorErrorMessage("Cursor Studio uploads require the Pro badge.");
      return;
    }

    setUploadingCursor(true);
    setCursorMessage("");
    setCursorErrorMessage("");

    try {
      const inferredMimeType = file.type || resolveCursorMimeType(resolveCursorExtension(file));

      if (!SUPPORTED_CURSOR_MIME_TYPES.has(inferredMimeType)) {
        throw new Error("Unsupported cursor type. Use PNG, SVG, or ICO.");
      }

      if (file.size > CURSOR_FILE_MAX_BYTES) {
        throw new Error("Cursor file is too large. Max size is 200KB.");
      }

      const extension = resolveCursorExtension(file);
      let uploadFile = file;
      let uploadMimeType = inferredMimeType;

      if (extension === "svg") {
        const rawSvg = await file.text();

        if (!isSafeSvg(rawSvg)) {
          throw new Error("SVG contains unsupported content. Remove scripts/events and try again.");
        }

        uploadFile = new File([rawSvg], file.name, {
          type: "image/svg+xml",
        });
        uploadMimeType = "image/svg+xml";
      }

      const dimensions = await readImageDimensions(uploadFile);
      if (dimensions.width > CURSOR_MAX_DIMENSION || dimensions.height > CURSOR_MAX_DIMENSION) {
        throw new Error("Cursor dimensions must be 128x128px or smaller.");
      }

      const cursorId = crypto.randomUUID();
      const storagePath = `${userId}/${cursorId}.${extension}`;
      const nameFromFile = normalizeCursorName(file.name.replace(/\.[^.]+$/, ""));

      const { error: uploadError } = await supabase.storage
        .from(CURSOR_BUCKET)
        .upload(storagePath, uploadFile, {
          upsert: false,
          contentType: uploadMimeType,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from(CURSOR_BUCKET).getPublicUrl(storagePath);
      const fileUrl = publicData.publicUrl;

      const { data: createdCursor, error: insertError } = await supabase
        .from("user_cursors")
        .insert({
          id: cursorId,
          user_id: userId,
          name: nameFromFile,
          file_url: fileUrl,
          hotspot_x: 0,
          hotspot_y: 0,
        })
        .select("*")
        .single<UserCursorRow>();

      if (insertError || !createdCursor) {
        await supabase.storage.from(CURSOR_BUCKET).remove([storagePath]);
        throw insertError ?? new Error("Could not save cursor metadata.");
      }

      setUserCursors((prev) => [createdCursor, ...prev]);
      setSelectedCursorId(createdCursor.id);
      setCursorMessage("Cursor uploaded.");
    } catch (error) {
      setCursorErrorMessage(error instanceof Error ? error.message : "Could not upload cursor.");
    } finally {
      setUploadingCursor(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/auth?mode=sign-in");
    router.refresh();
  }

  return (
    <div className="space-y-5 pb-10">
      <section className="panel p-7">
        <p className="section-kicker">Settings</p>
        <h1 className="mt-3 text-[2.3rem] font-semibold tracking-tight text-white sm:text-[2.5rem]">Account controls</h1>
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-[#b6ada0]">
          Manage identity, visibility, and Cursor Studio from one place.
        </p>
      </section>

      <section className="panel space-y-5 p-7">
        <div>
          <h2 className="text-xl font-semibold text-white">Profile identity</h2>
          <p className="mt-1 text-sm text-[#a89f91]">Email is fixed here, handle and visibility can be changed.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Email</span>
            <input className="input opacity-85" value={email} disabled readOnly />
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Handle</span>
            <input
              className="input"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="your_handle"
            />
            <span className="text-xs text-[#8f8678]">
              One change every {HANDLE_CHANGE_WINDOW_DAYS} days.
              {daysRemaining > 0
                ? ` Available in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`
                : " Ready to change."}
            </span>
          </label>
        </div>

        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-[#e1dbd2]">
          <span>Public profile visibility</span>
          <input
            checked={isPublic}
            className="h-4 w-4 accent-[var(--accent)]"
            onChange={(event) => setIsPublic(event.target.checked)}
            type="checkbox"
          />
        </label>

        {errorMessage ? (
          <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{errorMessage}</p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{message}</p>
        ) : null}
      </section>

      <section className="panel space-y-5 p-7">
        <div>
          <h2 className="text-xl font-semibold text-white">Cursor Studio</h2>
          <p className="mt-1 text-sm text-[#a89f91]">
            Build a profile cursor style with optional trails, upload your own assets, and set a default cursor for the public profile.
          </p>
        </div>

        {!hasPremium ? (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-500/[0.08] px-4 py-3 text-sm text-amber-50">
            <p className="font-medium">Cursor Studio is Pro-only.</p>
            <p className="mt-1 text-xs text-amber-100/90">
              Upgrade with the Pro badge to enable custom cursors, trails, and cursor uploads.
            </p>
            <a
              href={premiumTicketUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary mt-3 inline-flex text-xs"
            >
              Open Discord ticket
            </a>
          </div>
        ) : null}

        <div className="grid gap-3">
          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-[#e1dbd2]">
            <span>Enable custom cursor</span>
            <input
              checked={cursorEnabled}
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={(event) => setCursorEnabled(event.target.checked)}
              type="checkbox"
              disabled={!hasPremium}
            />
          </label>

          <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/22 px-4 py-3 text-sm text-[#e1dbd2]">
            <span>Enable trails</span>
            <input
              checked={cursorTrailsEnabled}
              className="h-4 w-4 accent-[var(--accent)]"
              onChange={(event) => setCursorTrailsEnabled(event.target.checked)}
              type="checkbox"
              disabled={!hasPremium || !cursorEnabled}
            />
          </label>

          <p className="text-xs text-[#8f8678]">
            Trails automatically disable for users who prefer reduced motion. Cursor effects are applied on public profiles only.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Cursor style</span>
            <select
              className="input py-3"
              value={cursorMode}
              onChange={(event) => setCursorMode(event.target.value as CursorMode)}
              disabled={!hasPremium || !cursorEnabled}
            >
              <option value="glow">Glow Dot Cursor</option>
              <option value="crosshair">Crosshair Dev Cursor</option>
              <option value="morph">Morph Cursor</option>
              <option value="split">Split Cursor</option>
              <option value="hollow_square">Hollow Square Cursor</option>
              <option value="target_lock">Target Lock Cursor</option>
              <option value="invert">Invert Cursor</option>
              <option value="elastic">Elastic Cursor</option>
              <option value="outline_morph">Outline Morph Cursor</option>
              <option value="shadow_echo">Cursor With Shadow Echo</option>
            </select>
          </label>

          <label className="space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Trail style</span>
            <select
              className="input py-3"
              value={cursorTrailMode}
              onChange={(event) => setCursorTrailMode(event.target.value as CursorTrailMode)}
              disabled={!hasPremium || !cursorEnabled || !cursorTrailsEnabled}
            >
              <option value="velocity">Velocity Glow Trail</option>
              <option value="dots">Micro Dot Trail</option>
              <option value="pixel">Pixel Fragment Trail</option>
              <option value="motion_blur">Motion Blur Trail</option>
              <option value="neon_thread">Neon Thread Trail</option>
              <option value="smoke">Smoke Trail</option>
              <option value="gravity">Gravity Particles</option>
              <option value="ripple_wake">Ripple Wake</option>
              <option value="data_stream">Data Stream Trail</option>
              <option value="dual_layer">Dual Layer Trail</option>
              <option value="pulse_droplets">Pulse Droplets</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0b0c10] p-4">
          <p className="text-xs text-[#9d9488] uppercase tracking-[0.12em]">Cursor preview</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1.45fr_1fr]">
            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 rounded-full border border-white/10 bg-black/45">
                  {cursorMode === "glow" ? (
                    <>
                      <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c3dcf6]/60" />
                      <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0d9f4]" />
                    </>
                  ) : null}
                  {cursorMode === "crosshair" ? (
                    <>
                      <span className="absolute left-1/2 top-1/2 h-[1px] w-6 -translate-x-1/2 -translate-y-1/2 bg-[#bed8f3]/80" />
                      <span className="absolute left-1/2 top-1/2 h-6 w-[1px] -translate-x-1/2 -translate-y-1/2 bg-[#bed8f3]/80" />
                      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bed8f3]/80 bg-[#98c0e8]/35" />
                    </>
                  ) : null}
                  {cursorMode === "morph" ? (
                    <>
                      <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/64" />
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
                    </>
                  ) : null}
                  {cursorMode === "split" ? (
                    <>
                      <span className="absolute left-[28%] top-1/2 h-[1px] w-2.5 -translate-y-1/2 bg-[#c2dbf6]/80" />
                      <span className="absolute right-[28%] top-1/2 h-[1px] w-2.5 -translate-y-1/2 bg-[#c2dbf6]/80" />
                      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
                    </>
                  ) : null}
                  {cursorMode === "hollow_square" ? (
                    <>
                      <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#c0daf5]/80" />
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
                    </>
                  ) : null}
                  {cursorMode === "target_lock" ? (
                    <>
                      <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/70" />
                      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
                    </>
                  ) : null}
                  {cursorMode === "invert" ? (
                    <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white mix-blend-difference" />
                  ) : null}
                  {cursorMode === "elastic" ? (
                    <span className="absolute left-1/2 top-1/2 h-2.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]/90" />
                  ) : null}
                  {cursorMode === "outline_morph" ? (
                    <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/74 bg-[#c0daf5]/10" />
                  ) : null}
                  {cursorMode === "shadow_echo" ? (
                    <>
                      <span className="absolute left-[60%] top-[58%] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]/30 blur-[1px]" />
                      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
                    </>
                  ) : null}
                </div>
                <div>
                  <p className="text-sm text-white">{CURSOR_MODE_LABEL[cursorMode]}</p>
                  <p className="text-xs text-[#9a9183]">
                    {cursorTrailsEnabled ? CURSOR_TRAIL_LABEL[cursorTrailMode] : "Trails disabled"}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/35 p-4">
                <p className="text-xs text-[#9a9183]">
                  Cursor mode preview updates live as you change style and trail options.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-[#9d9488]">Asset preview</p>
              {selectedCursorFileUrl ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/45 p-3">
                  <div className="relative mx-auto h-[92px] w-[92px] rounded-lg border border-white/10 bg-black/35 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedCursorFileUrl}
                      alt={`${selectedCursor?.name ?? "Selected"} cursor preview`}
                      className="h-full w-full object-contain"
                    />
                    <span
                      className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300 bg-emerald-300/80 shadow-[0_0_8px_rgba(110,231,183,0.8)]"
                      style={{
                        left: `${((clampHotspot(hotspotX) + 1) / CURSOR_MAX_DIMENSION) * 100}%`,
                        top: `${((clampHotspot(hotspotY) + 1) / CURSOR_MAX_DIMENSION) * 100}%`,
                      }}
                      title={`Hotspot ${clampHotspot(hotspotX)}, ${clampHotspot(hotspotY)}`}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] text-[#a9a091]">
                    Hotspot {clampHotspot(hotspotX)},{clampHotspot(hotspotY)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-[#9a9183]">
                  Select an uploaded cursor to preview the asset.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/22 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-white">Uploaded cursors</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="cursor-upload-input"
                type="file"
                accept={CURSOR_ACCEPT}
                className="hidden"
                onChange={handleCursorUpload}
                disabled={!hasPremium || uploadingCursor}
              />
              <label
                htmlFor="cursor-upload-input"
                className={`btn btn-secondary cursor-pointer ${!hasPremium ? "pointer-events-none opacity-60" : ""}`}
              >
                {uploadingCursor ? "Uploading..." : "Upload cursor"}
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#8f8678]">
            PNG/SVG/ICO only, max 200KB, max {CURSOR_MAX_DIMENSION}x{CURSOR_MAX_DIMENSION}px.
          </p>

          {userCursors.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {userCursors.map((cursor) => (
                <button
                  key={cursor.id}
                  type="button"
                  onClick={() => setSelectedCursorId(cursor.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    cursor.id === selectedCursorId
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-white/10 bg-black/20 text-[#cec6b8] hover:border-white/18 hover:bg-white/6"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/35">
                      {cursorPreviewUrlById.get(cursor.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cursorPreviewUrlById.get(cursor.id)}
                          alt={`${cursor.name} thumbnail`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-[#998f81]">N/A</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{cursor.name}</p>
                      <p className="mt-1 text-[11px] text-[#a9a091]">
                        Hotspot {cursor.hotspot_x},{cursor.hotspot_y}
                        {activeCursorId === cursor.id ? " - Default" : ""}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-[#9a9183]">
              No cursor assets uploaded yet.
            </p>
          )}

          {selectedCursor ? (
            <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1.5 text-sm sm:col-span-3">
                  <span className="text-[#d0c8bc]">Cursor name</span>
                  <input
                    className="input py-2.5"
                    value={cursorName}
                    onChange={(event) => setCursorName(event.target.value)}
                    maxLength={60}
                  />
                </label>

                <label className="space-y-1.5 text-sm">
                  <span className="text-[#d0c8bc]">Hotspot X</span>
                  <input
                    className="input py-2.5"
                    type="number"
                    min={0}
                    max={127}
                    value={hotspotX}
                    onChange={(event) => setHotspotX(Number(event.target.value))}
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="text-[#d0c8bc]">Hotspot Y</span>
                  <input
                    className="input py-2.5"
                    type="number"
                    min={0}
                    max={127}
                    value={hotspotY}
                    onChange={(event) => setHotspotY(Number(event.target.value))}
                  />
                </label>
                <div className="space-y-1.5 text-sm">
                  <span className="text-[#d0c8bc]">Default status</span>
                  <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-[#c9c2b5]">
                    {activeCursorId === selectedCursor.id ? "Active default cursor" : "Not default"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={saveSelectedCursorMeta}
                  disabled={!hasPremium || savingCursorMeta}
                >
                  {savingCursorMeta ? "Saving..." : "Save hotspot"}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={setAsDefaultCursor}
                  disabled={!hasPremium || defaultingCursor}
                >
                  {defaultingCursor ? "Updating..." : "Set as default"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearDefaultCursor}
                  disabled={!hasPremium || defaultingCursor}
                >
                  Use preset only
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={removeSelectedCursor}
                  disabled={removingCursor}
                >
                  {removingCursor ? "Deleting..." : "Delete cursor"}
                </button>
              </div>
            </div>
          ) : null}

          {cursorErrorMessage ? (
            <p className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{cursorErrorMessage}</p>
          ) : null}
          {cursorMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{cursorMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="panel p-7">
        <h3 className="text-sm font-medium text-[#d2cabd]">Session</h3>
        <p className="mt-1 text-xs text-[#968d80]">Save your settings, or log out from this device.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={loading} onClick={saveSettings} type="button">
            {loading ? "Saving..." : "Save settings"}
          </button>
          <button className="btn btn-secondary" onClick={signOut} type="button">
            Log out
          </button>
        </div>
      </section>
    </div>
  );
}
