"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A card that leans towards the cursor in 3D, with a soft light following the pointer across it, like holding a
 * trading card under a lamp. Mouse and pen only; still for touch and for people who ask for less motion.
 */
export function Tilt({ children, className, max = 14, radius = "22px" }: { children: React.ReactNode; className?: string; max?: number; radius?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "touch" || still()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transition = "transform 80ms linear";
      el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * max).toFixed(2)}deg) rotateY(${((x - 0.5) * max).toFixed(2)}deg) scale(1.03)`;
      el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
      el.style.setProperty("--glare", "1");
    });
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.transition = "transform 500ms cubic-bezier(.2,.8,.2,1)";
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.setProperty("--glare", "0");
  }

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn("tilt relative will-change-transform", className)} style={{ transformStyle: "preserve-3d" }}>
      {children}
      <span className="tilt-glare" style={{ borderRadius: radius }} aria-hidden="true" />
    </div>
  );
}
