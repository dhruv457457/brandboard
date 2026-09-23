import React, { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn("card-surface p-4 text-[var(--ink)]", className)}
      {...props}
    >
      {children}
    </div>
  );
});
