import React, { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface AmountInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  currency?: string;
  error?: boolean;
}

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  function AmountInput(
    { currency = "USDC", className, error, value, onChange, ...props },
    ref
  ) {
    return (
      <div
        className={cn(
          "flex items-center border-2 border-[var(--line)] rounded-2xl bg-[var(--paper)] px-3.5 py-1.5 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent)]/20 transition-colors",
          error && "border-[var(--red)] focus-within:border-[var(--red)]",
          className
        )}
      >
        <span className="font-semibold text-2xl text-[var(--muted)] select-none mr-1 font-mono">
          $
        </span>
        <input
          ref={ref}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={onChange}
          className="w-full border-0 bg-transparent text-[var(--ink)] font-semibold text-2xl sm:text-3xl font-mono tabular-nums outline-none p-0 focus:ring-0"
          {...props}
        />
        <span className="font-semibold text-sm sm:text-base text-[var(--muted)] select-none ml-2 font-mono">
          {currency}
        </span>
      </div>
    );
  }
);
