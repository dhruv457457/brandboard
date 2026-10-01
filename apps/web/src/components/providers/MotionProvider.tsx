"use client";

import { MotionConfig } from "motion/react";

/** Every `motion` animation in the app follows the person's "reduce motion" setting (CSS animations do already, in globals.css). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
