import Link from "next/link";
import { Eye, Settings2, Share2 } from "lucide-react";
import { SHAREABLE } from "@/lib/market/listingStatus";
import { cn } from "@/lib/utils";

/**
 * A creator's three screens for one listing, as tabs: the public page, Manage (proofs, payouts) and the share
 * kit. Shown on all three so moving between them is one tap.
 */
export function ListingTools({ listingId, pageHref, status, active }: {
  listingId: number;
  pageHref: string;
  status: number;
  active: "page" | "manage" | "share";
}) {
  const tabs = [
    { key: "page", label: "Page", href: pageHref, icon: Eye },
    { key: "manage", label: "Manage", href: `/studio/${listingId}`, icon: Settings2 },
    ...(SHAREABLE.has(status) ? [{ key: "share", label: "Share", href: `/share/${listingId}`, icon: Share2 }] : []),
  ] as const;
  return (
    <nav aria-label="Your listing" className="inline-flex rounded-xl border-2 border-[var(--line)] bg-[var(--card)] p-1 gap-1">
      {tabs.map(({ key, label, href, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold no-underline",
            active === key ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-[var(--soft)]",
          )}
        >
          <Icon size={14} /> {label}
        </Link>
      ))}
    </nav>
  );
}
