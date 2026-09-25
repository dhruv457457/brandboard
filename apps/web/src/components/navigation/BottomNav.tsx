"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Gavel, LayoutDashboard, LogIn, Plus, UserRound } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";
import { YouMenu } from "./YouMenu";

/** A listing page (/<creator>/<id>) has its own sticky bid bar at the bottom instead. */
export function isListingPage(path: string) {
  return /^\/[^/]+\/\d+\/?$/.test(path) && !/^\/(studio|share)\//.test(path);
}

/** Phone navigation: the main places one thumb-tap away, and "You" for everything else. Hidden from md up. */
export function BottomNav() {
  const pathname = usePathname();
  const { authenticated, login } = usePatchedAuth();
  const [youOpen, setYouOpen] = useState(false);
  // Close the "You" sheet whenever the page changes.
  useEffect(() => setYouOpen(false), [pathname]);
  if (isListingPage(pathname)) return null;

  const items = [
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/bids", label: "My bids", icon: Gavel },
    { href: "/studio", label: "Create", icon: Plus, primary: true },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];

  const item = "flex flex-col items-center justify-center gap-0.5 min-h-[56px] w-full text-[11px] font-semibold no-underline";
  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav
        aria-label="Main navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)]/95 backdrop-blur-md border-t-2 border-[var(--line)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {items.map(({ href, label, icon: Icon, primary }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-[var(--ink)]" : "text-[var(--muted)]")}>
                  {primary ? (
                    <span className="w-10 h-10 -mt-1 rounded-xl grid place-items-center bg-[var(--accent)] text-[var(--on-accent)] border-2 border-[var(--line)] shadow-[2px_2px_0_var(--shadow)]">
                      <Icon size={20} />
                    </span>
                  ) : (
                    <Icon size={20} />
                  )}
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            {authenticated ? (
              <button onClick={() => setYouOpen(true)} aria-expanded={youOpen} className={cn(item, youOpen ? "text-[var(--ink)]" : "text-[var(--muted)]")}>
                <UserRound size={20} /> You
              </button>
            ) : (
              <button onClick={login} className={cn(item, "text-[var(--muted)]")}>
                <LogIn size={20} /> Sign in
              </button>
            )}
          </li>
        </ul>
      </nav>
      {authenticated && (
        <Sheet open={youOpen} onClose={() => setYouOpen(false)} title="You">
          <YouMenu onNavigate={() => setYouOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
