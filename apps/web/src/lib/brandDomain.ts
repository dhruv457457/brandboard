// Brand verification rules: a work email proves a brand when its domain matches the brand's website.

/** Free and personal email providers: an address there says nothing about owning a brand. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net",
  "mail.com", "zoho.com", "yandex.com", "yandex.ru", "tutanota.com", "fastmail.com", "hey.com", "qq.com",
  "163.com", "126.com", "rediffmail.com",
]);

/** "https://www.Coinbase.com/about" -> "coinbase.com"; null if it isn't a valid https URL. */
export function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const u = new URL(website);
    if (u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The domain of `email` if it proves ownership of `website`'s domain, else null. */
export function matchingDomain(email: string, website: string | null | undefined): string | null {
  const site = websiteDomain(website);
  const at = email.lastIndexOf("@");
  if (!site || at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (FREE_MAIL.has(domain)) return null;
  // Same domain, or the site is a subdomain of the email's domain (shop.coinbase.com with @coinbase.com).
  return site === domain || site.endsWith(`.${domain}`) ? domain : null;
}
