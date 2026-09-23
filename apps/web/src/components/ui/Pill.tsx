import React, { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type PillVariant = "top" | "out" | "outbid" | "won" | "wait" | "waiting";

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
}

export function Pill({
  variant = "top",
  className,
  children,
  ...props
}: PillProps) {
  const normVariant =
    variant === "outbid" ? "out" : variant === "waiting" ? "wait" : variant;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-0.5 border-[1.5px] whitespace-nowrap select-none",
        normVariant === "top" && "bg-[var(--green-soft)] border-[var(--green)] text-[var(--green)]",
        normVariant === "out" && "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent-text)]",
        normVariant === "won" && "bg-[var(--soft)] border-[var(--monad)] text-[var(--ink)]",
        normVariant === "wait" && "bg-[var(--soft)] border-[var(--muted)] text-[var(--muted)]",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
