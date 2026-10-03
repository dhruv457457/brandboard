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
