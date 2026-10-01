/** Top-level routes: a handle with one of these names would be unreachable. */
export const RESERVED_HANDLES = new Set([
  "admin", "api", "bids", "campaigns", "create", "dashboard", "e", "events", "explore", "listing", "share", "studio",
  "settings", "about", "notifications", "welcome", "offers", "icon.svg",
]);

export const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{1,30}$/;

/** Why a handle can't be used (format or reserved), or null when it's fine to check for availability. */
export function handleProblem(h: string): string | null {
  if (!HANDLE_RE.test(h)) return "2 to 31 characters: letters, numbers, dots, dashes or underscores.";
  if (/^0x[0-9a-f]{40}$/.test(h) || RESERVED_HANDLES.has(h)) return "That handle isn't allowed.";
  // On a creator's own subdomain, /6 means listing 6, so a handle made only of digits would be ambiguous.
  if (/^\d+$/.test(h)) return "Use at least one letter.";
  return null;
}

/**
 * The address to share for an in-app path. Creator pages ("/dhruv", "/dhruv/6") become the creator's own subdomain
 * ("https://dhruv.monad.patched.world/6") when NEXT_PUBLIC_HANDLE_DOMAIN is set (the same value as HANDLE_DOMAIN, which
 * the middleware uses to serve them) and the handle works as a subdomain. Anything else stays on `origin`.
 */
export function publicUrl(path: string, origin = typeof window === "undefined" ? "" : window.location.origin): string {
  const domain = process.env.NEXT_PUBLIC_HANDLE_DOMAIN?.toLowerCase();
  const m = path.match(/^\/([^/?#]+)(.*)$/);
  const handle = m?.[1].toLowerCase();
  // Subdomains only take letters, digits and dashes; wallet addresses keep the long form.
  if (domain && handle && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(handle) && !RESERVED_HANDLES.has(handle) && !/^0x[0-9a-f]{40}$/.test(handle)) {
    return `https://${handle}.${domain}${m![2]}`;
  }
  return `${origin}${path}`;
}

