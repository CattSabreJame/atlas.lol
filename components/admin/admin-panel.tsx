"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BADGE_OPTIONS, BADGE_PRESETS } from "@/lib/profile-features";
import { normalizeHandle } from "@/lib/handles";
import { toPublicProfileUrl } from "@/lib/utils";
import { AdminModerationAction, BadgeType } from "@/types/db";

interface AdminProfile {
  id: string;
  handle: string;
  display_name: string | null;
  badges: BadgeType[];
  is_public: boolean;
  comments_enabled: boolean;
  avatar_url: string | null;
  profile_effect: string;
  background_mode: string;
  background_value: string | null;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
}

interface AdminUserRow {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  created_at: string | null;
}

type LoadState = "idle" | "loading" | "saving";

const MODERATION_ACTIONS: Array<{
  action: AdminModerationAction;
  label: string;
  description: string;
  danger?: boolean;
}> = [
  {
    action: "ban",
    label: "Ban user",
    description: "Block public profile and comments.",
    danger: true,
  },
  {
    action: "unban",
    label: "Unban user",
    description: "Restore account eligibility.",
  },
  {
    action: "remove_avatar",
    label: "Remove avatar",
    description: "Clear profile picture.",
  },
  {
    action: "remove_background",
    label: "Remove background",
    description: "Reset profile background to theme.",
  },
  {
    action: "reset_visuals",
    label: "Reset visuals",
    description: "Reset avatar, background, and profile effects.",
  },
  {
    action: "clear_bio",
    label: "Clear bio",
    description: "Remove bio and rich-text content.",
  },
  {
    action: "wipe_links",
    label: "Wipe links",
    description: "Delete all links from profile.",
    danger: true,
  },
  {
    action: "purge_comments",
    label: "Purge comments",
    description: "Delete all comments on profile.",
    danger: true,
  },
  {
    action: "force_private",
    label: "Force private",
    description: "Hide profile from public view.",
  },
  {
    action: "force_public",
    label: "Force public",
    description: "Set profile as public.",
  },
  {
    action: "disable_comments",
    label: "Disable comments",
    description: "Prevent new public comments.",
  },
  {
    action: "enable_comments",
    label: "Enable comments",
    description: "Allow public comments.",
  },
];

function normalizeBadgeSet(input: BadgeType[]): BadgeType[] {
  return Array.from(new Set(input)).sort((a, b) => a.localeCompare(b));
}

function profileHasChanges(
  profile: AdminProfile,
  selectedBadges: BadgeType[],
  isPublic: boolean,
  commentsEnabled: boolean,
): boolean {
  const current = normalizeBadgeSet(selectedBadges);
  const saved = normalizeBadgeSet(profile.badges ?? []);

  if (current.length !== saved.length) {
    return true;
  }

  if (current.some((item, index) => item !== saved[index])) {
    return true;
  }

  return isPublic !== profile.is_public || commentsEnabled !== profile.comments_enabled;
}

