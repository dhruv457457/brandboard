"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** People who open a shared link go straight to the graph; link previews (which don't run scripts) read the page's metadata. */
export function ToPatchwork({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return (
    <Link href={to} className="btn-base btn-primary">
      Open the patchwork
    </Link>
  );
}
