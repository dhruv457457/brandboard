import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { SurfaceDefs } from "@/components/surface/SurfaceDefs";
import { Toaster } from "@/components/ui/Toast";

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
          <img src="/icon.svg" alt="" width={56} height={56} />
          <span>Loading your feed</span>
        </div>
        <ThemeProvider>
          <PrivyAuthProvider>
            <ProfileProvider>
              <SurfaceDefs />
              <AppShell>{children}</AppShell>
              <Toaster />
            </ProfileProvider>
          </PrivyAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
