"use client";

import { motion, useReducedMotion } from "framer-motion";

export function AmbientOrbs() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -top-28 left-[-6%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(255,255,255,0.11),rgba(255,255,255,0.01)_62%)] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 20, 0],
                y: [0, 10, 0],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 13,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
      <motion.div
        className="absolute -bottom-24 right-[-8%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_60%_55%,color-mix(in_srgb,var(--accent)_22%,rgba(255,255,255,0.04)),rgba(255,255,255,0.01)_68%)] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -18, 0],
                y: [0, -12, 0],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 15,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }
        }
      />
    </div>
  );
}
