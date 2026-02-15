"use client";

import Link from "next/link";
import { BadgeCheck, Crown, Eye, MessageCircle, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { type CSSProperties, type ReactNode, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { CursorStudioRuntime } from "@/components/cursor/cursor-studio-runtime";
import { SiteLinkIcon } from "@/components/links/site-link-icon";
import { CustomMusicPlayer } from "@/components/music/custom-music-player";
import { isCatboxUrl } from "@/lib/catbox";
import { getLinkEffectClass } from "@/lib/link-appearance";
import { RichTextContent } from "@/components/profile/rich-text-content";
import { BadgeChip } from "@/components/ui/badge-chip";
import { type DiscordStatus, normalizeDiscordStatus } from "@/lib/discord";
import { ensureHandlePrefix } from "@/lib/handles";
import {
  buildCustomFontFaceCss,
  getNameEffectClass,
  normalizeProfileFontPreset,
  getProfileFontStyle,
} from "@/lib/profile-appearance";
import { getBadgeOption, normalizeBadges } from "@/lib/profile-features";
import {
  getBackgroundEffectOverlayStyle,
  getProfileBackgroundStyle,
  getProfileEffectCardStyle,
  getProfileEffectOverlayStyle,
  getThemeStyle,
  isVideoBackgroundUrl,
} from "@/lib/theme";
import {
  AvatarShape,
  BackgroundMode,
  BackgroundEffect,
  BadgeType,
  CommentRow,
  HeroAlign,
  LinkRow,
  LinkStyle,
  LinkEffect,
  MusicTrackRow,
  ProfileAnimation,
  ProfileEffect,
  ProfileRow,
} from "@/types/db";

interface PublicProfileProps {
  profile: ProfileRow;
  links: LinkRow[];
  tracks: MusicTrackRow[];
  initialComments: CommentRow[];
  initialViewCount: number;
  activeCursorAsset: { fileUrl: string; hotspotX: number; hotspotY: number } | null;
  shouldTrack: boolean;
  isViewerAuthenticated: boolean;
}

function getAvatarShapeClass(shape: AvatarShape): string {
  if (shape === "rounded") {
    return "rounded-[1.35rem]";
  }

  if (shape === "square") {
    return "rounded-lg";
  }

  return "rounded-full";
}

function getHeroAlignClass(align: HeroAlign): string {
  return align === "left" ? "items-start text-left" : "items-center text-center";
}

function getLinkSurfaceClass(style: LinkStyle): string {
  if (style === "glass") {
    return "border-white/16 bg-white/[0.04]";
  }

  if (style === "outline") {
    return "border-white/22 bg-transparent";
  }

  return "border-white/10 bg-[#17171d]/92";
}

function formatCommentDate(dateValue: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateValue));
}

function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && /^#([0-9a-fA-F]{6})$/.test(value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const normalizedAlpha = clampNumber(alpha, 0, 1);

  return `rgba(${red}, ${green}, ${blue}, ${normalizedAlpha})`;
}

function entryGateFontSizeClass(size: string): string {
  if (size === "sm") {
    return "text-3xl sm:text-4xl";
  }

  if (size === "lg") {
    return "text-6xl sm:text-7xl";
  }

  return "text-5xl sm:text-6xl";
}

function entryGateFontWeightClass(weight: string): string {
  if (weight === "medium") {
    return "font-medium";
  }

  if (weight === "bold") {
    return "font-bold";
  }

  return "font-semibold";
}

function getDiscordStatusDotClass(status: DiscordStatus): string {
  if (status === "online") {
    return "bg-emerald-400";
  }

  if (status === "idle") {
    return "bg-amber-300";
  }

  if (status === "dnd") {
    return "bg-rose-400";
  }

  return "bg-white/35";
}

const PUBLIC_BASE_WIDTH = 620;
const PUBLIC_FALLBACK_HEIGHT = 820;
const PUBLIC_FRAME_PADDING_PX = 28;

