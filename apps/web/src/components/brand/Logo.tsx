import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  markOnly?: boolean;
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("flex-none transition-transform duration-300 ease-out group-hover:rotate-[-10deg] group-hover:scale-105", className)}
    >
      <g transform="rotate(-8 20 20)">
        {/* Hard offset shadow */}
        <rect x="6" y="6" width="31" height="31" rx="9" fill="var(--ink)" />
        {/* Main orange patch */}
        <rect
          x="3.5"
          y="3.5"
          width="31"
          height="31"
          rx="9"
          fill="var(--accent)"
          stroke="var(--ink)"
          strokeWidth="2.4"
        />
        {/* Inner white dashed stitch */}
        <rect
          x="7.8"
          y="7.8"
          width="22.4"
          height="22.4"
          rx="5.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeDasharray="3 2.4"
        />
        {/* White thread "p" */}
        <path
          d="M15.5 28V12.5h5.2a4.4 4.4 0 0 1 0 8.8h-5.2"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function Logo({ markOnly = false, size = 36, className }: LogoProps) {
  return (
    <span className={cn("group inline-flex items-center gap-2.5 text-[var(--ink)] select-none", className)}>
      <LogoMark size={size} />
      {!markOnly && (
        <span
          className="font-extrabold tracking-[-0.05em] leading-none"
          style={{
            fontFamily: "var(--font-bricolage), sans-serif",
            fontSize: `${size * 0.75}px`,
          }}
        >
          patched
        </span>
      )}
    </span>
  );
}
