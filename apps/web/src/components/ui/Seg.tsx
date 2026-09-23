import React from "react";
import { cn } from "@/lib/utils";

export interface SegItem<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegProps<T extends string = string> {
  items?: SegItem<T>[];
  options?: SegItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: "default" | "small";
  className?: string;
}

export function Seg<T extends string = string>({
  items,
  options,
  value,
  onChange,
  ariaLabel,
  size = "default",
  className,
}: SegProps<T>) {
  const actualItems = items || options || [];
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex border-2 border-[var(--line)] rounded-xl overflow-hidden bg-[var(--card)] select-none",
        size === "small" && "border-[1.5px] rounded-lg",
        className
      )}
    >
      {actualItems.map((item) => {
        const isSelected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(item.value)}
            className={cn(
              "border-0 bg-transparent font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
              size === "default" ? "px-3.5 py-1.5 text-xs sm:text-sm" : "px-2.5 py-1 text-xs",
              isSelected
                ? "bg-[var(--ink)] text-[var(--paper)]"
                : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)]"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
