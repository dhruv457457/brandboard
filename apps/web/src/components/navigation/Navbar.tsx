"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth/useAuth";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./AccountMenu";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { ready, authenticated, login } = useAuth();
  const pathname = usePathname();

  const links = authenticated
    ? [
        { label: "Explore", href: "/explore" },
        { label: "Studio", href: "/studio" },
        { label: "My bids", href: "/bids" },
      ]
    : [
        { label: "Explore", href: "/explore" },
        { label: "How it works", href: "/#how-it-works" },
      ];

  return (
    <header className="sticky top-0 z-40 bg-[var(--paper)]/90 backdrop-blur-md border-b-2 border-[var(--line)] px-4 sm:px-8 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center gap-3 justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="inline-flex items-center no-underline" aria-label="Patched home">
            <Logo size={34} />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {links.map((link) => {
              const active = link.href.startsWith("/#") ? false : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg text-sm font-semibold no-underline transition-colors",
                    link.href.startsWith("/#") && "hidden sm:inline-block",
                    active ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)]",
                  )}
                >
                  {link.label}
                  {active && (
                    <span
                      className="absolute left-3 right-3 bottom-0.5 h-[2px] pointer-events-none"
                      style={{ background: "repeating-linear-gradient(90deg, var(--accent) 0 5px, transparent 5px 8px)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-9 h-9 rounded-xl border-2 border-[var(--line)] bg-[var(--card)] flex items-center justify-center text-[var(--ink)] shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)] flex-none"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {!ready ? null : authenticated ? (
            <AccountMenu />
          ) : (
            <>
              <Button size="small" variant="ghost" onClick={login}>Sign in</Button>
              <Link href="/studio" className="btn-base btn-small btn-primary hidden sm:inline-flex">Get patched</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
