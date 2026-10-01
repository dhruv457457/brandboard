"use client";

import { useEffect, useRef, useState } from "react";
import { isHome } from "@/lib/routes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, LogIn, MoreHorizontal, Plus, Search, UserRound, type LucideIcon } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { useBalances } from "@/lib/useBalances";
import { useNotifications } from "@/lib/notifications";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";
import { WalletPanel } from "./WalletPanel";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
}

/** The app's main places. Profile is yours once you're signed in. */
export function useNavItems(): NavItem[] {
  const pathname = usePathname();
  const { walletAddress } = usePatchedAuth();
  const { profile } = useProfile();
  const { unread } = useNotifications(20);
  const me = profile?.handle ?? walletAddress?.toLowerCase();
  const profileHref = me ? `/${me}` : "/settings";
  return [
    { href: "/", label: "Home", icon: Home, active: isHome(pathname) },
    { href: "/events", label: "Events", icon: CalendarDays, active: pathname.startsWith("/events") || pathname.startsWith("/e/") },
    { href: "/explore", label: "Explore", icon: Search, active: pathname.startsWith("/explore") },
    { href: "/notifications", label: "Activity", icon: Bell, active: pathname.startsWith("/notifications"), badge: unread },
    { href: profileHref, label: "Profile", icon: UserRound, active: !!me && (pathname === `/${me}` || pathname.startsWith("/dashboard") || pathname.startsWith("/bids")) },
  ];
}

/** Desktop navigation, like X: a slim column that never reloads. Icons only on medium screens, labels from xl. */
export function Sidebar() {
  const items = useNavItems();
  const { ready, authenticated } = usePatchedAuth();
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex sticky top-0 z-40 h-dvh flex-col flex-none w-[76px] xl:w-[248px] px-2 xl:px-3 py-3" aria-label="Main">
      <Link href="/" aria-label="Patched home" className="h-[52px] flex items-center px-2.5 mb-2 no-underline rounded-full hover:bg-[var(--soft)] self-start">
        <span className="xl:hidden"><LogoMark size={32} /></span>
        <span className="hidden xl:inline-flex"><Logo size={30} /></span>
      </Link>

      <nav className="grid gap-1">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            aria-current={it.active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-4 h-[50px] px-3 rounded-full no-underline text-[var(--ink)] text-[18px] transition-colors hover:bg-[var(--soft)] self-start xl:pr-6",
              it.active ? "font-extrabold" : "font-medium",
            )}
            title={it.label}
          >
            <span className="relative inline-flex">
              <it.icon size={26} strokeWidth={it.active ? 2.6 : 2} />
              {!!it.badge && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-bold grid place-items-center border-2 border-[var(--paper)]">
                  {it.badge > 9 ? "9+" : it.badge}
                </span>
              )}
            </span>
            <span className="hidden xl:inline">{it.label}</span>
          </Link>
        ))}
      </nav>

      <Link href="/studio" className="btn-base btn-primary mt-4 h-[50px] w-[50px] xl:w-full justify-center !rounded-full !px-0 text-[17px]" aria-label="Create a listing">
        <Plus size={22} className="xl:hidden" />
        <span className="hidden xl:inline">Create</span>
      </Link>

      <div className="mt-auto">
        {!ready ? (
          <span className="block h-[60px] rounded-full bg-[var(--soft)] motion-safe:animate-pulse" aria-hidden="true" />
        ) : authenticated ? (
          <AccountButton />
        ) : (
          <Link href={`/welcome?next=${encodeURIComponent(pathname)}`} className="btn-base w-[50px] xl:w-full h-[50px] justify-center !rounded-full !px-0" aria-label="Sign in">
            <LogIn size={20} className="xl:hidden" />
            <span className="hidden xl:inline">Sign in</span>
          </Link>
        )}
      </div>
    </aside>
  );
}

/** Your name and balance at the bottom of the sidebar; opens the wallet panel above it. */
function AccountButton() {
  const { walletAddress, xHandle } = usePatchedAuth();
  const { profile } = useProfile();
  const { usdc } = useBalances(walletAddress);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

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

  const name = profile?.display_name ?? (xHandle ? `@${xHandle}` : "Your account");
  const handle = profile?.handle ? `@${profile.handle}` : xHandle ? `@${xHandle}` : null;

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div role="dialog" aria-label="Wallet" className="absolute bottom-full left-0 mb-2 w-[300px] max-h-[calc(100dvh-100px)] overflow-y-auto card-surface p-4 z-50">
          <WalletPanel onNavigate={() => setOpen(false)} />
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Your account and wallet"
        className={cn("flex items-center gap-2.5 w-full h-[60px] px-2 xl:px-2.5 rounded-full text-left hover:bg-[var(--soft)]", open && "bg-[var(--soft)]")}
      >
        <Avatar src={profile?.avatar_url} name={name} wallet={walletAddress} size={40} />
        <span className="hidden xl:grid min-w-0 flex-1">
          <b className="truncate text-[15px] leading-tight">{name}</b>
          <span className="truncate text-[13px] text-[var(--muted)]">
            <span className="font-mono font-semibold text-[var(--ink)]">{usdc === null ? "…" : `$${usdc}`}</span>
            {handle ? ` · ${handle}` : ""}
          </span>
        </span>
        <MoreHorizontal size={18} className="hidden xl:block flex-none" />
      </button>
    </div>
  );
}
