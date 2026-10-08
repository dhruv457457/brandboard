"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEADLINE } from "@/lib/contest";

/** "2d 12h" or "5h 20m": short enough to never be cut off on a phone. */
function left(ms: number) {
  const m = Math.floor(ms / 60_000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}

/** A slim strip on Home while Get Patched Week runs. Gone once entries close. */
export function ContestBanner() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null || now >= DEADLINE) return null;
  return (
    <Link
      href="/contest"
      className="group mx-4 md:mx-5 mt-3 mb-1 flex items-center gap-3 rounded-2xl border-2 border-[var(--ink)] bg-[var(--accent)] pl-2.5 pr-3.5 py-2.5 no-underline text-[#0b0b0c] shadow-[3px_3px_0_var(--shadow)] transition-transform hover:-translate-y-0.5"
    >
      <span className="relative grid place-items-center w-11 h-11 flex-none rounded-xl border-2 border-[#0b0b0c] bg-[var(--p3)] -rotate-6 font-display font-extrabold text-[15px]">
        $30
        <span className="absolute inset-[3px] rounded-[8px] border border-dashed border-[#0b0b0c]/50" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 grid leading-tight">
        <b className="font-display font-extrabold text-[16px] truncate">Get Patched Week</b>
        <span className="text-[12.5px] font-semibold truncate">3 × $10 USDC · {left(DEADLINE - now)} left</span>
      </span>
      <span className="flex-none grid place-items-center w-8 h-8 rounded-full bg-[#0b0b0c] text-[var(--accent)] transition-transform group-hover:translate-x-0.5">
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}
