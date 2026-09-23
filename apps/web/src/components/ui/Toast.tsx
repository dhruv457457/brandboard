"use client";

import React from "react";
import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";
import { useTheme } from "@/lib/theme";

export function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "w-full max-w-[460px] bg-[var(--ink)] text-[var(--paper)] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-[4px_4px_0_var(--accent)] border border-[var(--ink)] font-sans text-sm animate-[toastIn_0.35s_cubic-bezier(0.2,1.3,0.4,1)]",
          title: "font-medium text-sm text-[var(--paper)]",
          description: "text-xs text-[var(--muted)]",
          actionButton:
            "bg-[var(--accent)] text-[var(--on-accent)] font-bold text-xs px-3 py-1.5 rounded-lg border-0 cursor-pointer hover:opacity-90 active:scale-95 transition-all flex-none",
          cancelButton:
            "bg-transparent text-[var(--muted)] font-semibold text-xs px-2.5 py-1.5 rounded-lg border-0 cursor-pointer hover:text-[var(--paper)]",
        },
      }}
    />
  );
}

export const toast = sonnerToast;
