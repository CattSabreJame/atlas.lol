"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { CursorMode, CursorTrailMode } from "@/types/db";

interface CursorAssetConfig {
  fileUrl: string;
  hotspotX: number;
  hotspotY: number;
}

interface CursorStudioRuntimeProps {
  enabled: boolean;
  trailsEnabled: boolean;
  cursorMode: CursorMode;
  trailMode: CursorTrailMode;
  cursorAsset?: CursorAssetConfig | null;
}

type CursorContext = "default" | "interactive" | "panel" | "text" | "native";
type TrailKind =
  | "velocity"
  | "dot"
  | "pixel"
  | "motion_blur"
  | "thread"
  | "smoke"
  | "gravity"
  | "ripple"
  | "stream"
  | "dual_core"
  | "dual_glow"
  | "droplet";

interface TrailNode {
  id: string;
  kind: TrailKind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  angle: number;
  size: number;
  opacity: number;
  life: number;
  stretch: number;
  width?: number;
  height?: number;
  border?: boolean;
  color?: string;
  blur?: number;
}

interface RippleNode {
  id: string;
  x: number;
  y: number;
}

const INTERACTIVE_SELECTOR =
  "a,button,[role='button'],summary,label[for],.cursor-pointer,[data-cursor='interactive']";
const TEXT_SELECTOR =
  "input,textarea,select,[contenteditable='true'],[contenteditable=''],[contenteditable=true]";
const PANEL_SELECTOR = ".panel,.surface,.surface-soft,[data-cursor='panel']";

function clampHotspot(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(127, Math.max(0, Math.round(value)));
}

function getCursorContext(target: EventTarget | null): CursorContext {
  if (!(target instanceof HTMLElement)) {
    return "default";
  }

  if (target.closest(TEXT_SELECTOR)) {
    return "text";
  }

  const computed = window.getComputedStyle(target).cursor;

  if (computed.includes("text")) {
    return "text";
  }

  if (computed.includes("resize")) {
    return "native";
  }

  if (target.closest(INTERACTIVE_SELECTOR)) {
    return "interactive";
  }

  if (target.closest(PANEL_SELECTOR)) {
    return "panel";
  }

  return "default";
}

function isDragHandle(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("[draggable='true'],.cursor-grab,[data-drag-handle='true']"),
  );
}

