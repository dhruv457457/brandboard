"use client";

import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import type { LucideIcon } from "lucide-react";

/** What a signed-out visitor sees on a page that needs an account: what's here, and one way in. */
export function SignInPrompt({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  const { login } = usePatchedAuth();
  return (
    <div className="px-4 sm:px-6 py-16 grid place-items-center">
      <div className="w-full max-w-md text-center grid gap-4 justify-items-center">
        <span className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)] grid place-items-center">
          <Icon size={28} />
        </span>
        <div className="grid gap-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="text-[var(--muted)]">{text}</p>
        </div>
        <button type="button" onClick={login} className="btn-base btn-primary px-6">Sign in</button>
        <p className="text-xs text-[var(--muted)]">With X, email or your wallet. No seed phrase.</p>
      </div>
    </div>
  );
}
