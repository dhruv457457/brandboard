"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Wallet, Sun, Moon } from "lucide-react";
import { useRole } from "@/lib/role";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth/useAuth";
import { formatShortAddress } from "@/lib/format";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function Navbar() {
  const { role, setRole } = useRole();
  const { theme, toggleTheme } = useTheme();
  const { authenticated, walletAddress, xHandle, login, logout } = useAuth();
  const pathname = usePathname();

  const getNavLinks = () => {
    switch (role) {
      case "creator":
        return [
          { label: "Explore", href: "/explore" },
          { label: "Studio", href: "/studio" },
          { label: "My page", href: "/mirabuilds" },
          { label: "Share", href: "/share/mira" },
        ];
      case "brand":
        return [
          { label: "Explore", href: "/explore" },
          { label: "My bids", href: "/bids" },
        ];
      case "admin":
        return [
          { label: "Console", href: "/admin" },
          { label: "Explore", href: "/explore" },
        ];
      case "visitor":
      default:
        return [
          { label: "Explore", href: "/explore" },
          { label: "How it works", href: "/#how-it-works" },
        ];
    }
  };

  const links = getNavLinks();

  return (
    <header className="sticky top-0 z-40 bg-[var(--paper)]/90 backdrop-blur-md border-b-2 border-[var(--line)] px-4 sm:px-8 py-2.5 transition-colors">
      <div className="max-w-6xl mx-auto flex items-center gap-4 sm:gap-6 flex-wrap justify-between">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="inline-flex items-center no-underline">
            <Logo size={34} />
          </Link>

          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {links.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors no-underline",
                    isActive
                      ? "text-[var(--ink)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)]"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <span
                      className="absolute left-3 right-3 bottom-0.5 h-[2px] pointer-events-none"
                      style={{
                        background:
                          "repeating-linear-gradient(90deg, var(--accent) 0 5px, transparent 5px 8px)",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side items based on role */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-xl border-2 border-[var(--line)] bg-[var(--card)] flex items-center justify-center text-[var(--ink)] shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)] cursor-pointer transition-transform active:scale-95 flex-none"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          {role === "visitor" && (
            <>
              {!authenticated ? (
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => {
                    login();
                    setRole("creator");
                  }}
                >
                  Sign in
                </Button>
              ) : (
                <div
                  onClick={() => logout()}
                  title="Click to sign out"
                  className="inline-flex items-center gap-1.5 border-2 border-[var(--line)] rounded-xl px-2.5 py-1 font-mono text-xs font-semibold bg-[var(--card)] cursor-pointer hover:bg-[var(--soft)] select-none"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
                  <span>
                    {xHandle ? `@${xHandle}` : formatShortAddress(walletAddress || "")}
                  </span>
                </div>
              )}
              <Link href="/studio">
                <Button size="small" variant="primary">
                  Get patched
                </Button>
              </Link>
            </>
          )}

          {role === "creator" && (
            <>
              <div className="inline-flex items-center gap-1.5 border-2 border-[var(--line)] rounded-xl px-3 py-1 font-mono text-xs font-semibold bg-[var(--card)] select-none">
                <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>$1,355 in escrow</span>
              </div>
              <Link href="/mirabuilds" aria-label="My creator profile">
                <div
                  className="w-9 h-9 rounded-xl border-2 border-[var(--line)] grid place-items-center font-extrabold text-sm text-[#0B0B0C] select-none hover:scale-105 transition-transform"
                  style={{
                    background: "linear-gradient(135deg, var(--p5), var(--p2))",
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  M
                </div>
              </Link>
            </>
          )}

          {role === "brand" && (
            <>
              <div className="inline-flex items-center gap-1.5 border-2 border-[var(--line)] rounded-xl px-3 py-1 font-mono text-xs font-semibold bg-[var(--card)] select-none">
                <Wallet className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>2,480 USDC</span>
              </div>
              <Link href="/bids" aria-label="Brand bids dashboard">
                <div
                  className="w-9 h-9 rounded-xl border-2 border-[var(--line)] grid place-items-center font-extrabold text-sm text-[#0B0B0C] bg-[var(--p2)] select-none hover:scale-105 transition-transform"
                  style={{
                    fontFamily: "var(--font-bricolage), sans-serif",
                  }}
                >
                  N
                </div>
              </Link>
            </>
          )}

          {role === "admin" && (
            <Link href="/admin" aria-label="Admin console">
              <div
                className="w-9 h-9 rounded-xl border-2 border-[var(--line)] grid place-items-center font-extrabold text-sm text-[#0B0B0C] bg-[var(--p3)] select-none hover:scale-105 transition-transform"
                style={{
                  fontFamily: "var(--font-bricolage), sans-serif",
                }}
              >
                A
              </div>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
