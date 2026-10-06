"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, Plus } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { useProfile } from "@/lib/profile";
import { LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";
import { useNavItems } from "./Sidebar";
import { WalletPanel } from "./WalletPanel";

/** Phone navigation: Home, Events, Create, Activity, Profile, one thumb-tap away. Hidden from md up. */
export function TabBar() {
  const items = useNavItems().filter((i) => i.label !== "Explore");
  const { authenticated, login } = usePatchedAuth();
  const [home, events, activity, profile] = items;
  const cell = "flex flex-col items-center justify-center gap-0.5 min-h-[58px] w-full text-[11px] font-semibold no-underline";

  const tab = (it: (typeof items)[number]) => (
    <li key={it.label}>
      {it.label === "Profile" && !authenticated ? (
        <button type="button" onClick={login} className={cn(cell, "text-[var(--muted)]")}><LogIn size={22} /> Sign in</button>
      ) : (
        <Link href={it.href} aria-current={it.active ? "page" : undefined} className={cn(cell, it.active ? "text-[var(--ink)]" : "text-[var(--muted)]")}>
          <span className="relative inline-flex">
            <it.icon size={23} strokeWidth={it.active ? 2.6 : 2} />
            {!!it.badge && <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-[var(--accent)] border-2 border-[var(--paper)]" />}
          </span>
          {it.label}
        </Link>
      )}
    </li>
  );

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav aria-label="Main navigation" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--paper)]/95 backdrop-blur-md border-t-2 border-[var(--line)] pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {tab(home)}
          {tab(events)}
          <li>
            <Link href="/studio" className={cn(cell, "text-[var(--ink)]")} aria-label="Create a listing">
              <span className="w-11 h-11 -mt-1 rounded-2xl grid place-items-center bg-[var(--accent)] text-[var(--on-accent)] border-2 border-[var(--line)] shadow-[2px_2px_0_var(--shadow)]">
                <Plus size={22} />
              </span>
            </Link>
          </li>
          {tab(activity)}
          {tab(profile)}
        </ul>
      </nav>
    </>
  );
}

/** Phone top bar: the logo, and your avatar to open the wallet. */
export function MobileTopBar() {
  const { ready, authenticated, walletAddress, xHandle, login } = usePatchedAuth();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 bg-[var(--paper)]/92 backdrop-blur-md border-b-[1.5px] border-[var(--soft)] px-4 h-[54px] flex items-center justify-between">
        <Link href="/" aria-label="Patched home" className="no-underline"><LogoMark size={30} /></Link>
        {!ready ? (
          <span className="w-9 h-9 rounded-full bg-[var(--soft)]" aria-hidden="true" />
        ) : authenticated ? (
          <button onClick={() => setOpen(true)} aria-label="Your wallet and account" aria-expanded={open} className="rounded-full">
            <Avatar src={profile?.avatar_url} name={profile?.display_name ?? xHandle} wallet={walletAddress} size={36} />
          </button>
        ) : (
          <button type="button" onClick={login} className="btn-base btn-small">Sign in</button>
        )}
      </header>
      {authenticated && (
        <Sheet open={open} onClose={() => setOpen(false)} title="Wallet">
          <WalletPanel onNavigate={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}
