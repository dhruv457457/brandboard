"use client";

import { useEffect } from "react";
import "./globals.css";
import { isStaleBuildError, reloadOnce, reportCrash } from "@/lib/recover";

/**
 * The last resort: shown when the app's own frame (the layout, the sign-in provider, the sidebar) throws, which
 * error.tsx can't catch. It replaces the whole document, so it brings its own <html>. A page left open across a deploy
 * is fixed by one automatic reload; anything else gets a clear screen, the reason in small print and a retry.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportCrash(error);
    if (isStaleBuildError(error)) reloadOnce();
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "var(--paper, #FAFAF7)", color: "var(--ink, #0B0B0C)", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ display: "grid", gap: 14, justifyItems: "center", maxWidth: 440 }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>Patched needs a refresh</h1>
            <p style={{ margin: 0, color: "var(--muted, #5F5B53)" }}>
              Something went wrong while loading. This usually happens right after an update. Your wallet and your money are not affected.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn-base btn-primary" onClick={() => location.reload()}>Reload</button>
              <button className="btn-base" onClick={reset}>Try again</button>
            </div>
            <code style={{ fontSize: 11, opacity: 0.55, wordBreak: "break-word" }}>{error.message}{error.digest ? ` · ${error.digest}` : ""}</code>
          </div>
        </main>
      </body>
    </html>
  );
}
