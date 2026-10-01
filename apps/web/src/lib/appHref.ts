"use client";

import { useEffect, useState } from "react";

/**
 * Links to the main app from pages that can be served on a creator subdomain. There, "/" is the creator's own page
 * (dhruv.monad.patched.world/ shows Dhruv), so "Open the app", the logo and sign-in must point at the main domain.
 * On the main site links stay relative, so in-app navigation stays client-side.
 */
export function useAppHref(): (path: string) => string {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => {
    const domain = process.env.NEXT_PUBLIC_HANDLE_DOMAIN?.toLowerCase();
    if (domain && window.location.hostname.toLowerCase().endsWith(`.${domain}`)) setBase(`https://${domain}`);
  }, []);
  return (path: string) => (base ? `${base}${path}` : path);
}
