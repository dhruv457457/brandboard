"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop Scrim */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 bg-[rgba(11,11,12,0.35)] backdrop-blur-xs z-50 transition-opacity duration-200",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed z-50 bg-[var(--card)] text-[var(--ink)] flex flex-col gap-4 overflow-y-auto transition-transform duration-350 ease-[cubic-bezier(0.2,0.9,0.3,1)]",
          // Desktop: right drawer
          "sm:top-0 sm:right-0 sm:bottom-0 sm:w-[420px] sm:max-w-full sm:border-l-2 sm:border-[var(--line)] sm:p-6",
          // Mobile: bottom drawer
          "max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:max-h-[90vh] max-sm:border-t-2 max-sm:border-[var(--line)] max-sm:rounded-t-[24px] max-sm:p-5",
          open
            ? "translate-x-0 max-sm:translate-y-0"
            : "sm:translate-x-full max-sm:translate-y-full",
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)] transition-colors cursor-pointer border-0 bg-transparent"
        >
          <X className="w-5 h-5" />
        </button>

        {(title || description) && (
          <div className="pr-8">
            {title && (
              <h3 className="text-2xl font-extrabold text-[var(--ink)]">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-[var(--muted)] mt-1">{description}</p>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col">{children}</div>
      </aside>
    </>
  );
}
