"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import { clearReloadFlag, watchForNewBuild } from "@/lib/recover";

/**
 * Every `motion` animation in the app follows the person's "reduce motion" setting (CSS animations do already, in
 * globals.css). It also marks the page as healthy after a while, which re-arms the one automatic reload that recovers
 * a tab left open across a deploy, and keeps a long-open tab on the live build (see lib/recover.ts).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = setTimeout(clearReloadFlag, 15_000);
    const stop = watchForNewBuild();
    return () => {
      clearTimeout(t);
      stop();
    };
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
