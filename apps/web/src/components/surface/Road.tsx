import { cn } from "@/lib/utils";

/** The strip of road a car card sits on: pin it to the bottom of a relative, overflow-hidden box. Decorative. */
export function Road({ className }: { className?: string }) {
  return (
    <div className={cn("road road-sm absolute inset-x-0 bottom-0 pointer-events-none", className)} aria-hidden="true">
      <span className="road-line" />
    </div>
  );
}
