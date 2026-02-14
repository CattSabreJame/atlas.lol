"use client";

import { type CSSProperties, useMemo, useState } from "react";

import {
  getLinkIconTintFallbackStyle,
  getLinkIconTintImageStyle,
  getLinkIconTintTextStyle,
} from "@/lib/link-appearance";

import {
  getFallbackFaviconUrl,
  getSiteFaviconUrl,
  isHttpUrl,
  isLikelyCustomTextIcon,
  resolveLinkIconValue,
} from "@/lib/link-icons";

interface SiteLinkIconProps {
  url: string;
  icon?: string | null;
  iconTint?: string | null;
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  fallbackClassName?: string;
  alt: string;
}

interface SiteLinkImageProps {
  initialSrc: string | null;
  fallbackSrc: string | null;
  url: string;
  alt: string;
  imgClassName: string;
  imgStyle?: CSSProperties;
  fallbackWrapperClass: string;
  fallbackClassName: string;
  fallbackStyle?: CSSProperties;
}

function SiteLinkImage({
  initialSrc,
  fallbackSrc,
  url,
  alt,
  imgClassName,
  imgStyle,
  fallbackWrapperClass,
  fallbackClassName,
  fallbackStyle,
}: SiteLinkImageProps) {
  const [imageSrc, setImageSrc] = useState(initialSrc);
  const [usedFallback, setUsedFallback] = useState(false);

  if (!imageSrc) {
    return (
      <span className={fallbackWrapperClass}>
        <span className={fallbackClassName} style={fallbackStyle} />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={imgClassName}
      style={imgStyle}
      onError={() => {
        if (!usedFallback && fallbackSrc && fallbackSrc !== imageSrc) {
          setImageSrc(fallbackSrc);
          setUsedFallback(true);
          return;
        }

        const siteFavicon = getSiteFaviconUrl(url);
        if (!usedFallback && siteFavicon && siteFavicon !== imageSrc) {
          setImageSrc(siteFavicon);
          setUsedFallback(true);
          return;
        }

        setImageSrc(null);
      }}
    />
  );
}

export function SiteLinkIcon({
  url,
  icon,
  iconTint,
  className = "",
  imgClassName = "",
  textClassName = "",
  fallbackClassName = "",
  alt,
}: SiteLinkIconProps) {
  const iconValue = useMemo(() => resolveLinkIconValue(url, icon), [icon, url]);
  const fallbackSrc = useMemo(() => getFallbackFaviconUrl(url), [url]);
  const imageSrc = iconValue && isHttpUrl(iconValue) ? iconValue : null;
  const imageTintStyle = useMemo(() => getLinkIconTintImageStyle(iconTint), [iconTint]);
  const textTintStyle = useMemo(() => getLinkIconTintTextStyle(iconTint), [iconTint]);
  const fallbackTintStyle = useMemo(() => getLinkIconTintFallbackStyle(iconTint), [iconTint]);

  if (iconValue && isLikelyCustomTextIcon(iconValue)) {
    return (
      <span className={textClassName} style={textTintStyle}>
        {iconValue}
      </span>
    );
  }

  if (imageSrc) {
    return (
      <SiteLinkImage
        key={`${url}:${iconValue ?? ""}`}
        initialSrc={imageSrc}
        fallbackSrc={fallbackSrc}
        url={url}
        alt={alt}
        imgClassName={imgClassName}
        imgStyle={imageTintStyle}
        fallbackWrapperClass={className}
        fallbackClassName={fallbackClassName}
        fallbackStyle={fallbackTintStyle}
      />
    );
  }

  return (
    <span className={className}>
      <span className={fallbackClassName} style={fallbackTintStyle} />
    </span>
  );
}
