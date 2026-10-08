import type { FunnelStep } from "./contest";

const KEY = "patched.contest.visitor";

/** A random id for this browser, kept so one person counts once per funnel step. Nothing personal in it. */
function visitorId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null; // storage blocked: this visit just isn't counted
  }
}

const sent = new Set<FunnelStep>();

/** Count an anonymous step of the contest funnel (view, join tap, form started). Fire and forget, once per page load. */
export function trackContest(step: FunnelStep) {
  if (sent.has(step)) return;
  sent.add(step);
  const visitor = visitorId();
  if (!visitor) return;
  void fetch("/api/contest/track", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ visitor, step }), keepalive: true }).catch(() => {});
}
