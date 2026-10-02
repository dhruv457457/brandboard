"use client";

import { useEffect, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { usePatchedAuth } from "@/components/providers/PrivyAuthProvider";
import { toast } from "@/components/ui/Toast";
import { useAuthedFetch } from "@/lib/authedFetch";
import { cn } from "@/lib/utils";

/**
 * Follow a profile (kind "profile", id its wallet) or an event (kind "event", id "<chain>:<event id>"). Shows the
 * follower count, flips at once and rolls back if the server says no. Signed out, it opens sign-in.
 */
export function FollowButton({ kind, id, className }: { kind: "profile" | "event"; id: string; className?: string }) {
  const { authenticated, ready, login } = usePatchedAuth();
  const authedFetch = useAuthedFetch();
  const [state, setState] = useState<{ count: number; following: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = id.toLowerCase();

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    authedFetch(`/api/follows?kind=${kind}&id=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((s) => alive && setState({ count: s.count ?? 0, following: !!s.following }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [ready, authenticated, authedFetch, kind, key]);

  async function toggle() {
    if (!authenticated) return login();
    if (!state || busy) return;
    const next = !state.following;
    setBusy(true);
    setState({ count: Math.max(0, state.count + (next ? 1 : -1)), following: next });
    try {
      const res = await authedFetch("/api/follows", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, id: key }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't save that.");
      setState({ count: json.count, following: json.following });
    } catch (err) {
      setState(state);
      toast(err instanceof Error ? err.message : "Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const on = !!state?.following;
  return (
    <button type="button" onClick={toggle} disabled={busy || !state} aria-pressed={on} className={cn("btn-base btn-small", on ? "" : "btn-primary", className)}>
      {on ? <Check size={14} /> : <UserPlus size={14} />}
      {on ? "Following" : "Follow"}
      {state && state.count > 0 && <span className="font-mono text-xs opacity-70">{state.count}</span>}
    </button>
  );
}
