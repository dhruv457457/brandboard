"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Shown when a page throws: say what happened and offer a retry, never a blank screen. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="wrap pt-16 pb-24 grid gap-4 justify-items-center text-center">
      <span className="eyebrow">Something went wrong</span>
      <h1 className="text-4xl font-extrabold tracking-tight">This page didn&apos;t load</h1>
      <p className="text-[var(--muted)] max-w-md">
        Usually the network or the chain is slow for a moment. Your funds are safe in the contract either way.
      </p>
      <div className="flex gap-2 flex-wrap justify-center">
        <Button variant="primary" onClick={reset}><RotateCcw size={16} /> Try again</Button>
        <Link href="/explore" className="btn-base">Go to Explore</Link>
      </div>
    </main>
  );
}
