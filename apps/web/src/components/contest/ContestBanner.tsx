"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DEADLINE } from "@/lib/contest";
import { formatCountdown } from "@/lib/format";

/** A slim, hard-to-miss strip on Home while Get Patched Week runs. Gone once entries close. */
export function ContestBanner() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null || now >= DEADLINE) return null;
  const left = formatCountdown(DEADLINE);
  return (
    <Link
      href="/contest"
      className="group mx-5 my-3 flex items-center gap-3 rounded-2xl border-2 border-[var(--ink)] bg-[var(--accent)] px-4 py-3 no-underline text-[#0b0b0c] shadow-[4px_4px_0_var(--shadow)] transition-transform hover:-translate-y-0.5"
    >
      <span className="grid place-items-center w-10 h-10 flex-none rounded-xl border-2 border-[#0b0b0c] bg-[var(--p3)] -rotate-6 font-display font-extrabold text-lg">$30</span>
      <span className="min-w-0 grid leading-tight">
        <b className="font-display font-extrabold text-[17px]">Get Patched Week contest</b>
        <span className="text-[13px] truncate">3 winners, $10 USDC each. Ends in {left.text}.</span>
      </span>
      <ArrowRight size={20} className="ml-auto flex-none transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
