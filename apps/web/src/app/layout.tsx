import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { SurfaceDefs } from "@/components/surface/SurfaceDefs";
import { Toaster } from "@/components/ui/Toast";
import { AddMoneyHost } from "@/components/wallet/AddMoney";
import { BrandSetupHost } from "@/components/market/BrandSetup";
import { Analytics } from "@vercel/analytics/next";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Absolute URLs for link previews (X, Telegram): the public site in production, Vercel's own URL on previews.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Patched — Get patched. Get paid.",
  description:
    "Creators sell ad space on their outfit, car or team hoodie; brands bid in USDC per patch; escrow on Monad pays out when the creator shows up.",
};

import { ProfileProvider } from "@/lib/profile";
import { PrivyAuthProvider } from "@/components/providers/PrivyAuthProvider";
import { AppShell } from "@/components/navigation/AppShell";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { SIGNED_IN_SCRIPT } from "@/lib/signedInScript";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Privy's servers are asked for on every page: open the connection while the scripts download. */}
        <link rel="preconnect" href="https://auth.privy.io" crossOrigin="anonymous" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('patched.theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (_) {}
              ${SIGNED_IN_SCRIPT}
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-[var(--accent)] selection:text-[var(--on-accent)] min-h-screen flex flex-col">
        {/* Shown by CSS only while a remembered sign-in waits for the app (no flash of the landing page). */}
        <div className="boot-loader" role="status" aria-live="polite">
          <svg viewBox="0 0 40 40" width={56} height={56} aria-hidden="true">
            <g transform="rotate(-8 20 20)">
              <rect x="6" y="6" width="31" height="31" rx="9" fill="#0B0B0C" />
              <rect x="3.5" y="3.5" width="31" height="31" rx="9" fill="#FF5A1F" stroke="#0B0B0C" strokeWidth="2.4" />
              <rect x="7.8" y="7.8" width="22.4" height="22.4" rx="5.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="3 2.4" />
              <path d="M15.5 28V12.5h5.2a4.4 4.4 0 0 1 0 8.8h-5.2" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
          <span>Loading your feed</span>
        </div>
        <ThemeProvider>
          <PrivyAuthProvider>
            <ProfileProvider>
              <SurfaceDefs />
              <MotionProvider>
                <AppShell>{children}</AppShell>
              </MotionProvider>
              <Toaster />
              <AddMoneyHost />
              <BrandSetupHost />
            </ProfileProvider>
          </PrivyAuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
