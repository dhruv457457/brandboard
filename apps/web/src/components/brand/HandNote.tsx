import { Caveat_Brush } from "next/font/google";
import { cn } from "@/lib/utils";

const hand = Caveat_Brush({ subsets: ["latin"], weight: "400", display: "swap" });

/**
 * A hand-written note with a curly arrow, like a sticker stuck on the page. It sits on the top edge of the control
 * it points at (put it inside a `relative` wrapper that has about 3rem free above). Decorative: the control carries the real label.
 */
export function HandNote({ children, className }: { children: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute right-6 -top-[46px] flex flex-col items-end", className)}>
      <span className={cn(hand.className, "text-[27px] leading-none text-[var(--ink)] -rotate-3 whitespace-nowrap")}>{children}</span>
      <svg viewBox="0 0 90 26" className="mr-16 -mt-0.5 w-[70px] text-[var(--ink)]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path className="hand-note-line" pathLength={1} d="M84 2 C 70 2, 40 4, 12 22" />
        <path className="hand-note-line" pathLength={1} d="M6 12 L 10 23 L 22 22" />
      </svg>
    </span>
  );
}
