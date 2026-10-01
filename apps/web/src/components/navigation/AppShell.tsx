"use client";

import { usePathname } from "next/navigation";
import { useSignedIn } from "@/lib/signedIn";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { MobileTopBar, TabBar } from "./TabBar";
import { RoleWelcome } from "./RoleWelcome";
import { isHome, isListingPage } from "@/lib/routes";

/**
 * The persistent frame around every page. Three looks:
 * - the landing page for signed-out visitors (its own top bar),
 * - bare pages that stand alone (a creator's listing page, onboarding),
 * - the app: sidebar on desktop, top bar and tabs on phones. It never reloads; only the content changes.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const signedIn = useSignedIn();

  if (isListingPage(pathname) || pathname.startsWith("/welcome")) {
    return <div className="flex-1">{children}</div>;
  }

  if (isHome(pathname) && !signedIn) {
    return (
      <div className="landing-only flex-1 flex flex-col">
        <Navbar />
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[1320px] md:flex flex-1">
        <Sidebar />
        <MobileTopBar />
        <div id="content" className="flex-1 min-w-0 md:border-l-[1.5px] md:border-[var(--soft)] min-h-dvh">
          {children}
        </div>
      </div>
      <TabBar />
      <RoleWelcome />
    </>
  );
}
