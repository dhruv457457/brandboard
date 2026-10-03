"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { clearReloadFlag } from "@/lib/recover";

/**
 * Every `motion` animation in the app follows the person's "reduce motion" setting (CSS animations do already, in
 * globals.css). It also marks the page as healthy after a while, which re-arms the one automatic reload that recovers
 * a tab left open across a deploy (see lib/recover.ts).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = setTimeout(clearReloadFlag, 15_000);
    return () => clearTimeout(t);
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
