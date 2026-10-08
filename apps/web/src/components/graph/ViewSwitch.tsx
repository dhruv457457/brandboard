"use client";

import { motion } from "motion/react";
import { Network, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeView = "feed" | "patchwork";

const ITEMS = [
  { value: "feed", label: "Feed", Icon: Rows3 },
  { value: "patchwork", label: "Patchwork", Icon: Network },
] as const;

/** Feed | Patchwork: a pill with a sliding ink thumb. Full width on phones, so it sits in the same place in both views. */
export function ViewSwitch({ value, onChange, className }: { value: HomeView; onChange: (v: HomeView) => void; className?: string }) {
  return (
    <div role="tablist" aria-label="Home view" className={cn("grid grid-cols-2 p-1 rounded-full border-2 border-[var(--ink)] bg-[var(--card)] shadow-[3px_3px_0_var(--shadow)]", className)}>
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
            {on && <motion.span layoutId="home-view-thumb" className="absolute inset-0 rounded-full bg-[var(--ink)]" transition={{ type: "spring", stiffness: 520, damping: 38 }} />}
            <Icon size={16} className="relative" />
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
