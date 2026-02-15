"use client";

import { BadgeCheck, Crown, Eye, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { CustomMusicPlayer } from "@/components/music/custom-music-player";
import { SiteLinkIcon } from "@/components/links/site-link-icon";
import { getLinkEffectClass } from "@/lib/link-appearance";
import { RichTextContent } from "@/components/profile/rich-text-content";
import { BadgeChip } from "@/components/ui/badge-chip";
import {
  buildCustomFontFaceCss,
  getNameEffectClass,
  getProfileFontStyle,
} from "@/lib/profile-appearance";
import { getBadgeOption } from "@/lib/profile-features";
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
  HeroAlign,
  LayoutName,
  LinkRow,
  LinkStyle,
  LinkEffect,
  MusicTrackRow,
  NameEffect,
  ProfileFontPreset,
  ProfileAnimation,
  ProfileEffect,
} from "@/types/db";

type PreviewDevice = "phone" | "tablet" | "desktop";

interface LivePreviewProps {
  profile: {
    displayName: string;
    handle: string;
    bio: string;
    avatarUrl: string;
    theme: "slate" | "emerald" | "amber" | "rose";
    colorAccent: string | null;
    layout: LayoutName;
    richText: string;
    badges: BadgeType[];
    profileAnimation: ProfileAnimation;
    avatarFloat: boolean;
    profileEffect: ProfileEffect;
    linkStyle: LinkStyle;
    linkEffect: LinkEffect;
    linkIconTint: string | null;
    avatarShape: AvatarShape;
    heroAlign: HeroAlign;
    backgroundMode: BackgroundMode;
    backgroundValue: string | null;
    backgroundEffect: BackgroundEffect;
    discordPresenceEnabled: boolean;
    discordConnected: boolean;
    showViewCount: boolean;
    profileFontPreset: ProfileFontPreset;
    profileCustomFontUrl: string | null;
    nameEffect: NameEffect;
  };
  links: LinkRow[];
  tracks: MusicTrackRow[];
  previewDevice?: PreviewDevice;
  hideCustomBackground?: boolean;
}

function avatarShapeClass(shape: AvatarShape): string {
  if (shape === "rounded") {
    return "rounded-[1.15rem]";
  }

  if (shape === "square") {
    return "rounded-md";
  }

  return "rounded-full";
}

function heroAlignClass(align: HeroAlign): string {
  return align === "left" ? "items-start text-left" : "items-center text-center";
}

function linkCardClass(style: LinkStyle): string {
  if (style === "glass") {
    return "border-white/16 bg-white/[0.04]";
  }

  if (style === "outline") {
    return "border-white/22 bg-transparent";
  }

  return "border-white/10 bg-[#17171d]/92";
}

const PREVIEW_CONTENT_BASE_WIDTH = 620;
const PREVIEW_CONTENT_FALLBACK_HEIGHT = 820;

const PREVIEW_SPECS: Record<PreviewDevice, { viewportWidth: number; viewportHeight: number; frameMaxClass: string }> = {
  phone: {
    viewportWidth: 390,
    viewportHeight: 844,
    frameMaxClass: "max-w-[420px]",
  },
  tablet: {
    viewportWidth: 820,
    viewportHeight: 1180,
    frameMaxClass: "max-w-[620px]",
  },
  desktop: {
    viewportWidth: 1366,
    viewportHeight: 768,
    frameMaxClass: "max-w-[920px]",
  },
};

