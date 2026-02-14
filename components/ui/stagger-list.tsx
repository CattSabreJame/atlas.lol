"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type ReactNode } from "react";

export function StaggerList({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.ul
      className="space-y-3"
      initial={reduceMotion ? undefined : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.06,
            delayChildren: 0.04,
          },
        },
      }}
    >
      {children}
    </motion.ul>
  );
}

export function StaggerItem({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      variants={
        reduceMotion
          ? undefined
          : {
              hidden: { opacity: 0, y: 6 },
              show: { opacity: 1, y: 0 },
            }
      }
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.li>
  );
}
