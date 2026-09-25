"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatTimeAgo } from "@/lib/format";
import { describe, useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** Bell with unread count; opens the latest notifications and marks them read. Updates live. */
export function NotificationBell() {
  const { wallet, rows, labels, unread, markAllRead } = useNotifications(20);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!wallet) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative w-9 h-9 rounded-xl border-2 border-[var(--line)] bg-[var(--card)] grid place-items-center shadow-[2px_2px_0_var(--shadow)] hover:bg-[var(--soft)]"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--accent)] text-[var(--on-accent)] text-[10px] font-bold grid place-items-center border-2 border-[var(--card)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(360px,calc(100vw-32px))] card-surface p-2 z-50">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="font-bold">Notifications</p>
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold underline">See all</Link>
          </div>
          {rows.length === 0 ? (
            <p className="px-2 pb-3 text-sm text-[var(--muted)]">Nothing yet. Bids, wins and payouts show up here.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {rows.map((n) => {
                const { text, href } = describe(n, labels);
                return (
                  <li key={n.id}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn("block rounded-lg px-2 py-2 text-sm hover:bg-[var(--soft)]", !n.read_at && "bg-[var(--accent-soft)]")}
                    >
                      {text}
                      <span className="block text-xs text-[var(--muted)] mt-0.5">{formatTimeAgo(n.created_at)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
