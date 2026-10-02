import { ExternalLink } from "lucide-react";
import { EXPLORER } from "@/lib/config";
import { cn } from "@/lib/utils";

const TX = /^0x[0-9a-fA-F]{64}$/;

/** A small "view on the explorer" link for a transaction. Renders nothing for a hash that isn't a real one (the keeper keys some rows with a label). */
export function ExplorerLink({ tx, className, label = "View on Monad" }: { tx?: string | null; className?: string; label?: string }) {
  if (!tx || !TX.test(tx)) return null;
  return (
    <a
      href={`${EXPLORER}/tx/${tx}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={cn("inline-grid place-items-center w-6 h-6 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--soft)] flex-none", className)}
    >
      <ExternalLink size={13} />
    </a>
  );
}
