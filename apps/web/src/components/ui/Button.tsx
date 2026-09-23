import React, { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "ghost";
  size?: "default" | "small" | "sm";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "btn-base",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        (size === "small" || size === "sm") && "btn-small",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
