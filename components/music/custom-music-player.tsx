"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { resolveMusicEmbedUrl } from "@/lib/music-embeds";
import { cn } from "@/lib/utils";

interface MusicTrackInput {
  id: string;
  title: string;
  url: string;
}

interface CustomMusicPlayerProps {
  tracks: MusicTrackInput[];
  autoPlay?: boolean;
  compact?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function CustomMusicPlayer({
  tracks,
  autoPlay = true,
  compact = false,
  className,
}: CustomMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasTriedAutoplayRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [autoMuted, setAutoMuted] = useState(false);
  const [trackError, setTrackError] = useState("");

  const playableTracks = useMemo(
    () =>
      tracks
        .map((track) => {
          const resolved = resolveMusicEmbedUrl(track.url);

          if (resolved.provider !== "audio") {
            return null;
          }

          return {
            id: track.id,
            title: track.title,
            src: resolved.embedUrl,
          };
        })
        .filter(Boolean) as Array<{ id: string; title: string; src: string }>,
    [tracks],
  );

  const unsupportedCount = tracks.length - playableTracks.length;
  const safeIndex = playableTracks.length ? Math.min(currentIndex, playableTracks.length - 1) : 0;
  const currentTrack = playableTracks[safeIndex] ?? null;

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (!autoPlay || hasTriedAutoplayRef.current) {
      return;
    }

    hasTriedAutoplayRef.current = true;

    const tryAutoplay = async () => {
      setAutoplayBlocked(false);
      setAutoMuted(false);

      try {
        audio.muted = false;
        await audio.play();
        setIsMuted(false);
        setIsPlaying(true);
      } catch {
        try {
          audio.muted = true;
          await audio.play();
          setIsPlaying(true);

          try {
            // Attempt to restore audible playback after muted autoplay if browser allows it.
            audio.muted = false;
            await audio.play();
            setIsMuted(false);
            setAutoMuted(false);
          } catch {
            audio.muted = true;
            setIsMuted(true);
            setAutoMuted(true);
          }
        } catch {
          setAutoplayBlocked(true);
          setIsPlaying(false);
        }
      }
    };

    void tryAutoplay();
  }, [autoPlay, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack || !isPlaying) {
      return;
    }

    void audio.play().catch(() => {
      setIsPlaying(false);
      setAutoplayBlocked(true);
    });
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!autoplayBlocked || !autoPlay || !currentTrack) {
      return;
    }

    const tryResume = () => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      void audio.play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => undefined);
    };

    window.addEventListener("pointerdown", tryResume, { once: true });
    window.addEventListener("keydown", tryResume, { once: true });

    return () => {
      window.removeEventListener("pointerdown", tryResume);
      window.removeEventListener("keydown", tryResume);
    };
  }, [autoplayBlocked, autoPlay, currentTrack]);

  useEffect(() => {
    if (!autoMuted || !isPlaying) {
      return;
    }

    const unmuteOnFirstInteraction = () => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      audio.muted = false;
      void audio.play().catch(() => undefined);
      setIsMuted(false);
      setAutoMuted(false);
    };

    window.addEventListener("pointerdown", unmuteOnFirstInteraction, { once: true });
    window.addEventListener("keydown", unmuteOnFirstInteraction, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unmuteOnFirstInteraction);
      window.removeEventListener("keydown", unmuteOnFirstInteraction);
    };
  }, [autoMuted, isPlaying]);

  useEffect(() => {
    if (!currentTrack) {
      return;
    }

    const onEntryActivation = () => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      audio.muted = false;
      hasTriedAutoplayRef.current = true;
      void audio.play()
        .then(() => {
          setIsPlaying(true);
          setIsMuted(false);
          setAutoMuted(false);
          setAutoplayBlocked(false);
          setTrackError("");
        })
        .catch(() => {
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
    };

    window.addEventListener("atlas-entry-allow-audio", onEntryActivation);

    return () => {
      window.removeEventListener("atlas-entry-allow-audio", onEntryActivation);
    };
  }, [currentTrack]);

  function setMuted(next: boolean) {
    const audio = audioRef.current;

    if (audio) {
      audio.muted = next;
    }

    setIsMuted(next);
    if (!next) {
      setAutoMuted(false);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying && isMuted && autoMuted) {
      audio.muted = false;
      void audio.play().catch(() => undefined);
      setIsMuted(false);
      setAutoMuted(false);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    void audio.play()
      .then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
        setTrackError("");
      })
      .catch(() => {
        setAutoplayBlocked(true);
      });
  }

  function goNext() {
    if (!playableTracks.length) {
      return;
    }

    setCurrentIndex((prev) => (prev + 1) % playableTracks.length);
    setTrackError("");
  }

  function goPrev() {
    if (!playableTracks.length) {
      return;
    }

    setCurrentIndex((prev) => (prev - 1 + playableTracks.length) % playableTracks.length);
    setTrackError("");
  }

  function onSeek(nextTime: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  if (!playableTracks.length) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#a59e92]", className)}>
        Add a direct audio URL (`.mp3`, `.m4a`, `.wav`, `.ogg`) to enable the custom player.
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-white/10 bg-black/24 p-3", className)}>
      <audio
        ref={audioRef}
        src={currentTrack?.src}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        onLoadedMetadata={(event) => {
          setCurrentTime(0);
          setDuration(event.currentTarget.duration || 0);
          setTrackError("");
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={goNext}
        onError={() => {
          setTrackError("This track URL could not be played.");

          if (playableTracks.length > 1) {
            goNext();
          } else {
            setIsPlaying(false);
          }
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("truncate font-medium text-white", compact ? "text-sm" : "text-base")}>
            {currentTrack?.title || "Track"}
          </p>
          <p className="mt-0.5 text-xs text-[#9e9589]">
            {safeIndex + 1} / {playableTracks.length}
            {unsupportedCount > 0 ? ` - ${unsupportedCount} unsupported track${unsupportedCount === 1 ? "" : "s"} skipped` : ""}
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-white/12 bg-black/20 p-2 text-[#d8d1c5] transition hover:bg-white/8"
          onClick={() => setMuted(!isMuted)}
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/12 bg-black/20 p-2 text-[#d8d1c5] transition hover:bg-white/8"
          onClick={goPrev}
          aria-label="Previous track"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/12 bg-black/20 p-2 text-[#f2ece4] transition hover:bg-white/10"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/12 bg-black/20 p-2 text-[#d8d1c5] transition hover:bg-white/8"
          onClick={goNext}
          aria-label="Next track"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          className="ml-auto w-20 accent-[var(--accent)]"
          aria-label="Volume"
        />
      </div>

      <div className="mt-3 space-y-1">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0)}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Seek"
        />
        <div className="flex items-center justify-between text-[11px] text-[#9e9589]">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {autoMuted ? (
        <p className="mt-2 text-[11px] text-[#a79f92]">Autoplay started muted. Tap the sound button to unmute.</p>
      ) : null}
      {autoplayBlocked ? (
        <p className="mt-2 text-[11px] text-[#a79f92]">Autoplay was blocked by your browser. Press play to start.</p>
      ) : null}
      {trackError ? <p className="mt-2 text-[11px] text-[#a79f92]">{trackError}</p> : null}
    </div>
  );
}
