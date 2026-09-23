import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono, Caveat } from "next/font/google";
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

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Patched — Get patched. Get paid.",
  description:
    "Creators sell ad space on their outfit, car or team hoodie; brands bid in USDC per patch; escrow on Monad pays out when the creator shows up.",
};

import { RoleProvider } from "@/lib/role";
import { Navbar } from "@/components/navigation/Navbar";
import { PreviewRoleDock } from "@/components/navigation/PreviewRoleDock";
import { PrivyAuthProvider } from "@/components/providers/PrivyAuthProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bricolage.variable} ${geist.variable} ${geistMono.variable} ${caveat.variable}`}
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
            <RoleProvider>
              <SurfaceDefs />
              <Navbar />
              <div className="flex-1">{children}</div>
              <PreviewRoleDock />
              <Toaster />
            </RoleProvider>
          </PrivyAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
