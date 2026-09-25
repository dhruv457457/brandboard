"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { formatTimeAgo } from "@/lib/format";
import { describe, useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import PageLoading from "@/app/loading";

/** Every notification for the signed-in wallet, newest first. Opening the page marks them read. */
export default function NotificationsPage() {
  const { ready, authenticated, login } = usePatchedAuth();
  const { rows, labels, loaded, markAllRead } = useNotifications(100);

  // Mark read once they've been shown.
  useEffect(() => {
    if (loaded) markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!ready) return <PageLoading />;
  if (!authenticated) {
    return (
      <main className="wrap pt-10 pb-24"><Card className="p-8 text-center grid gap-3 justify-items-center">
        <h1 className="text-3xl font-extrabold">Notifications</h1>
        <p className="muted">Sign in to see your bids, wins and payouts as they happen.</p>
        <Button variant="primary" onClick={login}>Sign in</Button>
      </Card></main>
    );
  }

  return (
    <main className="wrap pt-8 pb-24 grid gap-6 max-w-3xl">
      <div>
        <span className="eyebrow">Account</span>
        <h1 className="font-extrabold text-4xl tracking-tight mt-1">Notifications</h1>
      </div>
      {!loaded ? (
        <div className="grid gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="p-6 grid gap-3 justify-items-start">
          <p className="flex items-center gap-2"><Bell size={18} /> Nothing yet. Bids, wins and payouts show up here, live.</p>
          <Link href="/explore" className="btn-base btn-primary btn-small">Explore live listings</Link>
        </Card>
      ) : (
        <Card className="p-2">
          <ul>
            {rows.map((n) => {
              const { text, href } = describe(n, labels);
              return (
                <li key={n.id}>
                  <Link href={href} className={cn("block rounded-lg px-3 py-3 hover:bg-[var(--soft)]", !n.read_at && "bg-[var(--accent-soft)]")}>
                    {text}
                    <span className="block text-xs text-[var(--muted)] mt-0.5">{formatTimeAgo(n.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </main>
  );
}
