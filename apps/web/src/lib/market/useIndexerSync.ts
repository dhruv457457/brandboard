"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * On pages that read indexed data (Explore, Admin), pull any new chain events when the page opens and
 * refresh it if something changed. Keeps the UI correct even if no scheduler has run recently.
 */
export function useIndexerSync() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch("/api/indexer/sync", { method: "POST" })
      .then((r) => r.json())
      .then((r: { logs?: number }) => {
        if (!cancelled && (r.logs ?? 0) > 0) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);
}
