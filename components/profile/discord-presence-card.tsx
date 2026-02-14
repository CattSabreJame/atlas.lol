"use client";

import { useEffect, useMemo, useState } from "react";

import type { DiscordStatus } from "@/lib/discord";
import { isDiscordUserId } from "@/lib/discord";
import { cn } from "@/lib/utils";

interface DiscordPresencePayload {
  status: DiscordStatus;
  username: string | null;
  globalName: string | null;
  avatarUrl: string | null;
  activity: {
    name: string | null;
    details: string | null;
    state: string | null;
  } | null;
  listening: {
    title: string;
    artist: string | null;
  } | null;
}

interface DiscordPresenceCardProps {
  userId: string;
  showActivity: boolean;
  className?: string;
}

const STATUS_META: Record<DiscordStatus, { label: string; dotClass: string }> = {
  online: { label: "Online", dotClass: "bg-emerald-400" },
  idle: { label: "Idle", dotClass: "bg-amber-300" },
  dnd: { label: "Do Not Disturb", dotClass: "bg-rose-400" },
  offline: { label: "Offline", dotClass: "bg-white/35" },
};

function formatActivity(payload: DiscordPresencePayload, showActivity: boolean): string | null {
  if (!showActivity) {
    return null;
  }

  if (payload.listening) {
    return payload.listening.artist
      ? `Listening to ${payload.listening.title} - ${payload.listening.artist}`
      : `Listening to ${payload.listening.title}`;
  }

  if (!payload.activity?.name) {
    return null;
  }

  const pieces = [payload.activity.name, payload.activity.details, payload.activity.state]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  return pieces.join(" - ") || payload.activity.name;
}

export function DiscordPresenceCard({ userId, showActivity, className }: DiscordPresenceCardProps) {
  const [presence, setPresence] = useState<DiscordPresencePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isDiscordUserId(userId)) {
      setPresence(null);
      setLoading(false);
      return;
    }

    let active = true;
    let timer: number | null = null;

    const loadPresence = async () => {
      try {
        const response = await fetch(
          `/api/discord/presence?userId=${encodeURIComponent(userId)}&activity=${showActivity ? "1" : "0"}`,
          { cache: "no-store" },
        );

        if (!active) {
          return;
        }

        if (!response.ok) {
          setPresence(null);
          return;
        }

        const payload = (await response.json()) as DiscordPresencePayload;
        setPresence(payload);
      } catch {
        if (active) {
          setPresence(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPresence();
    timer = window.setInterval(() => {
      void loadPresence();
    }, 45000);

    return () => {
      active = false;
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [showActivity, userId]);

  const status = presence?.status ?? "offline";
  const statusMeta = STATUS_META[status];
  const title = presence?.globalName || presence?.username || "Discord";
  const subtitle = useMemo(() => formatActivity(presence ?? emptyPresence, showActivity), [presence, showActivity]);

  return (
    <div className={cn("surface-soft flex items-start gap-3 p-4", className)}>
      {presence?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={presence.avatarUrl}
          alt={`${title} avatar`}
          className="h-10 w-10 rounded-xl border border-white/12 object-cover"
        />
      ) : (
        <div className="h-10 w-10 rounded-xl border border-white/12 bg-black/25" />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta.dotClass)} />
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="text-[11px] text-[#a79f92]">{statusMeta.label}</p>
        </div>

        {loading ? (
          <p className="mt-1 text-xs text-[#958d80]">Checking status...</p>
        ) : subtitle ? (
          <p className="mt-1 truncate text-xs text-[#c8c0b4]">{subtitle}</p>
        ) : (
          <p className="mt-1 text-xs text-[#958d80]">No activity shown.</p>
        )}
      </div>
    </div>
  );
}

const emptyPresence: DiscordPresencePayload = {
  status: "offline",
  username: null,
  globalName: null,
  avatarUrl: null,
  activity: null,
  listening: null,
};
