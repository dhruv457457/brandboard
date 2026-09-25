"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { formatShortAddress } from "@/lib/format";
import { useBalances } from "@/lib/useBalances";
import { YouMenu } from "./YouMenu";

/** Signed-in account chip (handle and USDC balance) that opens the "You" menu. */
export function AccountMenu() {
  const { walletAddress, xHandle } = usePatchedAuth();
  const { usdc } = useBalances(walletAddress);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Your account"
        className="inline-flex items-center gap-2 h-9 border-2 border-[var(--line)] rounded-xl px-2.5 bg-[var(--card)] font-mono text-xs font-semibold shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)]"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
        <span className={usdc !== null ? "hidden sm:inline" : undefined}>{xHandle ? `@${xHandle}` : formatShortAddress(walletAddress)}</span>
        {usdc !== null && <span className="sm:text-[var(--muted)]"><span className="hidden sm:inline">· </span>{usdc} USDC</span>}
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-90px)] overflow-y-auto z-50 bg-[var(--card)] border-2 border-[var(--line)] rounded-2xl shadow-[4px_4px_0_var(--shadow)] p-4">
          <YouMenu onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
