"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { roleKey } from "@/app/welcome/WelcomeView";
import { useProfile } from "@/lib/profile";
import { isPublicPage } from "@/lib/routes";

/**
 * After someone's first sign-in, send them through onboarding (/welcome: profile, then how bidding works) and back
 * to where they were. A saved @handle means they already did it (on this device or another), so they're never sent
 * again; public pages (profiles, listings, events) never interrupt a visitor.
 */
export function RoleWelcome() {
  const { authenticated, walletAddress } = usePatchedAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { profile, fresh } = useProfile();

  useEffect(() => {
    // Wait for the saved profile: it decides whether onboarding is done, not this browser's storage alone. A "no handle"
    // answer only counts once it came from the server; the copy remembered on this device can be out of date.
    if (!authenticated || !walletAddress || !profile) return;
    const key = roleKey(walletAddress);
    try {
      if (localStorage.getItem(key)) return;
      if (profile.handle) {
        localStorage.setItem(key, "both");
        return;
      }
    } catch {
      return; // storage blocked: skip onboarding
    }
    if (!fresh || isPublicPage(pathname)) return;
    router.push(`/welcome?next=${encodeURIComponent(pathname)}`);
  }, [authenticated, walletAddress, profile, fresh, router, pathname]);

  return null;
}
