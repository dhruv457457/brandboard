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

export const metadata: Metadata = {
  title: "Patched — Get patched. Get paid.",
  description:
    "Creators sell ad space on their outfit, car or team hoodie; brands bid in USDC per patch; escrow on Monad pays out when the creator shows up.",
};

import { ProfileProvider } from "@/lib/profile";
import { Navbar } from "@/components/navigation/Navbar";
import { PrivyAuthProvider } from "@/components/providers/PrivyAuthProvider";
import { BottomNav } from "@/components/navigation/BottomNav";
import { RoleWelcome } from "@/components/navigation/RoleWelcome";

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
            `,
          }}
        />
      </head>
      <body className="antialiased selection:bg-[var(--accent)] selection:text-[var(--on-accent)] min-h-screen flex flex-col">
        <ThemeProvider>
          <PrivyAuthProvider>
            <ProfileProvider>
              <SurfaceDefs />
              <Navbar />
              <div className="flex-1">{children}</div>
              <BottomNav />
              <RoleWelcome />
              <Toaster />
            </ProfileProvider>
          </PrivyAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
