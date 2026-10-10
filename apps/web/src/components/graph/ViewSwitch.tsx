"use client";

import { Network, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeView = "feed" | "patchwork";

const ITEMS = [
  { value: "feed", label: "Feed", Icon: Rows3 },
  { value: "patchwork", label: "Patchwork", Icon: Network },
] as const;

/**
 * Feed | Patchwork: a pill with a sliding ink thumb. Full width on phones, so it sits in the same place in both views.
 * One thumb slides with CSS between the two halves; a shared layout animation could be left stranded when the page
 * was left mid-animation, leaving the selected label white on white.
 */
export function ViewSwitch({ value, onChange, className }: { value: HomeView; onChange: (v: HomeView) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Home view" className={cn("relative grid grid-cols-2 p-1 rounded-full border-2 border-[var(--ink)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)]", className)}>
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--ink)] transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
        style={{ transform: value === "patchwork" ? "translateX(100%)" : "translateX(0)" }}
      />
      {ITEMS.map(({ value: v, label, Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(v)}
            className={cn("relative h-9 px-4 rounded-full inline-flex items-center justify-center gap-1.5 text-sm font-bold transition-colors", on ? "text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--ink)]")}
          >
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