export function LivePreview({
  profile,
  links,
  tracks,
  previewDevice = "phone",
  hideCustomBackground = false,
}: LivePreviewProps) {
  const reduceMotion = useReducedMotion();
  const previewSpec = PREVIEW_SPECS[previewDevice];
  const [previewScale, setPreviewScale] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(PREVIEW_CONTENT_BASE_WIDTH);
  const [previewHeight, setPreviewHeight] = useState(PREVIEW_CONTENT_FALLBACK_HEIGHT);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const richText = profile.richText ?? "";
  const previewBackgroundMode: BackgroundMode = hideCustomBackground ? "theme" : profile.backgroundMode;
  const previewBackgroundValue = hideCustomBackground ? null : profile.backgroundValue;
  const previewBackgroundEffect: BackgroundEffect = hideCustomBackground ? "none" : profile.backgroundEffect;
  const customFontFaceCss = useMemo(
    () => buildCustomFontFaceCss(profile.profileCustomFontUrl),
    [profile.profileCustomFontUrl],
  );
  const profileFontStyle = useMemo(
    () => getProfileFontStyle(profile.profileFontPreset, profile.profileCustomFontUrl),
    [profile.profileCustomFontUrl, profile.profileFontPreset],
  );
  const nameEffectClass = getNameEffectClass(profile.nameEffect);
  const hasVideoBackground = previewBackgroundMode === "image" && isVideoBackgroundUrl(previewBackgroundValue);
  const previewBackgroundStyle = getProfileBackgroundStyle(previewBackgroundMode, previewBackgroundValue);
  const effectStyle = useMemo(() => {
    const base = getProfileEffectCardStyle(profile.profileEffect);

    if (!reduceMotion || !base) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [profile.profileEffect, reduceMotion]);
  const effectOverlay = useMemo(() => {
    const base = getProfileEffectOverlayStyle(profile.profileEffect);

    if (!base || !reduceMotion) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [profile.profileEffect, reduceMotion]);
  const backgroundEffectOverlay = useMemo(() => {
    const base = getBackgroundEffectOverlayStyle(previewBackgroundEffect);

    if (!base || !reduceMotion) {
      return base;
    }

    const nextStyle = { ...base } as CSSProperties & { animation?: string };
    delete nextStyle.animation;
    return nextStyle;
  }, [previewBackgroundEffect, reduceMotion]);

  const activeLinks = useMemo(
    () => [...links].sort((a, b) => a.sort_order - b.sort_order),
    [links],
  );
  const activeTracks = useMemo(
    () => tracks.filter((track) => track.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [tracks],
  );
  const previewViewCount = useMemo(
    () => 120 + activeLinks.length * 47 + activeTracks.length * 29,
    [activeLinks.length, activeTracks.length],
  );
  const featuredLink = profile.layout === "split" ? activeLinks[0] ?? null : null;
  const secondaryLinks = profile.layout === "split" ? activeLinks.slice(1) : activeLinks;
  const linkEffectClass = getLinkEffectClass(profile.linkEffect);

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;

    if (!frame || !content) {
      return;
    }

    let rafId = 0;

    const calculateScale = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const availableWidth = frame.clientWidth;
        const availableHeight = frame.clientHeight;
        const contentHeight = content.scrollHeight;

        if (!availableWidth || !availableHeight || !contentHeight) {
          return;
        }

        const widthScale = availableWidth / PREVIEW_CONTENT_BASE_WIDTH;
        const heightScale = availableHeight / contentHeight;
        const nextScale = Math.min(1, widthScale, heightScale);

        setPreviewScale(nextScale);
        setPreviewWidth(PREVIEW_CONTENT_BASE_WIDTH * nextScale);
        setPreviewHeight(contentHeight * nextScale);
      });
    };

    calculateScale();

    let observer: ResizeObserver | null = null;

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(calculateScale);
      observer.observe(frame);
      observer.observe(content);
    }

    window.addEventListener("resize", calculateScale);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", calculateScale);
    };
  }, [previewDevice]);

  const badgeIcon: Record<BadgeType, ReactNode> = {
    owner: <Crown className="h-3.5 w-3.5" />,
    admin: <ShieldCheck className="h-3.5 w-3.5" />,
    staff: <Wrench className="h-3.5 w-3.5" />,
    verified: <BadgeCheck className="h-3.5 w-3.5" />,
    pro: <Sparkles className="h-3.5 w-3.5" />,
    founder: <Crown className="h-3.5 w-3.5" />,
  };

  return (
    <div className="panel panel-elevated overflow-hidden p-4 sm:p-5" style={getThemeStyle(profile.theme, profile.colorAccent)}>
      <div className="relative mx-auto">
        <div className="pointer-events-none absolute -top-20 left-1/2 h-56 w-[78%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0)_72%)]" />
        <div
          ref={frameRef}
          className={`relative mx-auto w-full perspective-[1800px] ${previewSpec.frameMaxClass}`}
          style={{
            aspectRatio: `${previewSpec.viewportWidth} / ${previewSpec.viewportHeight}`,
          }}
        >
          <motion.div
            className="absolute left-1/2 top-0 -translate-x-1/2"
            style={{
              width: `${previewWidth + 22}px`,
              height: `${previewHeight + 22}px`,
            }}
            whileHover={reduceMotion ? undefined : { rotateX: 1.6, rotateY: -1.2, y: -4 }}
            transition={reduceMotion ? undefined : { duration: 0.22, ease: "easeOut" }}
          >
            <div className="relative rounded-[34px] border border-white/14 bg-[#0b1016]/96 p-[11px] shadow-[0_40px_84px_-52px_rgba(0,0,0,0.95)]">
              <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/7" />
              <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(154deg,rgba(255,255,255,0.09),rgba(255,255,255,0)_44%)] opacity-70" />
              <div className="pointer-events-none absolute left-1/2 top-[7px] h-[4px] w-20 -translate-x-1/2 rounded-full bg-white/22" />
              <div
                ref={contentRef}
                className="relative isolate overflow-hidden rounded-[24px] border border-white/10 bg-[#100e0c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  width: `${PREVIEW_CONTENT_BASE_WIDTH}px`,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                  ...previewBackgroundStyle,
                  ...effectStyle,
                  ...profileFontStyle,
                }}
              >
            {customFontFaceCss ? <style>{customFontFaceCss}</style> : null}
            {hasVideoBackground ? (
              <video
                className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                src={previewBackgroundValue ?? undefined}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(9,9,12,0.45),rgba(9,9,12,0.86))]" />
            {backgroundEffectOverlay ? (
              <div className="pointer-events-none absolute inset-0 z-[2]" style={backgroundEffectOverlay} />
            ) : null}
            {effectOverlay ? <div className="pointer-events-none absolute inset-0 z-[3]" style={effectOverlay} /> : null}

            <div className="relative z-10 space-y-5 px-4 pt-5 pb-12">
              <div className={`flex flex-col ${heroAlignClass(profile.heroAlign)}`}>
                <div
                  className={
                    profile.avatarFloat
                      ? "animate-[previewFloat_4s_ease-in-out_infinite]"
                      : profile.profileAnimation === "none"
                        ? ""
                        : profile.profileAnimation === "subtle"
                          ? "animate-[previewFloat_4s_ease-in-out_infinite]"
                          : profile.profileAnimation === "lift"
                            ? "animate-[previewLift_3.4s_ease-in-out_infinite]"
                            : "animate-[previewPulse_3.2s_ease-in-out_infinite]"
                  }
                >
                  {profile.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt="Avatar preview"
                      className={`h-20 w-20 border border-white/15 object-cover ${avatarShapeClass(profile.avatarShape)}`}
                    />
                  ) : (
                    <div
                      className={`h-20 w-20 border border-white/15 bg-gradient-to-b from-[#2a2a33] to-[#16161d] ${avatarShapeClass(
                        profile.avatarShape,
                      )}`}
                    />
                  )}
                </div>
                <p className={`mt-3 text-[1.45rem] leading-none font-semibold text-white ${nameEffectClass}`}>
                  {profile.displayName || "Creator"}
                </p>
                <p className="mt-1 text-sm text-[var(--accent-strong)]">
                  @{profile.handle.replace(/^@+/, "") || "handle"}
                </p>
                {profile.badges.length ? (
                  <div
                    className={`mt-2 flex flex-wrap gap-1.5 ${
                      profile.heroAlign === "left" ? "justify-start" : "justify-center"
                    }`}
                  >
                    {profile.badges.map((badge) => {
                      const badgeMeta = getBadgeOption(badge);

                      return (
                        <BadgeChip
                          key={badge}
                          label={badgeMeta.label}
                          description={badgeMeta.description}
                          icon={badgeIcon[badge]}
                          className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/30 px-2 py-1 text-[10px] text-[#dcd6cd] transition hover:border-white/24 hover:bg-black/40 focus-visible:border-white/24 focus-visible:bg-black/40 focus-visible:outline-none"
                        />
                      );
                    })}
                  </div>
                ) : null}
                {profile.bio ? <p className="mt-3 text-sm text-[#cac2b5]">{profile.bio}</p> : null}
              </div>

              {richText.trim() ? (
                <section className="surface-soft p-3">
                  <RichTextContent value={richText} />
                </section>
              ) : null}

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9e9589]">Links</p>
                {featuredLink ? (
                  <a
                    href={featuredLink.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={featuredLink.title}
                    title={featuredLink.title}
                    className={`group inline-flex h-14 w-14 items-center justify-center rounded-xl border transition hover:-translate-y-[2px] ${linkCardClass(
                      profile.linkStyle,
                    )} ${linkEffectClass}`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-white/12 bg-black/25">
                      <SiteLinkIcon
                        url={featuredLink.url}
                        icon={featuredLink.icon}
                        iconTint={profile.linkIconTint}
                        alt={`${featuredLink.title} icon`}
                        className="flex h-8 w-8 items-center justify-center"
                        imgClassName="h-8 w-8 object-cover"
                        textClassName="text-[15px] text-[#dad3c8]"
                        fallbackClassName="h-4 w-4 rounded-full bg-white/28"
                      />
                    </span>
                  </a>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {secondaryLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={link.title}
                      title={link.title}
                      className={`group inline-flex h-14 w-14 items-center justify-center rounded-xl border transition hover:-translate-y-[2px] ${linkCardClass(
                        profile.linkStyle,
                      )} ${linkEffectClass}`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-white/12 bg-black/25">
                        <SiteLinkIcon
                          url={link.url}
                          icon={link.icon}
                          iconTint={profile.linkIconTint}
                          alt={`${link.title} icon`}
                          className="flex h-8 w-8 items-center justify-center"
                          imgClassName="h-8 w-8 object-cover"
                          textClassName="text-[15px] text-[#dad3c8]"
                          fallbackClassName="h-4 w-4 rounded-full bg-white/28"
                        />
                      </span>
                    </a>
                  ))}
                  {!secondaryLinks.length && !featuredLink ? (
                    <p className="rounded-xl border border-white/10 bg-black/24 px-3 py-3 text-sm text-[#9e9689]">
                      No links yet.
                    </p>
                  ) : null}
                </div>
              </section>

              {activeTracks.length ? (
                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#9e9589]">Music</p>
                  <CustomMusicPlayer
                    tracks={activeTracks.slice(0, 3).map((track) => ({
                      id: track.id,
                      title: track.title,
                      url: track.embed_url,
                    }))}
                    autoPlay={false}
                    compact
                  />
                </section>
              ) : null}

              {profile.discordPresenceEnabled && profile.discordConnected ? (
                <section className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#9e9589]">Discord</p>
                  <div className="surface-soft p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                      <p className="text-sm font-medium text-white">Discord presence appears here</p>
                    </div>
                    <p className="mt-1 text-xs text-[#9a9184]">Live status updates on the public page.</p>
                  </div>
                </section>
              ) : null}

                </div>
                {profile.showViewCount ? (
                  <div className="pointer-events-none absolute right-3 bottom-3 z-[12] inline-flex items-center gap-1 rounded-full border border-white/14 bg-black/42 px-2 py-1 text-[10px] text-[#dcd6cd]">
                    <Eye className="h-3 w-3 text-[var(--accent-strong)]" />
                    <span>{new Intl.NumberFormat("en-US").format(previewViewCount)}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