export function PublicProfile({
  profile,
  links,
  tracks,
  initialComments,
  initialViewCount,
  activeCursorAsset,
  shouldTrack,
  isViewerAuthenticated,
}: PublicProfileProps) {
  const reduceMotion = useReducedMotion();

  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [viewCount, setViewCount] = useState(initialViewCount);
  const [entryGateVisible, setEntryGateVisible] = useState(profile.entry_gate_enabled ?? false);
  const [entryGateExiting, setEntryGateExiting] = useState(false);
  const [entryGateOpen, setEntryGateOpen] = useState(!(profile.entry_gate_enabled ?? false));
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus>("offline");
  const [profileScale, setProfileScale] = useState(1);
  const [scaledWidth, setScaledWidth] = useState(PUBLIC_BASE_WIDTH);
  const [scaledHeight, setScaledHeight] = useState(PUBLIC_FALLBACK_HEIGHT);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);

  const sortedLinks = useMemo(
    () => [...links].sort((a, b) => a.sort_order - b.sort_order),
    [links],
  );
  const featuredLink = useMemo(
    () => (profile.layout === "split" ? sortedLinks[0] ?? null : null),
    [profile.layout, sortedLinks],
  );
  const secondaryLinks = useMemo(
    () => (profile.layout === "split" ? sortedLinks.slice(1) : sortedLinks),
    [profile.layout, sortedLinks],
  );

  const sortedTracks = useMemo(
    () => tracks.filter((track) => track.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [tracks],
  );

  const profileBadges = useMemo(() => normalizeBadges(profile.badges), [profile.badges]);
  const animationMode: ProfileAnimation = profile.profile_animation ?? "subtle";
  const profileEffect: ProfileEffect = profile.profile_effect ?? "none";
  const linkStyle: LinkStyle = profile.link_style ?? "soft";
  const linkEffect: LinkEffect = profile.link_effect ?? "none";
  const linkIconTint = profile.link_icon_tint ?? null;
  const avatarShape: AvatarShape = profile.avatar_shape ?? "circle";
  const avatarUrl = isCatboxUrl(profile.avatar_url) ? profile.avatar_url : null;
  const heroAlign: HeroAlign = profile.hero_align ?? "center";
  const backgroundMode: BackgroundMode = profile.background_mode ?? "theme";
  const backgroundValue = profile.background_value ?? null;
  const backgroundEffect: BackgroundEffect = profile.background_effect ?? "none";
  const profileFontPreset = normalizeProfileFontPreset(profile.profile_font_preset);
  const profileCustomFontUrl = profile.profile_custom_font_url ?? null;
  const entryGateFontPreset = normalizeProfileFontPreset(profile.entry_gate_font_preset);
  const entryGateCustomFontUrl = profile.entry_gate_custom_font_url ?? null;
  const nameEffectClass = getNameEffectClass(profile.name_effect ?? "none");
  const showViewCount = profile.show_view_count ?? true;
  const cursorEnabled = profile.cursor_enabled ?? false;
  const cursorTrailsEnabled = profile.cursor_trails_enabled ?? false;
  const cursorMode = profile.cursor_mode ?? "glow";
  const cursorTrailMode = profile.cursor_trail_mode ?? "velocity";

  const hasVideoBackground = backgroundMode === "image" && isVideoBackgroundUrl(backgroundValue);
  const pageStyle = {
    ...getThemeStyle(profile.theme, profile.color_accent),
    ...getProfileBackgroundStyle(backgroundMode, backgroundValue),
  };
  const customFontFaceCss = useMemo(
    () => buildCustomFontFaceCss(profileCustomFontUrl, "AtlasProfileCustom"),
    [profileCustomFontUrl],
  );
  const entryGateCustomFontFaceCss = useMemo(
    () => buildCustomFontFaceCss(entryGateCustomFontUrl, "AtlasEntryGateCustom"),
    [entryGateCustomFontUrl],
  );
  const profileFontStyle = useMemo(
    () => getProfileFontStyle(profileFontPreset, profileCustomFontUrl, "AtlasProfileCustom"),
    [profileCustomFontUrl, profileFontPreset],
  );
  const entryGateFontStyle = useMemo(
    () => getProfileFontStyle(entryGateFontPreset, entryGateCustomFontUrl, "AtlasEntryGateCustom"),
    [entryGateCustomFontUrl, entryGateFontPreset],
  );
  const effectStyle = useMemo(() => {
    const base = getProfileEffectCardStyle(profileEffect);

    if (!reduceMotion || !base) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [profileEffect, reduceMotion]);
  const effectOverlayStyle = useMemo(() => {
    const base = getProfileEffectOverlayStyle(profileEffect);

    if (!base || !reduceMotion) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [profileEffect, reduceMotion]);
  const backgroundEffectOverlayStyle = useMemo(() => {
    const base = getBackgroundEffectOverlayStyle(backgroundEffect);

    if (!base || !reduceMotion) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [backgroundEffect, reduceMotion]);

  const richText = profile.rich_text ?? "";
  const linkEffectClass = getLinkEffectClass(linkEffect);
  const formattedViewCount = useMemo(
    () => new Intl.NumberFormat("en-US").format(viewCount),
    [viewCount],
  );
  const entryText = (profile.entry_gate_text?.trim() || "Click").slice(0, 32);
  const entryTextColor = isHexColor(profile.entry_gate_text_color)
    ? profile.entry_gate_text_color
    : "#F2F1EE";
  const entryBackgroundColor = isHexColor(profile.entry_gate_background_color)
    ? profile.entry_gate_background_color
    : "#080809";
  const entryBackgroundOpacity = clampNumber(
    typeof profile.entry_gate_background_opacity === "number"
      ? profile.entry_gate_background_opacity
      : 90,
    35,
    100,
  );
  const entryBackgroundBlurPx = clampNumber(
    typeof profile.entry_gate_background_blur_px === "number"
      ? profile.entry_gate_background_blur_px
      : 12,
    0,
    32,
  );
  const entryOverlayColor = hexToRgba(entryBackgroundColor, entryBackgroundOpacity / 100);
  const entryFontSizeClass = entryGateFontSizeClass(profile.entry_gate_font_size ?? "md");
  const entryFontWeightClass = entryGateFontWeightClass(profile.entry_gate_font_weight ?? "semibold");
  const badgeIcon: Record<BadgeType, ReactNode> = {
    owner: <Crown className="h-3.5 w-3.5" />,
    admin: <ShieldCheck className="h-3.5 w-3.5" />,
    staff: <Wrench className="h-3.5 w-3.5" />,
    verified: <BadgeCheck className="h-3.5 w-3.5" />,
    pro: <Sparkles className="h-3.5 w-3.5" />,
    founder: <Crown className="h-3.5 w-3.5" />,
  };
  const shouldShowDiscordStatus = profile.discord_presence_enabled && Boolean(profile.discord_user_id);

  useEffect(() => {
    if (!shouldShowDiscordStatus || !profile.discord_user_id) {
      setDiscordStatus("offline");
      return;
    }

    let active = true;
    let timer: number | null = null;

    const syncDiscordStatus = async () => {
      try {
        const response = await fetch(
          `/api/discord/presence?userId=${encodeURIComponent(profile.discord_user_id as string)}&activity=0`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          if (active) {
            setDiscordStatus("offline");
          }
          return;
        }

        const payload = (await response.json()) as { status?: unknown };

        if (active) {
          setDiscordStatus(normalizeDiscordStatus(payload.status));
        }
      } catch {
        if (active) {
          setDiscordStatus("offline");
        }
      }
    };

    void syncDiscordStatus();
    timer = window.setInterval(() => {
      void syncDiscordStatus();
    }, 45000);

    return () => {
      active = false;

      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [profile.discord_user_id, shouldShowDiscordStatus]);

  function handleEntryGateClick() {
    if (entryGateExiting) {
      return;
    }

    setEntryGateExiting(true);

    const backgroundVideo = backgroundVideoRef.current;
    if (backgroundVideo) {
      backgroundVideo.muted = true;
      void backgroundVideo.play().catch(() => undefined);
    }

    // Signals the custom music player that user interaction happened.
    window.dispatchEvent(new Event("atlas-entry-allow-audio"));

    window.setTimeout(() => {
      setEntryGateVisible(false);
      setEntryGateOpen(true);
    }, 380);
  }

  useEffect(() => {
    if (!entryGateOpen || !hasVideoBackground) {
      return;
    }

    const backgroundVideo = backgroundVideoRef.current;
    if (!backgroundVideo) {
      return;
    }

    backgroundVideo.muted = true;
    void backgroundVideo.play().catch(() => undefined);
  }, [backgroundValue, entryGateOpen, hasVideoBackground]);

  useEffect(() => {
    if (!shouldTrack) {
      return;
    }

    const controller = new AbortController();
    const trackView = async () => {
      try {
        const response = await fetch(
          `/api/track/view?handle=${encodeURIComponent(profile.handle)}`,
          {
            method: "POST",
            signal: controller.signal,
          },
        );

        if (response.ok && !controller.signal.aborted) {
          setViewCount((prev) => prev + 1);
        }
      } catch {
        // Ignore tracking failures on public rendering.
      }
    };

    void trackView();

    return () => controller.abort();
  }, [profile.handle, shouldTrack]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;

    if (!viewport || !content) {
      return;
    }

    let rafId = 0;

    const calculateScale = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const availableWidth = Math.max(viewport.clientWidth - PUBLIC_FRAME_PADDING_PX, 1);
        const availableHeight = Math.max(viewport.clientHeight - PUBLIC_FRAME_PADDING_PX, 1);
        const contentHeight = content.scrollHeight;

        if (!availableWidth || !availableHeight || !contentHeight) {
          return;
        }

        const widthScale = availableWidth / PUBLIC_BASE_WIDTH;
        const heightScale = availableHeight / contentHeight;
        const nextScale = Math.min(1, widthScale, heightScale);

        setProfileScale(nextScale);
        setScaledWidth(PUBLIC_BASE_WIDTH * nextScale);
        setScaledHeight(contentHeight * nextScale);
      });
    };

    calculateScale();

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(calculateScale);
      observer.observe(viewport);
      observer.observe(content);
    }

    window.addEventListener("resize", calculateScale);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", calculateScale);
    };
  }, [
    animationMode,
    avatarShape,
    backgroundMode,
    backgroundValue,
    commentBody,
    comments.length,
    heroAlign,
    linkEffect,
    linkIconTint,
    linkStyle,
    profile.avatar_float,
    profile.avatar_url,
    profile.bio,
    profile.display_name,
    profile.handle,
    richText,
    sortedLinks.length,
    sortedTracks.length,
  ]);

  function trackClick(linkId: string) {
    if (!shouldTrack) {
      return;
    }

    fetch("/api/track/click", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({ linkId }),
    }).catch(() => undefined);
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommentError("");
    setCommentMessage("");

    if (!profile.comments_enabled) {
      setCommentError("Comments are disabled for this profile.");
      return;
    }

    setCommentLoading(true);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          handle: profile.handle,
          body: commentBody,
        }),
      });

      const payload = (await response.json()) as { error?: string; comment?: CommentRow };

      if (!response.ok || !payload.comment) {
        throw new Error(payload.error ?? "Unable to post comment.");
      }

      setComments((prev) => [payload.comment as CommentRow, ...prev]);
      setCommentBody("");
      setCommentMessage("Comment posted.");
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : "Unable to post comment.");
    } finally {
      setCommentLoading(false);
    }
  }

  return (
    <main className="relative isolate h-[100dvh] w-full overflow-hidden bg-[#080809]" style={pageStyle}>
      {cursorEnabled ? (
        <CursorStudioRuntime
          enabled={cursorEnabled}
          trailsEnabled={cursorTrailsEnabled}
          cursorMode={cursorMode}
          trailMode={cursorTrailMode}
          cursorAsset={activeCursorAsset}
        />
      ) : null}
      {hasVideoBackground ? (
        <video
          ref={backgroundVideoRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          src={backgroundValue ?? undefined}
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(7,7,9,0.48),rgba(7,7,9,0.88))]" />
      {backgroundEffectOverlayStyle ? (
        <div className="pointer-events-none absolute inset-0 z-[2]" style={backgroundEffectOverlayStyle} />
      ) : null}

      <div className="relative z-10 h-full px-3 py-3 sm:px-4 sm:py-5">
        <div ref={viewportRef} className="relative mx-auto h-full w-full max-w-[720px]">
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
            initial={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <section
              ref={contentRef}
              className="panel relative isolate overflow-hidden px-5 py-6 sm:px-7 sm:py-8"
              style={{
                width: `${PUBLIC_BASE_WIDTH}px`,
                transform: `scale(${profileScale})`,
                transformOrigin: "top left",
                ...effectStyle,
                ...profileFontStyle,
              }}
            >
            {customFontFaceCss ? <style>{customFontFaceCss}</style> : null}
            {entryGateCustomFontFaceCss ? <style>{entryGateCustomFontFaceCss}</style> : null}
            {effectOverlayStyle ? <div className="pointer-events-none absolute inset-0 z-[1]" style={effectOverlayStyle} /> : null}

            <div className="relative z-10 space-y-7 pb-14">
              <header className={`flex flex-col ${getHeroAlignClass(heroAlign)}`}>
                <motion.div
                  animate={
                    profile.avatar_float && !reduceMotion
                      ? { y: [0, -2, 0] }
                      : animationMode === "subtle" && !reduceMotion
                        ? { y: [0, -2, 0] }
                        : animationMode === "lift" && !reduceMotion
                          ? { y: [0, -4, 0] }
                          : animationMode === "pulse" && !reduceMotion
                            ? { scale: [1, 1.024, 1] }
                            : undefined
                  }
                  transition={
                    profile.avatar_float && !reduceMotion
                      ? { duration: 4.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                      : animationMode === "lift" && !reduceMotion
                        ? { duration: 3.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                        : animationMode === "pulse" && !reduceMotion
                          ? { duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                          : animationMode === "subtle" && !reduceMotion
                            ? { duration: 4.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                            : undefined
                  }
                >
                  <div className="relative">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={`${profile.display_name ?? profile.handle} avatar`}
                        className={`h-24 w-24 border border-white/16 object-cover ${getAvatarShapeClass(avatarShape)}`}
                        src={avatarUrl}
                      />
                    ) : (
                      <div
                        className={`h-24 w-24 border border-white/16 bg-gradient-to-b from-[#26262f] to-[#16161d] ${getAvatarShapeClass(
                          avatarShape,
                        )}`}
                      />
                    )}

                    {shouldShowDiscordStatus ? (
                      <span
                        className={`absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2 border-[#0b0b0f] ${getDiscordStatusDotClass(
                          discordStatus,
                        )}`}
                        title={`Discord ${discordStatus}`}
                      />
                    ) : null}
                  </div>
                </motion.div>

                <h1 className={`mt-4 text-[2rem] leading-none font-semibold tracking-tight text-white sm:text-[2.2rem] ${nameEffectClass}`}>
                  {profile.display_name?.trim() || "Creator"}
                </h1>
                <p className="mt-2 text-base text-[var(--accent-strong)]">{ensureHandlePrefix(profile.handle)}</p>
                {profile.bio ? (
                  <p className="mt-4 max-w-[46ch] text-[1.03rem] leading-relaxed text-[#c9c1b4]">{profile.bio}</p>
                ) : null}

                {profileBadges.length ? (
                  <div className={`mt-4 flex flex-wrap gap-1.5 ${heroAlign === "left" ? "justify-start" : "justify-center"}`}>
                    {profileBadges.map((badge) => {
                      const badgeMeta = getBadgeOption(badge);

                      return (
                        <BadgeChip
                          key={badge}
                          label={badgeMeta.label}
                          description={badgeMeta.description}
                          icon={badgeIcon[badge]}
                          className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/28 px-2 py-1 text-[10px] text-[#ded8ce] transition hover:border-white/24 hover:bg-black/40 focus-visible:border-white/24 focus-visible:bg-black/40 focus-visible:outline-none"
                        />
                      );
                    })}
                  </div>
                ) : null}
              </header>

              {richText.trim() ? (
                <section className="surface-soft p-4 sm:p-5">
                  <RichTextContent value={richText} />
                </section>
              ) : null}

              <section className="space-y-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9d9488]">Links</p>
                {secondaryLinks.length || featuredLink ? (
                  <div className="flex flex-wrap gap-2.5">
                    {featuredLink ? (
                      <motion.a
                        key={featuredLink.id}
                        className={`hover-lift inline-flex h-14 w-14 items-center justify-center rounded-xl border transition ${getLinkSurfaceClass(linkStyle)} ${linkEffectClass}`}
                        href={featuredLink.url}
                        onClick={() => trackClick(featuredLink.id)}
                        rel="noreferrer"
                        target="_blank"
                        aria-label={featuredLink.title}
                        title={featuredLink.title}
                        whileHover={reduceMotion ? undefined : { y: -2 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-white/12 bg-black/24">
                          <SiteLinkIcon
                            url={featuredLink.url}
                            icon={featuredLink.icon}
                            iconTint={linkIconTint}
                            alt={`${featuredLink.title} icon`}
                            className="flex h-8 w-8 items-center justify-center"
                            imgClassName="h-8 w-8 object-cover"
                            textClassName="text-[15px] text-[#d9d2c8]"
                            fallbackClassName="h-4 w-4 rounded-full bg-white/30"
                          />
                        </span>
                      </motion.a>
                    ) : null}

                    <div className="flex flex-wrap gap-2.5">
                      {secondaryLinks.map((link) => (
                        <motion.a
                          key={link.id}
                          className={`hover-lift inline-flex h-14 w-14 items-center justify-center rounded-xl border transition ${getLinkSurfaceClass(linkStyle)} ${linkEffectClass}`}
                          href={link.url}
                          onClick={() => trackClick(link.id)}
                          rel="noreferrer"
                          target="_blank"
                          aria-label={link.title}
                          title={link.title}
                          whileHover={reduceMotion ? undefined : { y: -2 }}
                          whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                          transition={{ duration: 0.16, ease: "easeOut" }}
                        >
                          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-white/12 bg-black/24">
                            <SiteLinkIcon
                              url={link.url}
                              icon={link.icon}
                              iconTint={linkIconTint}
                              alt={`${link.title} icon`}
                              className="flex h-8 w-8 items-center justify-center"
                              imgClassName="h-8 w-8 object-cover"
                              textClassName="text-[15px] text-[#d9d2c8]"
                              fallbackClassName="h-4 w-4 rounded-full bg-white/30"
                            />
                          </span>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-[#a69f92]">No links published yet.</p>
                )}
              </section>

              {sortedTracks.length ? (
                <section className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#9d9488]">Music</p>
                  <CustomMusicPlayer
                    tracks={sortedTracks.map((track) => ({
                      id: track.id,
                      title: track.title,
                      url: track.embed_url,
                    }))}
                    autoPlay={entryGateOpen}
                  />
                </section>
              ) : null}

              {profile.comments_enabled ? (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-[var(--accent-strong)]" />
                    <p className="text-sm font-medium text-white">Comments</p>
                  </div>

                  {isViewerAuthenticated ? (
                    <form className="surface-soft space-y-3 p-4" onSubmit={submitComment}>
                      <p className="text-xs text-[#a79f92]">Posting as your account name.</p>
                      <textarea
                        className="input min-h-20"
                        placeholder="Leave a comment"
                        value={commentBody}
                        onChange={(event) => setCommentBody(event.target.value)}
                        maxLength={300}
                        required
                      />

                      {commentError ? (
                        <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                          {commentError}
                        </p>
                      ) : null}

                      {commentMessage ? (
                        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                          {commentMessage}
                        </p>
                      ) : null}

                      <button className="btn btn-primary" type="submit" disabled={commentLoading}>
                        {commentLoading ? "Posting..." : "Post comment"}
                      </button>
                    </form>
                  ) : (
                    <div className="surface-soft flex flex-col items-start gap-3 p-4">
                      <p className="text-sm text-[#b8afa2]">Sign in to leave a comment.</p>
                      <Link
                        className="btn btn-secondary"
                        href={`/auth?mode=sign-in&next=${encodeURIComponent(`/@${profile.handle}`)}`}
                      >
                        Sign in to comment
                      </Link>
                    </div>
                  )}

                  {comments.length ? (
                    <div className="space-y-2">
                      {comments.slice(0, 8).map((comment) => (
                        <div key={comment.id} className="surface-soft px-4 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-medium text-white">{comment.author_name}</p>
                            <p className="text-[10px] text-[#8e8679]">{formatCommentDate(comment.created_at)}</p>
                          </div>
                          <p className="mt-1 text-sm text-[#d6d0c5]">{comment.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#9e968a]">No comments yet.</p>
                  )}
                </section>
              ) : null}
            </div>
            {showViewCount ? (
              <div className="pointer-events-none absolute right-4 bottom-4 z-[12] inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-black/42 px-2.5 py-1 text-xs text-[#ddd6cb]">
                <Eye className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                <span>{formattedViewCount}</span>
              </div>
            ) : null}
          </section>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {entryGateVisible ? (
          <motion.button
            type="button"
            className="fixed inset-0 z-40 flex appearance-none items-center justify-center border-0 p-0"
            style={{
              backgroundColor: entryOverlayColor,
              backdropFilter: `blur(${entryBackgroundBlurPx}px)`,
              WebkitBackdropFilter: `blur(${entryBackgroundBlurPx}px)`,
            }}
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: entryGateExiting ? 0 : 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            onClick={handleEntryGateClick}
          >
            <motion.span
              className={`${entryFontSizeClass} ${entryFontWeightClass} tracking-[0.1em]`}
              style={{ color: entryTextColor, ...entryGateFontStyle }}
              initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: entryGateExiting ? 0 : 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {entryText}
            </motion.span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