export function CursorStudioRuntime({
  enabled,
  trailsEnabled,
  cursorMode,
  trailMode,
  cursorAsset,
}: CursorStudioRuntimeProps) {
  const reduceMotion = useReducedMotion();
  const [cursorContext, setCursorContext] = useState<CursorContext>("default");
  const [visible, setVisible] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [trailNodes, setTrailNodes] = useState<TrailNode[]>([]);
  const [ripples, setRipples] = useState<RippleNode[]>([]);
  const [cursorSpeed, setCursorSpeed] = useState(0);
  const [cursorAngle, setCursorAngle] = useState(0);

  const trailTimeoutsRef = useRef<number[]>([]);
  const rippleTimeoutsRef = useRef<number[]>([]);
  const lastMoveRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const dropletsCooldownRef = useRef(0);

  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const smoothX = useSpring(targetX, { stiffness: 700, damping: 42, mass: 0.22 });
  const smoothY = useSpring(targetY, { stiffness: 700, damping: 42, mass: 0.22 });
  const echoX = useSpring(targetX, { stiffness: 280, damping: 34, mass: 0.42 });
  const echoY = useSpring(targetY, { stiffness: 280, damping: 34, mass: 0.42 });

  const trailsAllowed = enabled && trailsEnabled && !reduceMotion;
  const hasAssetCursor = Boolean(cursorAsset?.fileUrl);
  const renderPresetCursor = enabled && !hasAssetCursor && visible && cursorContext !== "text" && cursorContext !== "native";
  const renderAssetCursor = enabled && hasAssetCursor && visible && cursorContext !== "text" && cursorContext !== "native";
  const assetHotspotX = clampHotspot(cursorAsset?.hotspotX ?? 0);
  const assetHotspotY = clampHotspot(cursorAsset?.hotspotY ?? 0);
  const normalizedSpeed = Math.min(1, cursorSpeed);
  const splitSpread = cursorContext === "interactive" ? 5 : 8 + normalizedSpeed * 9;
  const elasticStretch = 1 + normalizedSpeed * 1.6;
  const elasticSquash = Math.max(0.58, 1 - normalizedSpeed * 0.35);
  const shadowEchoOffset = 5 + normalizedSpeed * 8;
  const targetLockRingActive = cursorMode === "target_lock" && cursorContext !== "interactive";

  const cursorCss = useMemo(() => {
    if (!enabled) {
      return "";
    }

    return `
html[data-cursor-studio='enabled'], html[data-cursor-studio='enabled'] body {
  cursor: none !important;
}
html[data-cursor-studio='enabled'] a,
html[data-cursor-studio='enabled'] button,
html[data-cursor-studio='enabled'] [role='button'],
html[data-cursor-studio='enabled'] summary,
html[data-cursor-studio='enabled'] .cursor-pointer {
  cursor: none !important;
}
html[data-cursor-studio='enabled'] input,
html[data-cursor-studio='enabled'] textarea,
html[data-cursor-studio='enabled'] select,
html[data-cursor-studio='enabled'] [contenteditable='true'],
html[data-cursor-studio='enabled'] [contenteditable=''],
html[data-cursor-studio='enabled'] [contenteditable=true] {
  cursor: text !important;
}
html[data-cursor-studio='enabled'] [data-native-cursor],
html[data-cursor-studio='enabled'] [style*='resize'],
html[data-cursor-studio='enabled'] [class*='resize'] {
  cursor: auto !important;
}`;
  }, [enabled]);

  useEffect(() => {
    const root = document.documentElement;

    if (enabled) {
      root.dataset.cursorStudio = "enabled";
    } else {
      delete root.dataset.cursorStudio;
    }

    return () => {
      delete root.dataset.cursorStudio;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const addTrailNode = (node: TrailNode) => {
      setTrailNodes((prev) => [...prev.slice(-26), node]);
      const timeout = window.setTimeout(() => {
        setTrailNodes((prev) => prev.filter((item) => item.id !== node.id));
      }, node.life);
      trailTimeoutsRef.current.push(timeout);
    };

    const spawnTrail = (
      x: number,
      y: number,
      velocityX: number,
      velocityY: number,
      speed: number,
    ) => {
      if (!trailsAllowed) {
        return;
      }

      if (trailMode === "velocity") {
        if (speed < 0.95) {
          return;
        }

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "velocity",
          x,
          y,
          dx: velocityX * 55,
          dy: velocityY * 55,
          angle: Math.atan2(velocityY, velocityX) * (180 / Math.PI),
          size: Math.min(24, 10 + speed * 6),
          opacity: Math.min(0.44, 0.18 + speed * 0.08),
          life: 260,
          stretch: Math.min(2.2, 1.15 + speed * 0.32),
        });
        return;
      }

      if (trailMode === "motion_blur") {
        if (speed < 0.92) {
          return;
        }

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "motion_blur",
          x,
          y,
          dx: velocityX * 68,
          dy: velocityY * 68,
          angle: Math.atan2(velocityY, velocityX) * (180 / Math.PI),
          size: Math.min(46, 22 + speed * 14),
          opacity: Math.min(0.36, 0.16 + speed * 0.07),
          life: 220,
          stretch: Math.min(2.7, 1.25 + speed * 0.48),
        });
        return;
      }

      if (trailMode === "neon_thread") {
        if (speed < 0.22) {
          return;
        }

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "thread",
          x,
          y,
          dx: velocityX * 14,
          dy: velocityY * 14,
          angle: Math.atan2(velocityY, velocityX) * (180 / Math.PI),
          size: Math.min(34, 10 + speed * 18),
          opacity: Math.min(0.42, 0.2 + speed * 0.08),
          life: 480,
          stretch: 1,
          width: Math.min(34, 10 + speed * 18),
          height: 1.8,
          blur: 1.4,
          color: "rgba(140, 210, 255, 0.7)",
        });
        return;
      }

      if (trailMode === "smoke") {
        if (speed < 0.46) {
          return;
        }

        const count = speed > 1.2 ? 2 : 1;
        for (let index = 0; index < count; index += 1) {
          addTrailNode({
            id: crypto.randomUUID(),
            kind: "smoke",
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            dx: velocityX * (10 + index * 3) + (Math.random() - 0.5) * 8,
            dy: velocityY * (10 + index * 3) + (Math.random() - 0.5) * 8,
            angle: 0,
            size: 12 + Math.random() * 9,
            opacity: 0.18,
            life: 270,
            stretch: 1,
            blur: 7,
            color: "rgba(178, 204, 232, 0.35)",
          });
        }
        return;
      }

      if (trailMode === "gravity") {
        if (speed < 0.18) {
          return;
        }

        const count = 2 + Math.floor(Math.min(2, speed * 1.6));
        for (let index = 0; index < count; index += 1) {
          const offsetX = (Math.random() - 0.5) * 26;
          const offsetY = (Math.random() - 0.5) * 26;
          addTrailNode({
            id: crypto.randomUUID(),
            kind: "gravity",
            x: x + offsetX,
            y: y + offsetY,
            dx: -offsetX * 0.34 + velocityX * 14,
            dy: -offsetY * 0.34 + velocityY * 14,
            angle: 0,
            size: 2.8,
            opacity: 0.34,
            life: 210,
            stretch: 1,
            color: "rgba(177, 212, 247, 0.64)",
          });
        }
        return;
      }

      if (trailMode === "ripple_wake") {
        if (speed < 0.74) {
          return;
        }

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "ripple",
          x,
          y,
          dx: velocityX * 20,
          dy: velocityY * 20,
          angle: 0,
          size: 10,
          opacity: Math.min(0.42, 0.18 + speed * 0.08),
          life: 240,
          stretch: 1.45,
          width: 10,
          height: 10,
          border: true,
          color: "rgba(191, 220, 248, 0.7)",
        });
        return;
      }

      if (trailMode === "data_stream") {
        if (speed < 0.58) {
          return;
        }

        const count = 2 + Math.floor(Math.min(2, speed * 1.5));
        for (let index = 0; index < count; index += 1) {
          addTrailNode({
            id: crypto.randomUUID(),
            kind: "stream",
            x: x + (Math.random() - 0.5) * 8,
            y: y + (Math.random() - 0.5) * 8,
            dx: velocityX * (10 + index * 2),
            dy: velocityY * (12 + index * 2) + 6,
            angle: 0,
            size: 8 + Math.random() * 8,
            opacity: 0.34,
            life: 210,
            stretch: 1,
            width: 1.2,
            height: 8 + Math.random() * 8,
            color: "rgba(171, 210, 245, 0.58)",
          });
        }
        return;
      }

      if (trailMode === "dual_layer") {
        if (speed < 0.22) {
          return;
        }

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "dual_core",
          x,
          y,
          dx: velocityX * 14,
          dy: velocityY * 14,
          angle: 0,
          size: 3.4,
          opacity: 0.4,
          life: 230,
          stretch: 1,
          color: "rgba(194, 225, 251, 0.74)",
        });
        addTrailNode({
          id: crypto.randomUUID(),
          kind: "dual_glow",
          x,
          y,
          dx: velocityX * 20,
          dy: velocityY * 20,
          angle: 0,
          size: 10,
          opacity: 0.26,
          life: 250,
          stretch: 1,
          blur: 5,
          color: "rgba(164, 203, 240, 0.55)",
        });
        return;
      }

      if (trailMode === "pulse_droplets") {
        if (speed < 0.24) {
          return;
        }

        const now = performance.now();
        if (now - dropletsCooldownRef.current < 56) {
          return;
        }
        dropletsCooldownRef.current = now;

        addTrailNode({
          id: crypto.randomUUID(),
          kind: "droplet",
          x: x + (Math.random() - 0.5) * 8,
          y: y + (Math.random() - 0.5) * 8,
          dx: velocityX * 12 + (Math.random() - 0.5) * 5,
          dy: velocityY * 12 + (Math.random() - 0.5) * 5,
          angle: 0,
          size: 3.5 + Math.random() * 2.5,
          opacity: 0.35,
          life: 220,
          stretch: 1,
          color: "rgba(185, 220, 250, 0.62)",
        });
        return;
      }

      if (trailMode === "dots") {
        if (speed < 0.45) {
          return;
        }

        const count = Math.min(6, Math.max(3, Math.round(speed * 3.2)));
        for (let index = 0; index < count; index += 1) {
          addTrailNode({
            id: crypto.randomUUID(),
            kind: "dot",
            x: x - velocityX * (index * 6),
            y: y - velocityY * (index * 6),
            dx: velocityX * (10 + index * 4),
            dy: velocityY * (10 + index * 4),
            angle: 0,
            size: Math.max(2.5, 5.5 - index),
            opacity: Math.max(0.14, 0.34 - index * 0.07),
            life: 220,
            stretch: 1,
          });
        }
        return;
      }

      if (speed < 0.8) {
        return;
      }

      const count = Math.min(6, Math.max(4, Math.round(speed * 2.2)));
      for (let index = 0; index < count; index += 1) {
        addTrailNode({
          id: crypto.randomUUID(),
          kind: "pixel",
          x: x - velocityX * (index * 7) + (Math.random() - 0.5) * 7,
          y: y - velocityY * (index * 7) + (Math.random() - 0.5) * 7,
          dx: velocityX * (14 + index * 4),
          dy: velocityY * (14 + index * 4),
          angle: 0,
          size: 3.2,
          opacity: Math.max(0.14, 0.35 - index * 0.06),
          life: 230,
          stretch: 1,
        });
      }
    };

    const spawnRipple = (x: number, y: number) => {
      const ripple: RippleNode = { id: crypto.randomUUID(), x, y };
      setRipples((prev) => [...prev.slice(-2), ripple]);
      const timeout = window.setTimeout(() => {
        setRipples((prev) => prev.filter((item) => item.id !== ripple.id));
      }, 240);
      rippleTimeoutsRef.current.push(timeout);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const { clientX, clientY } = event;
      targetX.set(clientX);
      targetY.set(clientY);
      setVisible(true);

      const context = getCursorContext(event.target);
      setCursorContext((prev) => (prev === context ? prev : context));

      const now = performance.now();
      const last = lastMoveRef.current;
      if (last) {
        const dt = Math.max(now - last.t, 16);
        const dx = clientX - last.x;
        const dy = clientY - last.y;
        const velocityX = dx / dt;
        const velocityY = dy / dt;
        const speed = Math.hypot(velocityX, velocityY);
        const nextSpeed = Math.min(1.6, speed);
        setCursorSpeed((prev) => prev * 0.66 + nextSpeed * 0.34);
        setCursorAngle(Math.atan2(dy, dx) * (180 / Math.PI));
        spawnTrail(clientX, clientY, velocityX, velocityY, speed);
      } else {
        setCursorSpeed(0);
      }
      lastMoveRef.current = { x: clientX, y: clientY, t: now };
    };

    const handlePointerDown = (event: PointerEvent) => {
      setPressed(true);
      if (isDragHandle(event.target)) {
        setDragging(true);
      }

      if (enabled && cursorContext !== "text" && cursorContext !== "native") {
        spawnRipple(event.clientX, event.clientY);
      }
    };

    const handlePointerUp = () => {
      setPressed(false);
      setDragging(false);
    };

    const handlePointerLeave = () => {
      setVisible(false);
      setPressed(false);
      setDragging(false);
      setCursorSpeed(0);
      setCursorContext("default");
      lastMoveRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointerleave", handlePointerLeave);
      for (const timeout of trailTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }
      for (const timeout of rippleTimeoutsRef.current) {
        window.clearTimeout(timeout);
      }
      trailTimeoutsRef.current = [];
      rippleTimeoutsRef.current = [];
    };
  }, [cursorContext, enabled, targetX, targetY, trailMode, trailsAllowed]);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <style>{cursorCss}</style>

      <AnimatePresence>
        {trailNodes.map((trail) => {
          const width = trail.width ?? trail.size;
          const height = trail.height ?? trail.size;
          const isSquare = trail.kind === "pixel" || trail.kind === "stream";
          const isLine = trail.kind === "thread";
          const isRing = trail.kind === "ripple" || trail.border;

          const background =
            trail.color ??
            (trail.kind === "velocity"
              ? "radial-gradient(circle,rgba(167,197,230,0.62)_0%,rgba(167,197,230,0)_72%)"
              : trail.kind === "motion_blur"
                ? "radial-gradient(circle,rgba(176,211,243,0.55)_0%,rgba(176,211,243,0)_70%)"
                : trail.kind === "smoke"
                  ? "rgba(176,205,232,0.3)"
                  : trail.kind === "dual_glow"
                    ? "rgba(164,203,240,0.55)"
                    : trail.kind === "pixel"
                      ? "rgba(182,214,244,0.5)"
                      : "rgba(182,214,244,0.46)");

          const blurValue =
            trail.blur ??
            (trail.kind === "velocity"
              ? 2
              : trail.kind === "motion_blur"
                ? 4
                : trail.kind === "smoke"
                  ? 7
                  : trail.kind === "dual_glow"
                    ? 5
                    : 0);

          return (
            <motion.div
              key={trail.id}
              className={cn(
                "pointer-events-none fixed left-0 top-0 z-[9999]",
                isSquare ? "rounded-[2px]" : isLine ? "rounded-full" : "rounded-full",
              )}
              style={{
                x: trail.x,
                y: trail.y,
                width,
                height,
                rotate: trail.angle,
                transformOrigin: "center",
                background: isRing ? "transparent" : background,
                border: isRing ? `1px solid ${trail.color ?? "rgba(191,220,248,0.66)"}` : undefined,
                filter: `blur(${blurValue}px)`,
              }}
              initial={{ opacity: trail.opacity, scaleX: trail.stretch, scaleY: 1, x: trail.x, y: trail.y }}
              animate={{
                opacity: 0,
                scaleX:
                  trail.kind === "velocity" ||
                  trail.kind === "motion_blur" ||
                  trail.kind === "thread"
                    ? trail.stretch * 0.72
                    : trail.kind === "ripple"
                      ? 1.55
                      : 0.72,
                scaleY: trail.kind === "ripple" ? 1.55 : 0.72,
                x: trail.x + trail.dx,
                y: trail.y + trail.dy,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: trail.life / 1000, ease: "easeOut" }}
            />
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {renderPresetCursor ? (
          <motion.div
            className="pointer-events-none fixed left-0 top-0 z-[10000] -translate-x-1/2 -translate-y-1/2"
            style={{ x: smoothX, y: smoothY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {cursorMode === "glow" ? (
              <div className="relative">
                <motion.span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c3dcf6]/60"
                  animate={{
                    width: cursorContext === "interactive" ? 32 : 10,
                    height: cursorContext === "interactive" ? 32 : 10,
                    opacity: cursorContext === "interactive" ? 0.8 : 0.36,
                    scale: pressed ? 0.9 : 1,
                  }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                />
                <motion.span
                  className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0d9f4] shadow-[0_0_18px_rgba(168,205,239,0.6)]"
                  animate={{ scale: pressed ? 0.82 : 1 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                />
              </div>
            ) : null}

            {cursorMode === "crosshair" ? (
              <motion.div
                className="relative"
                animate={{
                  scale: dragging ? 1.14 : pressed ? 0.9 : 1,
                }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <motion.span
                  className="absolute left-1/2 top-1/2 block h-[1px] -translate-x-1/2 -translate-y-1/2 bg-[#bed8f3]/78"
                  animate={{ width: cursorContext === "interactive" ? 0 : 18 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                />
                <motion.span
                  className="absolute left-1/2 top-1/2 block w-[1px] -translate-x-1/2 -translate-y-1/2 bg-[#bed8f3]/78"
                  animate={{ height: cursorContext === "interactive" ? 0 : 18 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                />
                <span className="absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bed8f3]/80 bg-[#98c0e8]/35" />
              </motion.div>
            ) : null}

            {cursorMode === "morph" ? (
              <motion.div className="relative" transition={{ duration: 0.16, ease: "easeOut" }}>
                <motion.span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/64"
                  animate={{
                    width:
                      cursorContext === "interactive"
                        ? 30
                        : cursorContext === "panel"
                          ? 22
                          : 10,
                    height:
                      cursorContext === "interactive"
                        ? 30
                        : cursorContext === "panel"
                          ? 22
                          : 10,
                    opacity: cursorContext === "default" ? 0.32 : 0.72,
                  }}
                />
                <motion.span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5] shadow-[0_0_16px_rgba(161,198,232,0.52)]"
                  animate={{
                    width: cursorContext === "panel" ? 0 : 6,
                    height: cursorContext === "panel" ? 0 : 6,
                    opacity: cursorContext === "panel" ? 0 : 1,
                    scale: pressed ? 0.86 : 1,
                  }}
                />
              </motion.div>
            ) : null}

            {cursorMode === "split" ? (
              <motion.div
                className="relative"
                animate={{ scale: pressed ? 0.92 : 1 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
              >
                <motion.span
                  className="absolute top-1/2 block h-[1px] -translate-y-1/2 bg-[#bed8f3]/82"
                  animate={{ width: 10, x: -splitSpread }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                />
                <motion.span
                  className="absolute top-1/2 block h-[1px] -translate-y-1/2 bg-[#bed8f3]/82"
                  animate={{ width: 10, x: splitSpread }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                />
                <span className="absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0d9f4]" />
              </motion.div>
            ) : null}

            {cursorMode === "hollow_square" ? (
              <motion.div className="relative">
                <motion.span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#bfd9f4]/80"
                  animate={{
                    width: cursorContext === "interactive" ? 18 : 16,
                    height: cursorContext === "interactive" ? 18 : 16,
                    rotate: cursorContext === "interactive" ? 45 : 0,
                  }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                />
                <span className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0d9f4]" />
              </motion.div>
            ) : null}

            {cursorMode === "target_lock" ? (
              <motion.div className="relative" animate={{ scale: pressed ? 0.9 : 1 }}>
                <motion.span
                  className="absolute left-1/2 top-1/2 block h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/70"
                  animate={{ rotate: targetLockRingActive ? 360 : 0 }}
                  transition={
                    targetLockRingActive
                      ? { duration: 3.8, ease: "linear", repeat: Number.POSITIVE_INFINITY }
                      : { duration: 0.2, ease: "easeOut" }
                  }
                />
                <span className="absolute left-1/2 top-1/2 block h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]" />
              </motion.div>
            ) : null}

            {cursorMode === "invert" ? (
              <motion.span
                className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white mix-blend-difference"
                animate={{ scale: pressed ? 0.8 : 1 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              />
            ) : null}

            {cursorMode === "elastic" ? (
              <motion.span
                className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5] shadow-[0_0_16px_rgba(161,198,232,0.45)]"
                animate={{
                  width: 7 * elasticStretch,
                  height: 7 * elasticSquash,
                  rotate: cursorAngle,
                  scale: pressed ? 0.84 : 1,
                }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              />
            ) : null}

            {cursorMode === "outline_morph" ? (
              <motion.div className="relative">
                <motion.span
                  className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#c0daf5]/70"
                  animate={{
                    width: cursorContext === "interactive" ? 24 : 18,
                    height: cursorContext === "interactive" ? 24 : 18,
                    backgroundColor:
                      cursorContext === "interactive"
                        ? "rgba(192,218,245,0.85)"
                        : "rgba(192,218,245,0.04)",
                    scale: pressed ? 0.84 : 1,
                  }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                />
              </motion.div>
            ) : null}

            {cursorMode === "shadow_echo" ? (
              <motion.span
                className="absolute left-1/2 top-1/2 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c0daf5]"
                animate={{ scale: pressed ? 0.84 : 1 }}
                transition={{ duration: 0.1, ease: "easeOut" }}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {renderPresetCursor && cursorMode === "shadow_echo" ? (
          <motion.div
            className="pointer-events-none fixed left-0 top-0 z-[9999] -translate-x-1/2 -translate-y-1/2"
            style={{ x: echoX, y: echoY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="block h-2.5 w-2.5 rounded-full bg-[#9bc0e4]/34 blur-[1px]"
              animate={{
                x: shadowEchoOffset,
                y: shadowEchoOffset * 0.45,
                opacity: cursorSpeed > 0.06 ? 0.44 : 0.2,
              }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {renderAssetCursor && cursorAsset ? (
          <motion.div
            className="pointer-events-none fixed left-0 top-0 z-[10000]"
            style={{ x: smoothX, y: smoothY }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cursorAsset.fileUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="select-none object-contain"
              style={{
                maxWidth: 128,
                maxHeight: 128,
                transform: `translate(${-assetHotspotX}px, ${-assetHotspotY}px)`,
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            className="pointer-events-none fixed left-0 top-0 z-[9999] block -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bdd8f4]/55"
            style={{ x: ripple.x, y: ripple.y }}
            initial={{ width: 10, height: 10, opacity: 0.9 }}
            animate={{ width: 34, height: 34, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </>
  );
}
