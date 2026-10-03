"use client";

import { useEffect, useState } from "react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";

export interface DemoLogin {
  email: string;
  code: string;
}

let pending: Promise<DemoLogin | null> | null = null;

/** The shared demo account's email and code, read once per page load; null where the site doesn't offer it. */
export function loadDemoLogin(): Promise<DemoLogin | null> {
  pending ??= fetch("/api/demo-login")
    .then(async (r) => {
      if (!r.ok) throw new Error(`demo-login ${r.status}`);
      const j = (await r.json()) as { enabled?: boolean; email?: string; code?: string };
      return j.enabled && j.email && j.code ? { email: j.email, code: j.code } : null;
    })
    .catch(() => {
      // Rate-limited or offline: ask again next time instead of remembering "no demo account".
      pending = null;
      return null;
    });
  return pending;
}

/**
 * Is the signed-in account the shared demo account? Everyone who taps "Use the demo account" lands in the same Privy
 * account, so the app hides what would lock out or rob the next person: adding a passkey, exporting the key, changing
 * its email. The server refuses the same changes on its own (lib/server/demoAccount.ts). null while still checking.
 */
export function useIsDemoAccount(): boolean | null {
  const { user } = usePatchedAuth();
  const email = user?.email?.toLowerCase() ?? null;
  const [demoEmail, setDemoEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!email) return;
    let alive = true;
    void loadDemoLogin().then((d) => alive && setDemoEmail(d?.email.toLowerCase() ?? null));
    return () => {
      alive = false;
    };
  }, [email]);
  if (!user) return null;
  if (!email) return false;
  return demoEmail === undefined ? null : demoEmail === email;
}
