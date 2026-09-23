import React, { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full border-2 border-[var(--line)] rounded-xl px-3 py-2.5 bg-[var(--paper)] text-[var(--ink)] placeholder:text-[var(--muted)] transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60 disabled:cursor-not-allowed",
        error && "border-[var(--red)] focus:border-[var(--red)] focus:ring-[var(--red)]/20",
        className
      )}
      {...props}
    />
  );
});
