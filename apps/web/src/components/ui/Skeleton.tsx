import React, { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[var(--soft)] border border-[var(--line)]/10",
        className
      )}
      {...props}
    />
  );
}
