"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (e?: React.MouseEvent) => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("patched.theme") as Theme | null;
      if (stored === "dark" || stored === "light") {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
      } else {
        document.documentElement.setAttribute("data-theme", "light");
      }
    } catch {
      // ignore local storage errors
    }
    setMounted(true);
  }, []);

  const applyTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("patched.theme", next);
    } catch {
      // ignore
    }
  };

  const toggleTheme = (e?: React.MouseEvent) => {
    const next = theme === "dark" ? "light" : "dark";
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Check if View Transitions API is supported and element position is available
    if (
      !document.startViewTransition ||
      prefersReducedMotion ||
      !e ||
      !e.currentTarget
    ) {
      applyTheme(next);
      return;
    }

    const target = e.currentTarget as HTMLElement;
    const r = target.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    document.documentElement.classList.add("vt-theme");

    const transition = document.startViewTransition(() => {
      applyTheme(next);
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 550,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove("vt-theme");
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: mounted ? theme : "light",
        toggleTheme,
        setTheme: applyTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