export function AdminPanel() {
  const [handleInput, setHandleInput] = useState("");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [selectedBadges, setSelectedBadges] = useState<BadgeType[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [status, setStatus] = useState<LoadState>("idle");

  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [adminHandleInput, setAdminHandleInput] = useState("");
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  const [moderationLoading, setModerationLoading] = useState(false);
  const [activeModerationAction, setActiveModerationAction] = useState<AdminModerationAction | null>(null);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const normalizedHandle = useMemo(() => normalizeHandle(handleInput), [handleInput]);
  const normalizedAdminHandle = useMemo(() => normalizeHandle(adminHandleInput), [adminHandleInput]);

  useEffect(() => {
    void refreshAdminUsers();
  }, []);

  function clearNotices() {
    setMessage("");
    setErrorMessage("");
  }

  async function refreshAdminUsers() {
    setAdminUsersLoading(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as { admins?: AdminUserRow[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load admin users.");
      }

      setAdmins(payload.admins ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load admin users.");
    } finally {
      setAdminUsersLoading(false);
    }
  }

  async function loadProfile() {
    if (!normalizedHandle) {
      setErrorMessage("Enter a valid handle.");
      setMessage("");
      return;
    }

    setStatus("loading");
    clearNotices();

    try {
      const response = await fetch(`/api/admin/profile?handle=${encodeURIComponent(normalizedHandle)}`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as { profile?: AdminProfile; error?: string };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Unable to load profile.");
      }

      setProfile(payload.profile);
      setSelectedBadges(normalizeBadgeSet(payload.profile.badges ?? []));
      setIsPublic(payload.profile.is_public);
      setCommentsEnabled(payload.profile.comments_enabled);
      setHandleInput(payload.profile.handle);
      setMessage(`Loaded @${payload.profile.handle}.`);
    } catch (error) {
      setProfile(null);
      setSelectedBadges([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load profile.");
    } finally {
      setStatus("idle");
    }
  }

  async function saveProfileControls() {
    if (!profile) {
      setErrorMessage("Load a profile before saving.");
      setMessage("");
      return;
    }

    setStatus("saving");
    clearNotices();

    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: profile.handle,
          badges: selectedBadges,
          isPublic,
          commentsEnabled,
        }),
      });
      const payload = (await response.json()) as { profile?: AdminProfile; error?: string };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Unable to update profile controls.");
      }

      setProfile(payload.profile);
      setSelectedBadges(normalizeBadgeSet(payload.profile.badges ?? []));
      setIsPublic(payload.profile.is_public);
      setCommentsEnabled(payload.profile.comments_enabled);
      setMessage(`Profile controls updated for @${payload.profile.handle}.`);
      await refreshAdminUsers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update profile controls.");
    } finally {
      setStatus("idle");
    }
  }

  async function setAdminAccess(makeAdmin: boolean) {
    if (!normalizedAdminHandle) {
      setErrorMessage("Enter a valid handle for admin access.");
      setMessage("");
      return;
    }

    setAdminActionLoading(true);
    clearNotices();

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: normalizedAdminHandle,
          makeAdmin,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update admin access.");
      }

      setMessage(
        makeAdmin
          ? `Granted admin access to @${normalizedAdminHandle}.`
          : `Removed admin access from @${normalizedAdminHandle}.`,
      );
      await refreshAdminUsers();

      if (profile?.handle === normalizedAdminHandle) {
        await loadProfile();
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update admin access.");
    } finally {
      setAdminActionLoading(false);
    }
  }

  async function runModeration(action: AdminModerationAction) {
    if (!profile) {
      setErrorMessage("Load a profile before running moderation actions.");
      setMessage("");
      return;
    }

    const trimmedReason = moderationReason.trim();

    if (trimmedReason.length < 3) {
      setErrorMessage("Provide a reason with at least 3 characters.");
      setMessage("");
      return;
    }

    setModerationLoading(true);
    setActiveModerationAction(action);
    clearNotices();

    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: profile.handle,
          action,
          reason: trimmedReason,
        }),
      });
      const payload = (await response.json()) as { profile?: AdminProfile; error?: string };

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Unable to apply moderation action.");
      }

      setProfile(payload.profile);
      setSelectedBadges(normalizeBadgeSet(payload.profile.badges ?? []));
      setIsPublic(payload.profile.is_public);
      setCommentsEnabled(payload.profile.comments_enabled);
      setMessage(`Action "${action}" applied to @${payload.profile.handle}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to apply moderation action.");
    } finally {
      setModerationLoading(false);
      setActiveModerationAction(null);
    }
  }

  function toggleBadge(badge: BadgeType) {
    setSelectedBadges((prev) =>
      prev.includes(badge)
        ? prev.filter((item) => item !== badge)
        : normalizeBadgeSet([...prev, badge]),
    );
  }

  function applyBadgeSet(badges: BadgeType[]) {
    setSelectedBadges(normalizeBadgeSet(badges));
  }

  const busy = status !== "idle" || moderationLoading;
  const selectedCount = selectedBadges.length;
  const unsavedChanges = profile
    ? profileHasChanges(profile, selectedBadges, isPublic, commentsEnabled)
    : false;

  return (
    <div className="space-y-5 pb-10">
      <div className="panel space-y-5 p-7">
        <div>
          <p className="section-kicker">Admin</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Administrator Console</h1>
          <p className="mt-1 text-sm text-[#aba294]">
            Profile moderation, badge assignment, and admin access control.
          </p>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="text-[#d0c8bc]">Target handle</span>
          <div className="flex gap-2">
            <input
              className="input"
              value={handleInput}
              onChange={(event) => setHandleInput(event.target.value)}
              placeholder="creator_handle"
            />
            <button
              className="btn btn-secondary shrink-0"
              onClick={loadProfile}
              type="button"
              disabled={busy}
            >
              {status === "loading" ? "Loading..." : "Load"}
            </button>
          </div>
          <span className="text-xs text-[#958b7d]">
            Enter without `@`. Normalized target: {normalizedHandle ? `@${normalizedHandle}` : "-"}
          </span>
        </label>

        {profile ? (
          <div className="space-y-4">
            <div className="surface-soft p-4">
              <p className="text-sm text-white">
                {(profile.display_name?.trim() || "Creator")}{" "}
                <span className="text-[#ab9f90]">@{profile.handle}</span>
              </p>
              <p className="mt-1 text-xs text-[#ab9f90]">
                User ID: {profile.id} | Created: {new Date(profile.created_at).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[#ab9f90]">
                Last update: {new Date(profile.updated_at).toLocaleString()} | Admin:{" "}
                {profile.is_admin ? "Yes" : "No"}
              </p>
              <p className="mt-1 text-xs text-[#ab9f90]">Effect: {profile.profile_effect || "none"}</p>
              <p className="mt-1 text-xs text-[#ab9f90]">
                Banned: {profile.is_banned ? "Yes" : "No"}
                {profile.is_banned ? ` | Reason: ${profile.banned_reason ?? "No reason provided."}` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={toPublicProfileUrl(profile.handle)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
              >
                Open profile
              </Link>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => applyBadgeSet(profile.badges ?? [])}
                disabled={busy}
              >
                Reset badges
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => applyBadgeSet([])}
                disabled={busy}
              >
                Clear badges
              </button>
              {BADGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="btn btn-secondary"
                  type="button"
                  title={preset.description}
                  onClick={() => applyBadgeSet(preset.badges)}
                  disabled={busy}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#ddd6cb]">
                <span>Public profile</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                  disabled={profile.is_banned}
                />
              </label>
              <label className="flex items-center justify-between rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-sm text-[#ddd6cb]">
                <span>Comments enabled</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--accent)]"
                  checked={commentsEnabled}
                  onChange={(event) => setCommentsEnabled(event.target.checked)}
                  disabled={profile.is_banned}
                />
              </label>
            </div>

            {profile.is_banned ? (
              <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                This profile is currently banned. Public visibility and comments stay disabled until unbanned.
              </p>
            ) : null}

            <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-xs text-[#d8d2c8]">
              Selected badges: {selectedCount}/{BADGE_OPTIONS.length}
              {unsavedChanges ? (
                <span className="ml-2 rounded-md border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-amber-100">
                  Unsaved changes
                </span>
              ) : (
                <span className="ml-2 rounded-md border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-100">
                  In sync
                </span>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {BADGE_OPTIONS.map((badge) => {
                const active = selectedBadges.includes(badge.value);

                return (
                  <label
                    key={badge.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                      active
                        ? "border-[var(--accent)] bg-[color:var(--accent-soft)] text-white"
                        : "border-white/12 bg-black/20 text-[#d8d2c8] hover:border-white/25 hover:bg-black/35"
                    }`}
                    title={badge.description}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={active}
                      onChange={() => toggleBadge(badge.value)}
                    />
                    <span className="min-w-0">
                      <span className="block">{badge.label}</span>
                      <span className="block text-[11px] text-[#9b9184]">{badge.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              type="button"
              onClick={saveProfileControls}
              disabled={busy || !unsavedChanges}
            >
              {status === "saving" ? "Saving..." : "Save profile controls"}
            </button>

            <div className="rounded-xl border border-white/12 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-white">Moderation actions</h3>
              <p className="mt-1 text-xs text-[#a59a8b]">
                Every action requires a reason and creates a user-visible notice.
              </p>

              <label className="mt-3 block space-y-1 text-sm">
                <span className="text-[#d0c8bc]">Reason</span>
                <textarea
                  className="input min-h-20"
                  value={moderationReason}
                  onChange={(event) => setModerationReason(event.target.value)}
                  placeholder="Explain why this action is being taken..."
                  maxLength={500}
                />
              </label>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {MODERATION_ACTIONS.map((item) => (
                  <button
                    key={item.action}
                    className={item.danger ? "btn btn-secondary text-red-100" : "btn btn-secondary"}
                    type="button"
                    title={item.description}
                    onClick={() => void runModeration(item.action)}
                    disabled={busy}
                  >
                    {activeModerationAction === item.action ? "Working..." : item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="panel space-y-4 p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Admin Access</h2>
            <p className="mt-1 text-sm text-[#a59b8d]">Grant or revoke admin access by handle.</p>
          </div>
          <button className="btn btn-secondary" type="button" onClick={() => void refreshAdminUsers()} disabled={adminUsersLoading}>
            {adminUsersLoading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <input
            className="input"
            value={adminHandleInput}
            onChange={(event) => setAdminHandleInput(event.target.value)}
            placeholder="handle_to_update"
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void setAdminAccess(true)}
            disabled={adminActionLoading}
          >
            Grant admin
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => void setAdminAccess(false)}
            disabled={adminActionLoading}
          >
            Revoke admin
          </button>
        </div>

        <div className="rounded-xl border border-white/12 bg-black/20">
          {admins.length ? (
            <div className="divide-y divide-white/10">
              {admins.map((admin) => (
                <div key={admin.user_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                      <p className="text-white">
                        {(admin.display_name?.trim() || "Creator")}{" "}
                        <span className="text-[#aa9f90]">@{admin.handle ?? "unknown"}</span>
                      </p>
                      <p className="text-xs text-[#8e8477]">{admin.user_id}</p>
                    </div>
                    <p className="text-xs text-[#a59b8d]">
                      Added {admin.created_at ? new Date(admin.created_at).toLocaleString() : "Unknown"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-[#a59b8d]">No admin users found.</p>
            )}
          </div>
        </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {message}
        </p>
      ) : null}
    </div>
  );
}
