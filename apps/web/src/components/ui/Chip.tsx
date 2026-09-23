import React, { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "monad" | "green" | "orange";
}

export function Chip({
  variant = "default",
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold border-[1.5px] border-[var(--line)] rounded-full px-2.5 py-0.5 bg-[var(--card)] text-[var(--ink)] select-none",
        variant === "monad" && "before:content-[''] before:w-2 before:h-2 before:bg-[var(--monad)] before:rotate-45 before:rounded-[1.5px] before:flex-none",
        variant === "green" && "bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]",
        variant === "orange" && "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-text)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
