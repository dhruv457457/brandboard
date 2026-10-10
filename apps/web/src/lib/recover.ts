/**
 * A tab that stayed open across a deploy still points at script files the new build no longer has, so loading the next
 * page fails with a generic "client-side exception". Reloading fixes it. We do that once per tab and say so otherwise,
 * so a real bug can't turn into a reload loop.
 */
const FLAG = "patched.reloaded";

export const isStaleBuildError = (e: unknown): boolean => {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(text);
};

/** Reload the page, once per tab session. Returns whether it did. */
export function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(FLAG)) return false;
    sessionStorage.setItem(FLAG, String(Date.now()));
    location.reload();
    return true;
  } catch {
    return false;
  }
}

/** Call once the page has been healthy for a while, so a later deploy can be recovered from too. */
export function clearReloadFlag() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* ignore */
  }
}

/** Tell the server about a crash (best effort, never throws), so an error nobody can reproduce can still be read. */
export function reportCrash(error: Error & { digest?: string }) {
  try {
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ message: error.message, stack: error.stack, digest: error.digest, path: location.pathname, stale: isStaleBuildError(error) }),
    });
  } catch {
    /* reporting must never cause a second error */
  }
}

/** Pages where an automatic reload could lose something being typed: they get the reload on their next navigation. */
const BUSY = /^\/(studio|campaigns\/new|settings)/;
const AWAY_MS = 10 * 60_000;

async function currentVersion(): Promise<string | null> {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    return r.ok ? ((await r.json()) as { version: string }).version : null;
  } catch {
    return null;
  }
}

/**
 * Keep a long-open tab on the live build. Remember the build this tab loaded; when the tab comes back after 10 minutes
 * or more, ask again, and if a new build is out, reload (or, on a page with a form, reload on the next navigation).
 * Also catch a stale-build failure anywhere (a lazy chunk, a script import), not only the ones that reach an error
 * screen, and recover with the same once-per-tab reload. Returns a cleanup function.
 */
export function watchForNewBuild(): () => void {
  let loaded: string | null = null;
  let hiddenAt: number | null = null;
  let pending = false;
  void currentVersion().then((v) => (loaded = v));

  const onVisible = async () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      return;
    }
    const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
    hiddenAt = null;
    if (away < AWAY_MS || !loaded) return;
    const now = await currentVersion();
    if (!now || now === loaded) return;
    if (BUSY.test(location.pathname)) pending = true;
    else location.reload();
  };
  // A page with a form waited: reload on the next in-app navigation instead.
  const onNavigate = () => {
    if (pending && !BUSY.test(location.pathname)) location.reload();
  };
  const onError = (e: ErrorEvent | PromiseRejectionEvent) => {
    const reason = "reason" in e ? e.reason : e.error ?? e.message;
    if (isStaleBuildError(reason)) reloadOnce();
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("popstate", onNavigate);
  const nav = setInterval(onNavigate, 2000);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onError);
  return () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("popstate", onNavigate);
    clearInterval(nav);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onError);
  };
}
